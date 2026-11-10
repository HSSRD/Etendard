import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { references } from './captures-ci.js';

// Dossier test-results/ tel que l'artefact « playwright » de ci.yml le contient.
const resultsDir = mkdtempSync(path.join(tmpdir(), 'captures-ci-test-'));
afterEach(() => rmSync(resultsDir, { recursive: true, force: true }));

const result = (folder: string, location: string, files: string[]) => {
  const dir = path.join(resultsDir, folder);
  mkdirSync(dir, { recursive: true });
  if (location) {
    writeFileSync(
      path.join(dir, 'error-context.md'),
      `# Test info\n\n- Name: x\n- Location: ${location}\n`,
    );
  }
  for (const file of files) writeFileSync(path.join(dir, file), '');
};

test('chaque image « actual » va au chemin de sa capture de référence', () => {
  // Nom de dossier tronqué par Playwright, comme dans les artefacts réels.
  result(
    'src-components-Hero-1a2b3-ht-contenu-accessibilité-et-capture-chromium-375',
    'src/components/Hero.spec.ts:16:3',
    [
      'hero-light-actual.png',
      'hero-light-expected.png',
      'hero-light-diff.png',
      'hero-light-hover-actual.png',
    ],
  );
  result(
    'tests-accueil-le-lien-d-évitement-apparaît-au-clavier-et-mène-au-contenu-chromium-1280',
    'tests/accueil.spec.ts:25:1',
    ['lien-evitement-light-actual.png', 'lien-evitement-dark-actual.png'],
  );
  // Échec sans capture : rien à installer, error-context.md non requis.
  result('tests-accueil-la-page-chromium-768', '', ['trace.zip']);

  const copies = references(resultsDir).map(({ from, to }) => ({
    from: path.relative(resultsDir, from).replaceAll('\\', '/'),
    to: to.replaceAll('\\', '/'),
  }));
  expect(copies).toEqual([
    {
      from: 'src-components-Hero-1a2b3-ht-contenu-accessibilité-et-capture-chromium-375/hero-light-actual.png',
      to: 'src/components/__captures__/Hero.spec.ts/hero-light-chromium-375.png',
    },
    {
      from: 'src-components-Hero-1a2b3-ht-contenu-accessibilité-et-capture-chromium-375/hero-light-hover-actual.png',
      to: 'src/components/__captures__/Hero.spec.ts/hero-light-hover-chromium-375.png',
    },
    {
      from: 'tests-accueil-le-lien-d-évitement-apparaît-au-clavier-et-mène-au-contenu-chromium-1280/lien-evitement-dark-actual.png',
      to: 'tests/__captures__/accueil.spec.ts/lien-evitement-dark-chromium-1280.png',
    },
    {
      from: 'tests-accueil-le-lien-d-évitement-apparaît-au-clavier-et-mène-au-contenu-chromium-1280/lien-evitement-light-actual.png',
      to: 'tests/__captures__/accueil.spec.ts/lien-evitement-light-chromium-1280.png',
    },
  ]);
  // Ce sont bien les références existantes que Playwright compare.
  for (const { to } of copies) expect(existsSync(to)).toBe(true);
});

test('un dossier sans error-context.md fait échouer la commande', () => {
  result('src-components-Hero-1a2b3-chromium-375', '', [
    'hero-light-actual.png',
  ]);
  expect(() => references(resultsDir)).toThrow(/fichier de test introuvable/);
});
