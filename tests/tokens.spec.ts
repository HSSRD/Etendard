import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes, themeBackground } from './helpers';

test('la page des tokens montre chaque thème', async ({ page }) => {
  await page.goto('/styleguide/tokens');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tokens');
  for (const scheme of schemes) {
    const panel = page.locator(`section[data-theme="${scheme}"]`);
    await expect(panel).toHaveCSS(
      'background-color',
      await themeBackground(page, scheme),
    );
    await expect(panel.locator('.tokens__swatch')).toHaveCount(7);
    await expect(panel.locator('.tokens__font-size')).toHaveCount(6);
    await expect(panel.locator('.tokens__bar')).toHaveCount(9);
  }
});

for (const scheme of schemes) {
  test(`tokens, thème ${scheme} : accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/tokens');

    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`tokens-${scheme}.png`, {
      fullPage: true,
    });
  });
}
