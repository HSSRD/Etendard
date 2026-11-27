// Échoue si un export contient une route du styleguide (ADR 0003, metro.config.js).
// Usage : node scripts/sans-styleguide.js <dossier>...
// Une route se lit à sa clé dans la require.context d'Expo Router (« ./styleguide/hero.tsx »), en
// clair dans le JavaScript du web comme dans le bytecode Hermes. Toute page exportée sous
// /styleguide en suppose une.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Fichiers de `dir`, sous-dossiers compris, qui contiennent une route du styleguide. */
export const styleguideRoutes = (/** @type {string} */ dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => readFileSync(file).includes('styleguide/'));

if (import.meta.main) {
  const files = process.argv.slice(2).flatMap(styleguideRoutes);
  if (files.length > 0) {
    console.error(
      `Route du styleguide hors STYLEGUIDE=1 :\n${files.join('\n')}`,
    );
    process.exit(1);
  }
}
