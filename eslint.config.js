// @ts-check
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

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
  { languageOptions: { globals: globals.node } },
  {
    // dependency-cruiser ne lit pas les .astro : la règle « un composant n'importe
    // jamais une page » (ADR 0005) est aussi imposée ici.
    files: ['src/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/pages/**', '@/pages/**'],
              message: 'Un composant n’importe jamais une page.',
            },
          ],
        },
      ],
    },
  },
);
