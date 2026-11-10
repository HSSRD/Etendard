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
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${file} : hors de ${base}.`);
  }
  return relative;
};

/**
 * Associe chaque image « actual » d'un dossier test-results/ au chemin de sa capture de
 * référence. Dans le rapport JSON que Playwright écrit en CI (rapport.json), chaque
 * `X-actual.png` est accompagnée de `X-expected.png`, qui pointe sur la référence, présente ou
 * manquante. Sans elle (nouvelle capture instable), il n'y a rien à installer.
 * @param {string} resultsDir
 */
export const references = (resultsDir) => {
  /** @type {Report} */
  const report = JSON.parse(
    readFileSync(path.join(resultsDir, 'rapport.json'), 'utf8'),
  );
  const { rootDir, projects } = report.config;
  return specsOf(report)
    .flatMap(({ tests }) => tests)
    .flatMap(({ projectName, results }) => {
      const outputDir = projects.find(
        ({ name }) => name === projectName,
      )?.outputDir;
      if (!outputDir) throw new Error(`${projectName} : projet introuvable.`);
      return results.flatMap(({ attachments }) =>
        attachments.flatMap(({ name, path: actual }) => {
          if (!actual || !name.endsWith('-actual.png')) return [];
          const expected = attachments.find(
            (other) =>
              other.name === name.replace(/-actual\.png$/, '-expected.png'),
          )?.path;
          if (!expected) return [];
          return [
            {
              from: path.join(resultsDir, inside(outputDir, actual)),
              to: path.join(root, inside(rootDir, expected)),
            },
          ];
        }),
      );
    });
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
    if (download.status !== 0) {
      throw new Error(
        `artefact « playwright » du run ${run} non téléchargé (voir l'erreur de gh ci-dessus ; il est gardé 7 jours).`,
      );
    }
    const copies = references(dir);
    for (const { from, to } of copies) {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      console.log(path.relative('', to));
    }
    console.log(
      `${copies.length} capture(s) installée(s). Relis chaque image avant de commiter.`,
    );
  } catch (error) {
    console.error(
      `captures:ci : ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
