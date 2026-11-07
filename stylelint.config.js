// Règles CSS de l'ADR 0004 : BEM imposé, aucune valeur en dur, propriétés ordonnées.

/** `MonBloc.astro` → bloc BEM `.mon-bloc`, éléments `__x`, modificateurs `--y`. */
const bemSelector = (fileName) => {
  const block = fileName.replace(/(?<!^)[A-Z]/g, (c) => `-${c}`).toLowerCase();
  const word = '[a-z0-9]+(?:-[a-z0-9]+)*';
  return new RegExp(
    String.raw`^\.${block}(?:__${word})?(?:--${word})?(?:\[[^\]]+\])*$`,
  );
};

// Les raccourcis (background, border, outline…) sont développés puis vérifiés.
const strictProperties = [
  '/color$/',
  'fill',
  'stroke',
  'box-shadow',
  'text-shadow',
  '/^(margin|padding|inset)/',
  '/^(top|right|bottom|left)$/',
  '/^(row-|column-)?gap$/',
  'font-size',
];

/** @type {import('stylelint').Config} */
export default {
  plugins: [
    'stylelint-selector-bem-pattern',
    'stylelint-declaration-strict-value',
    'stylelint-order',
  ],
  overrides: [{ files: ['**/*.astro'], customSyntax: 'postcss-html' }],
  rules: {
    'plugin/selector-bem-pattern': {
      componentName: '^[A-Z][a-zA-Z0-9]*$',
      componentSelectors: bemSelector,
      implicitComponents: ['src/components/**/*.astro'],
    },
    'scale-unlimited/declaration-strict-value': [
      strictProperties,
      {
        ignoreValues: [
          'inherit',
          'initial',
          'unset',
          '/^currentcolor$/i',
          'transparent',
          'none',
          'auto',
          '0',
        ],
        // Uniquement var(--…) : un calc() ou un clamp() se définit comme token.
        ignoreFunctions: false,
        expandShorthand: true,
      },
    ],
    'order/order': ['custom-properties', 'declarations'],
    'order/properties-alphabetical-order': true,
  },
};
