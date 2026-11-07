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
const info = docker(['info'], { stdio: 'ignore' });
if (info.error || info.status !== 0) {
  fail(
    'Docker est introuvable ou arrêté. La CI (ci.yml) reste l’arbitre des captures.',
  );
}

const pnpm = `npx --yes ${pkg.packageManager}`;
// À la sortie, même interrompue, les fichiers créés par root dans le repo monté reprennent
// le propriétaire du repo tel que le conteneur le voit (sans effet si c'est déjà root).
// L'image fournit déjà Node 26 ; on y installe des dépendances compilées pour Linux.
const script = [
  'set -e',
  'owner=$(stat -c %u:%g /work)',
  "trap 'find /work -path /work/node_modules -prune -o -user 0 -exec chown $owner {} +' EXIT",
  "trap 'exit 130' INT TERM",
  `${pnpm} install --frozen-lockfile --store-dir /pnpm-store`,
  `${pnpm} exec playwright test --update-snapshots=changed "$@"`,
].join('\n');

// Playwright lit les fichiers comme des motifs, avec des « / » (chemins Windows sinon).
const files = process.argv.slice(2).map((file) => file.replaceAll('\\', '/'));

const run = docker(
  [
    'run',
    '--rm',
    '--init',
    // Ctrl+C arrête tout le conteneur (pnpm, Playwright), pas seulement sh.
    '-e',
    'TINI_KILL_PROCESS_GROUP=1',
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
    'etendard-captures-pnpm:/pnpm-store',
    '-w',
    '/work',
    image[1],
    'sh',
    '-c',
    script,
    'sh',
    ...files,
  ],
  { stdio: 'inherit' },
);
if (run.error) fail(run.error.message);
process.exit(run.status ?? 1);
