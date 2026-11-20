// Lance les tests de infra/pi/test/ (*.test.sh). Usage : pnpm test:infra
// Sous Windows, pnpm passe par cmd, où `bash` est absent ou désigne WSL : on prend le
// bash de Git (bin/bash.exe met ses outils GNU en tête du PATH, avant tar.exe et find.exe).
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const bash =
  process.platform === 'win32'
    ? resolve(
        execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
        '../../../bin/bash.exe',
      )
    : 'bash';

let failed = false;
for (const test of readdirSync('infra/pi/test').filter((f) =>
  f.endsWith('.test.sh'),
)) {
  const { error, status } = spawnSync(bash, [`infra/pi/test/${test}`], {
    stdio: 'inherit',
  });
  if (error) {
    console.error(`test:infra : ${bash} introuvable (${error.message}).`);
  }
  failed ||= status !== 0;
}
process.exit(failed ? 1 : 0);
