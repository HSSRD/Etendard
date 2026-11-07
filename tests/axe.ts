import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Thèmes émulés par les tests (`colorScheme`) et fond attendu, repris de tokens.css. */
export const themes = [
  { scheme: 'light', background: 'rgb(246, 247, 249)' },
  { scheme: 'dark', background: 'rgb(14, 17, 22)' },
] as const;

/** Zéro violation WCAG 2.2 AA (ADR 0003). */
export const expectNoAxeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations).toEqual([]);
};
