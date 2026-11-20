import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

test('chaque carte montre le titre, le résumé et le corps de sa fiche', async ({
  page,
}) => {
  await page.goto('/styleguide/project-card');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ProjectCard',
  );
  const articles = page.getByRole('article');
  await expect(articles.getByRole('heading', { level: 3 })).toHaveText([
    'Hussard',
    'Overwatch',
    'Sentry',
  ]);
  // Résumé puis au moins un paragraphe du corps, chacun non vide.
  for (const article of await articles.all()) {
    const paragraphs = article.getByRole('paragraph');
    expect(await paragraphs.count()).toBeGreaterThanOrEqual(2);
    for (const paragraph of await paragraphs.all()) {
      await expect(paragraph).not.toBeEmpty();
    }
  }
});

test('la présentation (intro) n’a pas de cadre, les cartes en ont un', async ({
  page,
}) => {
  await page.goto('/styleguide/project-card');
  const articles = page.getByRole('article');

  await expect(articles.first()).toHaveCSS('border-top-width', '0px');
  await expect(articles.first()).toHaveCSS('box-shadow', 'none');
  await expect(articles.nth(1)).toHaveCSS('border-top-style', 'solid');
  await expect(articles.nth(1)).not.toHaveCSS('border-top-width', '0px');
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
