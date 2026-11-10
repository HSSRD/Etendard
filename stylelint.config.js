// Règles CSS de l'ADR 0004 : BEM imposé, aucune valeur en dur, propriétés ordonnées.

/** `MonBloc.astro` → bloc BEM `.mon-bloc` (`HeroCTA.astro` → `.hero-cta`), `__élément`, `--modificateur`. */
const bemSelector = (fileName) => {
  const block = fileName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
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
  'background-image',
  'border-image',
  '/^(scroll-)?(margin|padding)/',
  '/^inset/',
  '/^(top|right|bottom|left)$/',
  '/^(grid-)?(row-|column-)?gap$/',
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
      // Variables CSS libres : tokens surchargés ou variables locales au bloc.
      ignoreCustomProperties: '.*',
      implicitComponents: [
        'src/components/**/*.astro',
        'src/layouts/**/*.astro',
      ],
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
          '/^url[(]/',
          // Élément d'une liste de tokens : `var(--a), var(--b)`.
          '/^var[(]--[\\w-]+[)],$/',
        ],
        // Uniquement var(--…) : un calc() ou un clamp() se définit comme token.
        ignoreFunctions: false,
        expandShorthand: true,
      },
    ],
    // Raccourcis que le plugin ne sait pas développer : longhands obligatoires.
    'property-disallowed-list': [
      [
        'font',
        'text-decoration',
        '-webkit-text-stroke',
        '/^border-(block|inline)(-start|-end)?$/',
      ],
      { message: (p) => `« ${p} » : utilise les propriétés détaillées.` },
    ],
    // Pas de valeur de repli dans var() : elle contournerait les tokens.
    'declaration-property-value-disallowed-list': [
      { '/.*/': ['/var[(]\\s*--[\\w-]+\\s*,/'] },
      { message: 'Pas de valeur de repli dans var() : utilise un token.' },
    ],
    'order/order': ['custom-properties', 'declarations'],
    'order/properties-alphabetical-order': true,
  },
};
