import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Thèmes à émuler (`colorScheme`) : chaque page est testée dans les deux (ticket #10). */
export const schemes = ['light', 'dark'] as const;

/**
 * Fond attendu d'un thème, au format de getComputedStyle : la <meta name="theme-color">
 * de ce thème, qui doit reprendre --color-background de tokens.css.
 */
export const themeBackground = async (
  page: Page,
  scheme: (typeof schemes)[number],
) => {
  const hex = await page
    .locator(
      `meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`,
    )
    .getAttribute('content');
  expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  return hexToRgb(hex ?? '');
};

/** Couleur `#rrggbb` au format de getComputedStyle. */
export const hexToRgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(hex.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};

/** Zéro violation WCAG 2.2 AA (ADR 0003). */
export const expectNoAxeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations).toEqual([]);
};
