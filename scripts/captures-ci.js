// Installe comme références les captures « actual » d'un run de ci.yml en échec, sans Docker :
// elles ont été produites par l'image de Playwright de la CI (ADR 0003), la commande ne fait que
// les recopier. Usage : pnpm captures:ci <id du run>
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import config from '../playwright.config.ts';

const actualSuffix = '-actual.png';

/**
 * Associe chaque image « actual » d'un dossier test-results/ au chemin de sa capture de
 * référence, selon le snapshotPathTemplate de playwright.config.ts. Playwright tronque le nom
 * des dossiers de résultats : le fichier de test est lu dans leur error-context.md, le projet
 * dans leur suffixe.
 * @param {string} resultsDir
 */
export const references = (resultsDir) =>
  readdirSync(resultsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap(({ name: folder }) => {
      const dir = path.join(resultsDir, folder);
      const images = readdirSync(dir).filter((file) =>
        file.endsWith(actualSuffix),
      );
      if (images.length === 0) return [];

      const project = config.projects
        ?.map(({ name }) => name)
        .find((name) => folder.endsWith(`-${name}`));
      if (!project) throw new Error(`${folder} : projet introuvable.`);
      const context = path.join(dir, 'error-context.md');
      const location = existsSync(context)
        ? readFileSync(context, 'utf8').match(
            /^- Location: (.+):\d+:\d+$/m,
          )?.[1]
        : undefined;
      if (!location)
        throw new Error(`${folder} : fichier de test introuvable.`);

      return images.map((image) => {
        const tokens = {
          testDir: '.',
          testFileDir: path.posix.dirname(location),
          testFileName: path.posix.basename(location),
          arg: image.slice(0, -actualSuffix.length),
          projectName: project,
          ext: '.png',
        };
        const to = config.snapshotPathTemplate?.replace(
          /\{(\w+)\}/g,
          (token, key) => {
            if (!(key in tokens)) {
              throw new Error(`snapshotPathTemplate : ${token} non géré.`);
            }
            return tokens[/** @type {keyof typeof tokens} */ (key)];
          },
        );
        if (!to) throw new Error('snapshotPathTemplate absent.');
        return { from: path.join(dir, image), to: path.normalize(to) };
      });
    });

if (import.meta.main) {
  const run = process.argv[2];
  if (!run || !/^\d+$/.test(run)) {
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
    if (download.error || download.status !== 0) {
      throw new Error(
        `artefact « playwright » du run ${run} introuvable (gh installé et connecté ? run en échec de moins de 7 jours ?).`,
      );
    }
    const copies = references(dir);
    for (const { from, to } of copies) {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      console.log(to);
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
