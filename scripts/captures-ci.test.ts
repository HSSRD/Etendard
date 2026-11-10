import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { references } from './captures-ci.js';

const repo = path.resolve(import.meta.dirname, '..');
// Racine du repo sur le runner de la CI, comme dans les rapports réels.
const ci = '/__w/Etendard/Etendard';
const projects = ['chromium-375', 'chromium-1280'].map((name) => ({
  name,
  outputDir: `${ci}/test-results`,
}));

// Dossier test-results/ tel que l'artefact « playwright » de ci.yml le contient.
let resultsDir = '';
beforeEach(() => {
  resultsDir = mkdtempSync(path.join(tmpdir(), 'captures-ci-test-'));
});
afterEach(() => rmSync(resultsDir, { recursive: true, force: true }));

/**
 * Pièces jointes d'une capture en écart ou manquante : `-expected` pointe sur la référence,
 * `-actual` et `-diff` dans test-results/ (Playwright 1.64).
 */
const capture = (folder: string, reference: string, base: string) => [
  { name: `${base}-expected.png`, path: `${ci}/${reference}` },
  {
    name: `${base}-actual.png`,
    path: `${ci}/test-results/${folder}/${base}-actual.png`,
  },
  {
    name: `${base}-diff.png`,
    path: `${ci}/test-results/${folder}/${base}-diff.png`,
  },
];

const writeReport = (tests: { projectName: string; attachments: object[] }[]) =>
  writeFileSync(
    path.join(resultsDir, 'rapport.json'),
    JSON.stringify({
      config: { rootDir: ci, projects },
      // Suites imbriquées, comme pour un describe.
      suites: [
        {
          suites: [
            {
              specs: [
                {
                  tests: tests.map(({ projectName, attachments }) => ({
                    projectName,
                    results: [{ attachments }],
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
  );

const copies = () =>
  references(resultsDir).map(({ from, to }) => ({
    from: path.relative(resultsDir, from).replaceAll('\\', '/'),
    to: path.relative(repo, to).replaceAll('\\', '/'),
  }));

test('chaque image « actual » va au chemin de sa capture de référence', () => {
  const hero = 'src-components-Hero-1a2b3-chromium-375';
  writeReport([
    {
      projectName: 'chromium-375',
      attachments: [
        ...capture(
          hero,
          'src/components/__captures__/Hero.spec.ts/hero-light-chromium-375.png',
          'hero-light',
        ),
        // Référence manquante : -expected pointe sur la capture à créer.
        ...capture(
          hero,
          'src/components/__captures__/Hero.spec.ts/hero-light-hover-chromium-375.png',
          'hero-light-hover',
        ),
        // Nouvelle capture instable : pas de -expected, rien à installer.
        {
          name: 'hero-light-focus-actual.png',
          path: `${ci}/test-results/${hero}/hero-light-focus-actual.png`,
        },
        { name: 'trace', path: `${ci}/test-results/${hero}/trace.zip` },
        { name: 'stdout' },
      ],
    },
    { projectName: 'chromium-1280', attachments: [] },
  ]);

  expect(copies()).toEqual([
    {
      from: `${hero}/hero-light-actual.png`,
      to: 'src/components/__captures__/Hero.spec.ts/hero-light-chromium-375.png',
    },
    {
      from: `${hero}/hero-light-hover-actual.png`,
      to: 'src/components/__captures__/Hero.spec.ts/hero-light-hover-chromium-375.png',
    },
  ]);
});

test('un chemin hors du repo ou de test-results/ fait échouer la commande', () => {
  writeReport([
    {
      projectName: 'chromium-375',
      attachments: [
        { name: 'x-expected.png', path: '/etc/x.png' },
        { name: 'x-actual.png', path: `${ci}/test-results/d/x-actual.png` },
      ],
    },
  ]);
  expect(copies).toThrow(/hors de \/__w\/Etendard\/Etendard\./);

  writeReport([
    {
      projectName: 'chromium-375',
      attachments: [
        { name: 'x-expected.png', path: `${ci}/src/x.png` },
        { name: 'x-actual.png', path: '/home/runner/.ssh/x-actual.png' },
      ],
    },
  ]);
  expect(copies).toThrow(/hors de \/__w\/Etendard\/Etendard\/test-results\./);
});

test('sans rapport.json, la commande échoue', () => {
  expect(copies).toThrow(/rapport\.json/);
});
