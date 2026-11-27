import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { styleguideRoutes } from './sans-styleguide.js';

test('trouve une clé de route du styleguide, même dans un sous-dossier', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sans-styleguide-'));
  mkdirSync(path.join(dir, 'ios'));
  const bundle = path.join(dir, 'ios', 'entry.hbc');
  writeFileSync(bundle, 'route\0./styleguide/hero.tsx\0');
  // Reste dans le site : BaseLayout.web.tsx reconnaît une adresse du styleguide.
  writeFileSync(path.join(dir, 'common.js'), 'j=/^\\/styleguide(\\/|$)/;');

  expect(styleguideRoutes(dir)).toEqual([bundle]);
});
