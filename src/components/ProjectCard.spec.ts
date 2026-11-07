import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const cards = [
  {
    title: 'Overwatch',
    summary: /^Une application Unity /,
    body: /flux vidéo/,
  },
  {
    title: 'Sentry',
    summary: /^Une caméra motorisée /,
    body: /deux servomoteurs/,
  },
];

test('chaque carte montre le titre, le résumé et le corps de sa fiche', async ({
  page,
}) => {
  await page.goto('/styleguide/project-card');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ProjectCard',
  );
  const articles = page.locator('article.project-card');
  await expect(articles).toHaveCount(cards.length);
  for (const [index, card] of cards.entries()) {
    const article = articles.nth(index);
    await expect(article.getByRole('heading', { level: 3 })).toHaveText(
      card.title,
    );
    await expect(article.locator('.project-card__summary')).toHaveText(
      card.summary,
    );
    await expect(article.locator('.project-card__body p')).toHaveText(
      card.body,
    );
  }
  await expect(page.locator('script')).toHaveCount(0);
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
