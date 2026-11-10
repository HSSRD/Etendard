import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { references } from './captures-ci.js';

// Dossier test-results/ tel que l'artefact « playwright » de ci.yml le contient.
let resultsDir = '';
beforeEach(() => {
  resultsDir = mkdtempSync(path.join(tmpdir(), 'captures-ci-test-'));
});
afterEach(() => rmSync(resultsDir, { recursive: true, force: true }));

/** Pièces jointes d'un résultat, avec leur chemin absolu sur le runner de la CI. */
const attachments = (folder: string, names: string[]) =>
  names.map((name) => ({
    name,
    path: `/__w/Etendard/Etendard/test-results/${folder}/${name}`,
  }));

test('chaque image « actual » va au chemin de sa capture de référence', () => {
  // Extrait du rapport JSON de Playwright : suites imbriquées, un test par projet.
  const report = {
    suites: [
      {
        specs: [
          {
            file: 'src/components/Hero.spec.ts',
            tests: [
              {
                projectName: 'chromium-375',
                results: [
                  {
                    attachments: [
                      ...attachments('src-components-Hero-1a2b3-chromium-375', [
                        'hero-light-actual.png',
                        'hero-light-expected.png',
                        'hero-light-diff.png',
                        'hero-light-hover-actual.png',
                      ]),
                      { name: 'trace', path: '/tmp/trace.zip' },
                      { name: 'stdout' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        suites: [
          {
            specs: [
              {
                file: 'tests/accueil.spec.ts',
                tests: [
                  {
                    projectName: 'chromium-1280',
                    results: [
                      {
                        attachments: attachments(
                          'tests-accueil-le-lien-d-évitement-chromium-1280',
                          ['lien-evitement-dark-actual.png'],
                        ),
                      },
                    ],
                  },
                  // Test réussi : aucune capture à installer.
                  {
                    projectName: 'chromium-768',
                    results: [{ attachments: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  writeFileSync(path.join(resultsDir, 'rapport.json'), JSON.stringify(report));

  const copies = references(resultsDir).map(({ from, to }) => ({
    from: path.relative(resultsDir, from).replaceAll('\\', '/'),
    to: to.replaceAll('\\', '/'),
  }));
  expect(copies).toEqual([
    {
      from: 'src-components-Hero-1a2b3-chromium-375/hero-light-actual.png',
      to: 'src/components/__captures__/Hero.spec.ts/hero-light-chromium-375.png',
    },
    {
      from: 'src-components-Hero-1a2b3-chromium-375/hero-light-hover-actual.png',
      to: 'src/components/__captures__/Hero.spec.ts/hero-light-hover-chromium-375.png',
    },
    {
      from: 'tests-accueil-le-lien-d-évitement-chromium-1280/lien-evitement-dark-actual.png',
      to: 'tests/__captures__/accueil.spec.ts/lien-evitement-dark-chromium-1280.png',
    },
  ]);
  // Ce sont bien les références existantes que Playwright compare.
  for (const { to } of copies) expect(existsSync(to)).toBe(true);
});

test('sans rapport.json, la commande échoue', () => {
  expect(() => references(resultsDir)).toThrow(/rapport\.json/);
});
