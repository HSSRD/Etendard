// Règles CSS de l'ADR 0004 : BEM imposé, aucune valeur en dur, propriétés ordonnées.

/** `MonBloc.astro` → bloc BEM `.mon-bloc`, éléments `__x`, modificateurs `--y`. */
const bemSelector = (fileName) => {
  const block = fileName.replace(/(?<!^)[A-Z]/g, (c) => `-${c}`).toLowerCase();
  const word = '[a-z0-9]+(?:-[a-z0-9]+)*';
  return new RegExp(
    String.raw`^\.${block}(?:__${word})?(?:--${word})?(?:\[.+\])?$`,
  );
};

const colors = ['/color$/', 'fill', 'stroke'];
const spacings = ['/^(margin|padding|inset)/', '/^(row-|column-)?gap$/'];
const strictProperties = [...colors, ...spacings, 'font-size'];

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
          'currentColor',
          'transparent',
          'none',
          'auto',
          '0',
        ],
        // Couleurs : uniquement var(--…), jamais rgb()/hsl(). Ailleurs, calc()/clamp() de tokens.
        ignoreFunctions: Object.fromEntries(
          strictProperties.map((p) => [p, !colors.includes(p)]),
        ),
      },
    ],
    'order/order': ['custom-properties', 'declarations'],
    'order/properties-alphabetical-order': true,
  },
};
