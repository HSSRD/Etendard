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
import config from '../playwright.config.ts';

const actualSuffix = '-actual.png';
// Dossier de playwright.config.ts, donc {testDir} : les captures n'y dépendent pas du dossier courant.
const root = fileURLToPath(new URL('..', import.meta.url));
const template = config.snapshotPathTemplate;
if (!template) throw new Error('snapshotPathTemplate absent.');
const handled = [
  'testDir',
  'testFileDir',
  'testFileName',
  'arg',
  'projectName',
  'ext',
];
const tokenPattern = /\{(\w+)\}/g;
for (const [token, key = ''] of template.matchAll(tokenPattern)) {
  if (!handled.includes(key)) {
    throw new Error(`snapshotPathTemplate : ${token} non géré.`);
  }
}

/**
 * @typedef {{ name: string, path?: string }} Attachment
 * @typedef {{ file: string, tests: { projectName: string, results: { attachments: Attachment[] }[] }[] }} Spec
 * @typedef {{ suites?: Suite[], specs?: Spec[] }} Suite
 */

/** @param {Suite} suite @returns {Spec[]} */
const specsOf = (suite) => [
  ...(suite.specs ?? []),
  ...(suite.suites ?? []).flatMap(specsOf),
];

/**
 * Associe chaque image « actual » d'un dossier test-results/ au chemin de sa capture de
 * référence, selon le snapshotPathTemplate de playwright.config.ts. Le fichier de test et le
 * projet viennent du rapport JSON que Playwright écrit en CI (rapport.json).
 * @param {string} resultsDir
 */
export const references = (resultsDir) => {
  /** @type {Suite} */
  const report = JSON.parse(
    readFileSync(path.join(resultsDir, 'rapport.json'), 'utf8'),
  );
  const attachments = specsOf(report).flatMap(({ file, tests }) =>
    tests.flatMap(({ projectName, results }) =>
      results.flatMap((result) =>
        result.attachments.map((attachment) => ({
          ...attachment,
          file,
          projectName,
        })),
      ),
    ),
  );
  return attachments
    .filter(({ name, path: actual }) => actual && name.endsWith(actualSuffix))
    .map(({ name, path: actual = '', file, projectName }) => {
      /** @type {Record<string, string>} */
      const tokens = {
        testDir: root,
        testFileDir: path.posix.dirname(file),
        testFileName: path.posix.basename(file),
        arg: name.slice(0, -actualSuffix.length),
        projectName,
        ext: '.png',
      };
      const to = template.replace(tokenPattern, (_, key) => tokens[key] ?? '');
      // Chemin absolu sur le runner : seule la partie sous test-results/ est dans l'artefact.
      const [, inArtifact] = actual.split('/test-results/');
      if (!inArtifact) throw new Error(`${actual} : hors de test-results/.`);
      return {
        from: path.join(resultsDir, inArtifact),
        to: path.normalize(to),
      };
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
      { stdio: 'inherit' },
    );
    if (download.status !== 0) {
      throw new Error(
        `artefact « playwright » du run ${run} introuvable (gh installé et connecté ? run en échec de moins de 7 jours ?).`,
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
