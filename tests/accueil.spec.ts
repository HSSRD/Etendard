import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('la page d’accueil est en français, titrée et accessible', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page).toHaveTitle('Étendard');

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations).toEqual([]);
});
