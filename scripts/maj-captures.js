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
const info = docker(['info', '--format', '{{json .SecurityOptions}}'], {
  encoding: 'utf8',
});
if (info.error || info.status !== 0) {
  fail(
    'Docker est introuvable ou arrêté. La CI (ci.yml) reste l’arbitre des captures.',
  );
}

const pnpm = `npx --yes ${pkg.packageManager}`;
// L'image fournit déjà Node 26 ; on y installe des dépendances compilées pour Linux.
let script = `${pnpm} install --frozen-lockfile && ${pnpm} exec playwright test --update-snapshots=changed "$@"`;

// Docker « rootful » sous Linux : rend à l'utilisateur les fichiers créés par root.
// En rootless (ou Podman), root du conteneur est déjà l'utilisateur hôte.
if (process.getuid && !info.stdout.includes('rootless')) {
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
