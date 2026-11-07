// Régénère les captures de référence dans l'image Docker officielle de Playwright,
// à la version de @playwright/test (ADR 0003). Usage : pnpm captures:maj [fichiers…]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const playwright = pkg.devDependencies['@playwright/test'];
const pnpm = pkg.packageManager.replace(/^pnpm@/, '');

// L'image fournit déjà Node ; on y installe pnpm et des dépendances compilées pour Linux.
const script = `npm install --global --silent pnpm@${pnpm} && pnpm install --frozen-lockfile && pnpm exec playwright test --update-snapshots "$@"`;

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
    `mcr.microsoft.com/playwright:v${playwright}-noble`,
    'sh',
    '-c',
    script,
    'sh',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
process.exit(status ?? 1);
