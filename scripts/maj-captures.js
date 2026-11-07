// Régénère les captures de référence dans l'image Docker officielle de Playwright,
// à la version de @playwright/test installée (ADR 0003). Usage : pnpm captures:maj [fichiers…]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('@playwright/test/package.json');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const pnpm = pkg.packageManager.replace(/^pnpm@/, '');
const node = readFileSync('.nvmrc', 'utf8').trim();

const { status } = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '-v',
    `${process.cwd()}:/work`,
    // node_modules propre au conteneur : celui de l'hôte peut être compilé pour Windows.
    '-v',
    '/work/node_modules',
    '-w',
    '/work',
    '-e',
    `PNPM_VERSION=${pnpm}`,
    '-e',
    `NODE_VERSION=${node}`,
    `mcr.microsoft.com/playwright:v${version}-noble`,
    'sh',
    'scripts/captures-docker.sh',
    '--update-snapshots',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
process.exit(status ?? 1);
