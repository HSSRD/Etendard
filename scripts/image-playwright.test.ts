import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// ci.yml, deploy.yml et captures:maj doivent utiliser l'image de la version installée (ADR 0003).
const read = (path: string) => readFileSync(path, 'utf8');
const images = (path: string) =>
  [...read(path).matchAll(/image: (mcr\.microsoft\.com\/playwright:\S+)/g)].map(
    (match) => match[1],
  );

test('les workflows utilisent la même image Playwright que package.json', () => {
  const { devDependencies } = JSON.parse(read('package.json'));
  const ci = images('.github/workflows/ci.yml');
  const deploy = images('.github/workflows/deploy.yml');

  expect(ci).toHaveLength(1);
  expect(deploy).toEqual(ci);
  expect(ci[0]).toMatch(
    new RegExp(
      `:v${devDependencies['@playwright/test']}-noble@sha256:[0-9a-f]{64}$`,
    ),
  );
});
