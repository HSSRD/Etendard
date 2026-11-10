import stylelint from 'stylelint';
import { expect, test } from 'vitest';

// ADR 0004 : chaque famille de tokens refuse une valeur en dur dans un composant.
const lint = async (declarations: string) => {
  const { results } = await stylelint.lint({
    code: `<style>\n  .foo {\n${declarations}\n  }\n</style>\n`,
    codeFilename: 'src/components/Foo.astro',
  });
  return results[0]?.warnings ?? [];
};

test('refuse les rayons, bordures, typographies, durées et z-index en dur', async () => {
  const warnings = await lint(`
    animation-delay: 1s;
    border-radius: 4px;
    border-top-left-radius: 4px;
    border-width: 2px;
    font-family: Arial;
    font-weight: 700;
    line-height: 1.2;
    outline-offset: 2px;
    outline-width: 2px;
    transition-duration: 200ms;
    z-index: 5;
  `);

  expect(warnings).toHaveLength(11);
});

test('accepte les tokens et les mots-clés admis', async () => {
  const warnings = await lint(`
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: var(--font-family-sans);
    line-height: inherit;
    outline: var(--focus-width) solid var(--color-focus);
    transition:
      opacity var(--duration-fast) ease,
      transform var(--duration-base) ease;
    z-index: auto;
  `);

  expect(warnings).toEqual([]);
});
