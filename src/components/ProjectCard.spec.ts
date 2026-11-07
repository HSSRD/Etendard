import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

test('chaque carte montre le titre, le résumé et le corps de sa fiche', async ({
  page,
}) => {
  await page.goto('/styleguide/project-card');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ProjectCard',
  );
  const articles = page.locator('article.project-card');
  await expect(articles.getByRole('heading', { level: 3 })).toHaveText([
    'Hussard',
    'Overwatch',
    'Sentry',
  ]);
  for (const article of await articles.all()) {
    await expect(article.locator('.project-card__summary')).not.toBeEmpty();
    await expect(article.locator('.project-card__body p')).not.toBeEmpty();
  }
});

test('la présentation (intro) n’a pas de cadre, les cartes en ont un', async ({
  page,
}) => {
  await page.goto('/styleguide/project-card');
  const articles = page.locator('article.project-card');

  await expect(articles.first()).toHaveClass(/project-card--intro/);
  await expect(articles.first()).toHaveCSS('border-top-style', 'none');
  await expect(articles.nth(1)).not.toHaveClass(/project-card--intro/);
  await expect(articles.nth(1)).toHaveCSS('border-top-style', 'solid');
});

for (const scheme of schemes) {
  test(`ProjectCard, thème ${scheme} : accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/project-card');

    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`project-card-${scheme}.png`, {
      fullPage: true,
    });
  });
}
