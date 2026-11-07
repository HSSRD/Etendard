// @ts-check
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Un composant n'importe jamais une page (ADR 0005). dependency-cruiser ne lit pas
// les .astro : la règle est imposée ici, pour import, import() et import.meta.glob.
// « / » s'écrit \x2F : les sélecteurs ESLint (esquery) ne l'acceptent pas tel quel.
// Couvre `../pages`, `../../src/pages`, `@/pages` et la forme Vite `/src/pages`.
const pagePattern = String.raw`^((\.\.\x2F)+(src\x2F)?|@\x2F|\x2Fsrc\x2F)pages(\x2F|$)`;
const pageMessage = 'Un composant ou un layout n’importe jamais une page.';

// Pas d'accès à l'environnement Node dans src/ : utilise import.meta.env.
const nodeImports = ['process', 'node:process', 'buffer', 'node:buffer'].map(
  (name) => ({ name, message: 'Utilise import.meta.env.' }),
);

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
      'no-restricted-imports': ['error', { paths: nodeImports }],
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
    files: ['src/components/**', 'src/layouts/**'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeImports,
          patterns: [
            { regex: pagePattern, caseSensitive: true, message: pageMessage },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...[
          `ImportExpression > Literal[value=/${pagePattern}/]`,
          `ImportExpression > TemplateLiteral > TemplateElement[value.raw=/${pagePattern}/]`,
          `CallExpression[callee.property.name='glob'] Literal[value=/${pagePattern}/]`,
        ].map((selector) => ({ selector, message: pageMessage })),
      ],
    },
  },
);
