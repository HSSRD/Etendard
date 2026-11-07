// @ts-check
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Un composant n'importe jamais une page (ADR 0005). dependency-cruiser ne lit pas
// les .astro : la règle est imposée ici, imports statiques et dynamiques compris.
// Pas de « / » dans le motif : les sélecteurs ESLint (esquery) ne l'acceptent pas.
const pagePattern = String.raw`(^|\W)pages(\W|$)`;

export default defineConfig(
  {
    ignores: [
      'dist/',
      'dist-styleguide/',
      '.astro/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  astro.configs['jsx-a11y-strict'],
  // Le site tourne dans le navigateur ; seuls l'outillage et les tests tournent sous Node.
  // `no-undef` est coupé sur le TypeScript et @types/node est chargé pour l'outillage :
  // les globales Node sont donc interdites explicitement (utilise import.meta.env).
  {
    files: ['src/**'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-globals': [
        'error',
        'process',
        'Buffer',
        'global',
        'require',
        '__dirname',
        '__filename',
      ],
    },
  },
  {
    files: [
      '*.config.*',
      '.dependency-cruiser.cjs',
      'scripts/**',
      'tests/**',
      '**/*.spec.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: pagePattern,
              message: 'Un composant n’importe jamais une page.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportExpression[source.value=/${pagePattern}/]`,
          message: 'Un composant n’importe jamais une page.',
        },
      ],
    },
  },
);
