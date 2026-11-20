import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Chaque dépendance directe a sa ligne dans docs/dependances.md, et ses versions suivent ADR 0013.
const read = (path: string) => readFileSync(path, 'utf8');
const { dependencies, devDependencies } = JSON.parse(read('package.json'));
const declared: Record<string, string> = {
  ...dependencies,
  ...devDependencies,
};

test('docs/dependances.md a une ligne par dépendance de package.json, et pas plus', () => {
  const doc = read('docs/dependances.md');
  const section = doc.slice(
    doc.indexOf('\n## Dépendances\n'),
    doc.indexOf('\n## Configuration'),
  );
  const documented = [...section.matchAll(/^\| `([^`]+)` +\|/gm)].map(
    (match) => match[1],
  );

  expect(documented.toSorted()).toEqual(Object.keys(declared).toSorted());
});

test('une version est exacte, sauf la plage que pose `expo install` pour le SDK', () => {
  const sdk: Record<string, string> = JSON.parse(
    read('node_modules/expo/bundledNativeModules.json'),
  );
  // Posés par `expo install` hors de bundledNativeModules.json : le SDK lui-même et l'outillage TypeScript.
  const fromExpoInstall = ['expo', 'typescript', '@types/react'];
  const offRule = Object.entries(declared).filter(
    ([name, version]) =>
      !/^\d+\.\d+\.\d+$/.test(version) &&
      sdk[name] !== version &&
      !(fromExpoInstall.includes(name) && version.startsWith('~')),
  );

  expect(offRule).toEqual([]);
});
