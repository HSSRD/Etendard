// Régénère les captures de référence dans l'image Docker officielle de Playwright,
// à la version de @playwright/test (ADR 0003). Usage : pnpm captures:maj [fichiers…]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const playwright = pkg.devDependencies['@playwright/test'];
const pnpm = `npx --yes ${pkg.packageManager}`;

// L'image fournit déjà Node 26 ; on y installe des dépendances compilées pour Linux.
let script = `${pnpm} install --frozen-lockfile && ${pnpm} exec playwright test --update-snapshots=changed "$@"`;

// Sous Linux, rend à l'utilisateur courant les fichiers créés par root dans le repo monté.
if (process.getuid) {
  const owner = `${process.getuid()}:${process.getgid()}`;
  script = `${script}; status=$?; find /work -path /work/node_modules -prune -o -user 0 -exec chown ${owner} {} +; exit $status`;
}

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
