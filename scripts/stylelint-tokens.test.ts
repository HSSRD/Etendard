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
    'border: solid 2px var(--color-border);',
    'border-radius: 4px;',
    'border-top: solid 2px var(--color-border);',
    'border-top-left-radius: 4px;',
    'border-top-width: 2px;',
    'border-width: 2px;',
    'font-family: Arial;',
    'font-weight: 700;',
    'line-height: 1.2;',
    'outline: var(--color-focus) solid 2px;',
    'outline-offset: 2px;',
    'outline-width: 2px;',
    'transition: opacity var(--duration-fast) ease, transform 200ms ease;',
    'transition-delay: 100ms;',
    'transition-duration: 200ms;',
    'z-index: 5;',
  ];
  const flaggedLines = new Set((await lint(declarations)).map((w) => w.line));

  // La première déclaration est à la ligne 3 (après `<style>` et `.foo {`).
  expect([...flaggedLines].sort((a, b) => a - b)).toEqual(
    declarations.map((_, i) => i + 3),
  );
});

test('accepte les tokens et les mots-clés admis', async () => {
  const warnings = await lint([
    'border-radius: var(--radius-md);',
    'border-width: var(--border-width);',
    'font-family: var(--font-family-sans);',
    'line-height: inherit;',
    'outline-width: var(--focus-width);',
    'transition-duration: var(--duration-fast), var(--duration-base);',
    'z-index: auto;',
  ]);

  expect(warnings).toEqual([]);
});
