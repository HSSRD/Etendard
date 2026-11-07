// Régénère les captures de référence dans l'image Docker officielle de Playwright,
// exactement celle de la CI (ADR 0003). Usage : pnpm captures:maj [fichiers…]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`captures:maj : ${message}`);
  process.exit(1);
};

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const image = readFileSync('.github/workflows/ci.yml', 'utf8').match(
  /image: (mcr\.microsoft\.com\/playwright:v(\S+?)-noble@sha256:\w+)/,
);
if (!image) fail('image Playwright introuvable dans ci.yml.');
if (image[2] !== pkg.devDependencies['@playwright/test']) {
  fail(
    `ci.yml utilise Playwright ${image[2]}, package.json ${pkg.devDependencies['@playwright/test']}.`,
  );
}

const docker = (args, options) => spawnSync('docker', args, options);
// `{{json .}}` fonctionne avec Docker comme avec Podman (alias docker=podman).
const info = docker(['info', '--format', '{{json .}}'], { encoding: 'utf8' });
if (info.error || info.status !== 0) {
  fail(
    'Docker est introuvable ou arrêté. La CI (ci.yml) reste l’arbitre des captures.',
  );
}

/**
 * Root du conteneur est-il root de l'hôte ? Non avec Docker rootless, userns-remap,
 * Docker Desktop (VM) ou Podman rootless : root y est déjà l'utilisateur hôte.
 */
const rootIsHostRoot = (() => {
  const {
    host,
    SecurityOptions = [],
    OperatingSystem = '',
  } = JSON.parse(info.stdout);
  if (host) return !host.security?.rootless; // Podman
  return (
    !OperatingSystem.includes('Docker Desktop') &&
    !SecurityOptions.some((option) => /rootless|userns/.test(option))
  );
})();

const pnpm = `npx --yes ${pkg.packageManager}`;
// L'image fournit déjà Node 26 ; on y installe des dépendances compilées pour Linux.
let script = `${pnpm} install --frozen-lockfile && ${pnpm} exec playwright test --update-snapshots=changed "$@"`;

// Sous Linux, rend à l'utilisateur les fichiers créés par root dans le repo monté.
if (process.getuid && rootIsHostRoot) {
  const owner = `${process.getuid()}:${process.getgid()}`;
  script = `${script}; status=$?; find /work -path /work/node_modules -prune -o -user 0 -exec chown ${owner} {} +; exit $status`;
}

const run = docker(
  [
    'run',
    '--rm',
    '--init',
    '--ipc=host',
    // Même architecture que la CI : le rendu de Chromium diffère sur arm64.
    '--platform=linux/amd64',
    '-v',
    `${process.cwd()}:/work`,
    // node_modules propre au conteneur : celui de l'hôte peut être compilé pour Windows.
    '-v',
    '/work/node_modules',
    // Caches npm et pnpm conservés d'un lancement à l'autre (volumes nommés).
    '-v',
    'etendard-captures-npm:/root/.npm',
    '-v',
    'etendard-captures-pnpm:/root/.local/share/pnpm',
    '-w',
    '/work',
    image[1],
    'sh',
    '-c',
    script,
    'sh',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
if (run.error) fail(run.error.message);
process.exit(run.status ?? 1);
