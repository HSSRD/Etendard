import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Chaque dépendance directe a sa ligne dans docs/dependances.md, et ses versions suivent ADR 0013.
const read = (path: string) => readFileSync(path, 'utf8');
const { dependencies, devDependencies } = JSON.parse(read('package.json'));
const declared: Record<string, string> = {
  ...dependencies,
  ...devDependencies,
};

/** Noms de la première colonne des lignes du tableau qui suit le titre `### <field>`. */
const documented = (doc: string, field: string) => {
  const start = doc.indexOf(`\n### ${field}\n`);
  const end = doc.indexOf('\n#', start + 1);
  return [...doc.slice(start, end).matchAll(/^\| `([^`]+)` +\|/gm)]
    .map((match) => match[1])
    .toSorted();
};

test('docs/dependances.md a une ligne par dépendance, dans le tableau de son champ', () => {
  const doc = read('docs/dependances.md');

  expect(documented(doc, 'dependencies')).toEqual(
    Object.keys(dependencies).toSorted(),
  );
  expect(documented(doc, 'devDependencies')).toEqual(
    Object.keys(devDependencies).toSorted(),
  );
});

test('une version est exacte, sauf la plage que pose `expo install` pour le SDK', () => {
  const sdk: Record<string, string> = JSON.parse(
    read('node_modules/expo/bundledNativeModules.json'),
  );
  // Posés par `expo install` hors de bundledNativeModules.json : le SDK lui-même et l'outillage TypeScript.
  const fromExpoInstall = new Set(['expo', 'typescript', '@types/react']);
  // Opérateur et version mineure : une mise à jour d'Expo peut relever le correctif sans changer package.json.
  const minor = (version: string) =>
    /^([~^]?\d+\.\d+)\.\d+$/.exec(version)?.[1];
  const offRule = Object.entries(declared).filter(([name, version]) => {
    if (Object.hasOwn(sdk, name)) {
      return (
        minor(version) === undefined ||
        minor(version) !== minor(sdk[name] ?? '')
      );
    }
    if (fromExpoInstall.has(name)) return !/^~\d+\.\d+\.\d+$/.test(version);
    return !/^\d+\.\d+\.\d+$/.test(version);
  });

  expect(offRule).toEqual([]);
});
