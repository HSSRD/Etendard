// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Un composant ou un layout n'importe jamais une page (ADR 0005) ; les pages sont dans src/app/.
// dependency-cruiser l'impose aussi ; la règle reste ici pour import() dynamique.
// « / » s'écrit \x2F : les sélecteurs ESLint (esquery) ne l'acceptent pas tel quel.
const pagePattern = String.raw`^((\.\.\x2F)+(src\x2F)?|@\x2F|\x2Fsrc\x2F)app(\x2F|$)`;
const pageMessage = 'Un composant ou un layout n’importe jamais une page.';

// Pas d'accès à l'environnement Node dans src/.
const nodeImports = ['process', 'node:process', 'buffer', 'node:buffer'].map(
  (name) => ({ name, message: 'Pas de module Node dans l’app.' }),
);

// Aucune valeur en dur dans les styles (ADR 0015) : dans StyleSheet.create et themedStyles,
// un nombre autre que 0 ou 1, ou une couleur littérale, passe par un token (src/theme/tokens.ts).
const styleCalls = [
  "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
  "CallExpression[callee.name='themedStyles']",
];
const hardCoded = styleCalls
  .flatMap((call) => [
    {
      selector: `${call} Property > Literal[value=/^(?:#|rgba?[(]|hsla?[(])/i]`,
      message: 'Couleur en dur : utilise un token de src/theme/tokens.ts.',
    },
    {
      selector: `${call} Property > Literal[raw=/^[0-9.]+$/][value!=0][value!=1]`,
      message: 'Valeur en dur : utilise un token de src/theme/tokens.ts.',
    },
    {
      selector: `${call} Property > UnaryExpression[operator='-'] > Literal`,
      message: 'Valeur en dur : utilise un token de src/theme/tokens.ts.',
    },
  ])
  .concat({
    // Sur le web, un objet de style en ligne devient un attribut style, refusé par la CSP.
    selector: "JSXAttribute[name.name='style'] ObjectExpression",
    message: 'Style en ligne : passe par StyleSheet.create ou themedStyles.',
  });

export default defineConfig(
  {
    ignores: [
      'dist/',
      'dist-styleguide/',
      'dist-natif/',
      '.expo/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },
  // Le site tourne dans le navigateur et les apps ; seuls l'outillage et les tests tournent sous Node.
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
      'no-restricted-syntax': ['error', ...hardCoded],
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
        ...hardCoded,
        ...[
          `ImportExpression > Literal[value=/${pagePattern}/]`,
          `ImportExpression > TemplateLiteral > TemplateElement[value.raw=/${pagePattern}/]`,
        ].map((selector) => ({ selector, message: pageMessage })),
      ],
    },
  },
);
