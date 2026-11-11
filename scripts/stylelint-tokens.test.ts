import stylelint from 'stylelint';
import { expect, test } from 'vitest';

// ADR 0004 : chaque famille de tokens refuse une valeur en dur dans un composant.
const lint = async (declarations: string[]) => {
  const { results } = await stylelint.lint({
    code: `<style>\n  .foo {\n${declarations.map((d) => `    ${d}`).join('\n')}\n  }\n</style>\n`,
    codeFilename: 'src/components/Foo.astro',
  });
  return results[0]?.warnings ?? [];
};

test('signale chaque valeur en dur et chaque raccourci non vérifiable', async () => {
  const declarations = [
    'animation: spin linear 1s;',
    'animation-delay: 1s;',
    'animation-duration: 1s;',
    'background: #f00 url(x.png);',
    'border: solid 2px var(--color-border);',
    'border-radius: 4px;',
    'border-radius: 4px/8px;',
    'border-top: solid 2px var(--color-border);',
    'border-top-left-radius: 4px;',
    'border-top-width: 2px;',
    'border-width: 2px;',
    'column-rule: var(--color-border) 2px;',
    'column-rule-width: 2px;',
    'font-family: Arial;',
    'font-weight: 700;',
    'line-height: 1.2;',
    'outline: var(--color-focus) solid 2px;',
    'outline-offset: 2px;',
    'outline-width: 2px;',
    'scroll-padding: 2px;',
    'scroll-padding-block: 2px 4px;',
    'scroll-padding-inline: 2px;',
    'transition: opacity var(--duration-fast) ease, transform 200ms ease;',
    'transition-delay: 100ms;',
    'transition-duration: 200ms;',
    'z-index: 5;',
  ];
  // L'ordre alphabétique n'est pas ce qui est testé : il signalerait une ligne à tort.
  const flaggedLines = new Set(
    (await lint(declarations))
      .filter((w) => !w.rule.startsWith('order/'))
      .map((w) => w.line),
  );

  // La première déclaration est à la ligne 3 (après `<style>` et `.foo {`).
  expect(flaggedLines).toEqual(new Set(declarations.map((_, i) => i + 3)));
});

test('accepte les tokens et les mots-clés admis', async () => {
  const warnings = await lint([
    'background-color: var(--color-surface);',
    'border-radius: var(--radius-md);',
    'border-width: var(--border-width);',
    'column-rule-color: var(--color-border);',
    'column-rule-width: var(--border-width);',
    'font-family: var(--font-family-sans);',
    'line-height: inherit;',
    'outline-width: var(--focus-width);',
    'scroll-padding-top: var(--space-4);',
    'transition-duration: var(--duration-fast), var(--duration-base);',
    'z-index: auto;',
  ]);

  expect(warnings).toEqual([]);
});

test('accepte les valeurs en dur de @font-face, où var() est invalide', async () => {
  const { results } = await stylelint.lint({
    code: "@font-face {\n  font-family: 'Inter';\n  font-weight: 100 900;\n}\n",
    codeFilename: 'src/styles/fonts.css',
  });

  expect(results[0]?.warnings).toEqual([]);
});
