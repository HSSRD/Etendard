// Lance les tests de infra/pi/etendard-receive. Usage : pnpm test:infra
// Sous Windows, pnpm passe par cmd, où `bash` est absent ou désigne WSL : on prend le
// bash de Git (bin/bash.exe met ses outils GNU en tête du PATH, avant tar.exe et find.exe).
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const bash =
  process.platform === 'win32'
    ? resolve(
        execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
        '../../../bin/bash.exe',
      )
    : 'bash';

const { error, status } = spawnSync(
  bash,
  ['infra/pi/test/etendard-receive.test.sh'],
  { stdio: 'inherit' },
);
if (error) {
  console.error(`test:infra : ${bash} introuvable (${error.message}).`);
}
process.exit(status ?? 1);
