// Installe comme références les captures « actual » d'un run de ci.yml en échec, sans Docker :
// elles ont été produites par l'image de Playwright de la CI (ADR 0003), la commande ne fait que
// les recopier. Usage : pnpm captures:ci <id du run>
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * @typedef {{ name: string, path?: string }} Attachment
 * @typedef {{ tests: { projectName: string, results: { attachments: Attachment[] }[] }[] }} Spec
 * @typedef {{ suites?: Suite[], specs?: Spec[] }} Suite
 * @typedef {Suite & { config: { rootDir: string, projects: { name: string, outputDir: string }[] } }} Report
 */

/** @param {Suite} suite @returns {Spec[]} */
const specsOf = (suite) => [
  ...(suite.specs ?? []),
  ...(suite.suites ?? []).flatMap(specsOf),
];

/** Chemin relatif sous `base`, ou erreur s'il en sort (chemins venus de l'artefact). */
const inside = (/** @type {string} */ base, /** @type {string} */ file) => {
  const relative = path.posix.relative(base, file);
  // « \ » compte aussi : sous Windows, path.join le prend pour un séparateur.
  if (!relative || relative.split(/[\\/]/).includes('..')) {
    throw new Error(`${file} : hors de ${base}.`);
  }
  return relative;
};

/**
 * Associe chaque image « actual » d'un dossier test-results/ au chemin de sa capture de
 * référence. Dans le rapport JSON que Playwright écrit en CI (rapport.json), chaque
 * `X-actual.png` est accompagnée de `X-expected.png`, qui pointe sur la référence, présente ou
 * manquante. Sans elle (nouvelle capture) ou avec `X-previous.png`, Playwright n'a pas obtenu
 * deux images identiques de suite : la capture est instable et n'est pas installée.
 * @param {string} resultsDir
 */
export const references = (resultsDir) => {
  /** @type {Report} */
  const report = JSON.parse(
    readFileSync(path.join(resultsDir, 'rapport.json'), 'utf8'),
  );
  const { rootDir, projects } = report.config;
  /** @type {{ from: string, to: string }[]} */
  const copies = [];
  /** @type {string[]} */
  const unstable = [];
  for (const { projectName, results } of specsOf(report).flatMap(
    ({ tests }) => tests,
  )) {
    const outputDir = projects.find(
      ({ name }) => name === projectName,
    )?.outputDir;
    if (!outputDir) throw new Error(`${projectName} : projet introuvable.`);
    for (const { attachments } of results) {
      /** @param {string} name */
      const pathOf = (name) =>
        attachments.find((attachment) => attachment.name === name)?.path;
      for (const { name, path: actual } of attachments) {
        if (!actual || !name.endsWith('-actual.png')) continue;
        const base = name.slice(0, -'-actual.png'.length);
        const expected = pathOf(`${base}-expected.png`);
        if (!expected || pathOf(`${base}-previous.png`)) {
          unstable.push(`${base} (${projectName})`);
          continue;
        }
        const to = inside(rootDir, expected);
        if (!/(^|\/)__captures__\/.+\.png$/.test(to)) {
          throw new Error(`${expected} : pas une capture de référence.`);
        }
        copies.push({
          from: path.join(resultsDir, inside(outputDir, actual)),
          to: path.join(root, to),
        });
      }
    }
  }
  return { copies, unstable };
};

if (import.meta.main) {
  const run = process.argv[2];
  if (!/^\d+$/.test(run ?? '')) {
    console.error('Usage : pnpm captures:ci <id du run ci.yml en échec>');
    process.exit(1);
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'etendard-captures-'));
  try {
    const download = spawnSync(
      'gh',
      ['run', 'download', run, '--name', 'playwright', '--dir', dir],
      { cwd: root, stdio: 'inherit' },
    );
    if (download.error) throw new Error(`gh : ${download.error.message}`);
    if (download.status !== 0) {
      throw new Error(
        `artefact « playwright » du run ${run} non téléchargé (voir l'erreur de gh ci-dessus).`,
      );
    }
    const { copies, unstable } = references(dir);
    for (const { from, to } of copies) {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      console.log(path.relative('', to));
    }
    console.log(
      `${copies.length} capture(s) installée(s). Relis chaque image avant de commiter.`,
    );
    if (unstable.length > 0) {
      console.error(
        `Capture(s) instable(s), non installée(s) : ${unstable.join(', ')}.`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `captures:ci : ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
