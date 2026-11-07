import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Les <meta name="theme-color"> ne peuvent pas lire une variable CSS : elles recopient
// --color-background de tokens.css, qui doit rester leur unique source.
test('les theme-color de BaseLayout reprennent --color-background', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');
  const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');

  const background = tokens.match(
    /--color-background: light-dark\((#\w+), (#\w+)\);/,
  );
  expect(background).not.toBeNull();
  const themeColors = [
    ...layout.matchAll(
      /media="\(prefers-color-scheme: (\w+)\)"\s+content="(#\w+)"/g,
    ),
  ].map(([, scheme, color]) => [scheme, color]);

  expect(themeColors).toEqual([
    ['light', background?.[1]],
    ['dark', background?.[2]],
  ]);
});
