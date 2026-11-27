import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, onTestFinished, test } from 'vitest';
import { styleguideRoutes } from './sans-styleguide.js';

test('trouve une clé de route du styleguide, même dans un sous-dossier', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sans-styleguide-'));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'ios'));
  const bundle = path.join(dir, 'ios', 'entry.hbc');
  writeFileSync(bundle, 'route\0./styleguide/hero.tsx\0');
  writeFileSync(path.join(dir, 'index.js'), 'route("./projets/dragon.tsx")');

  expect(styleguideRoutes(dir)).toEqual([bundle]);
});
