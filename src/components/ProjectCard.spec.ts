import { expect, test } from '@playwright/test';
import { testAppearances } from '../../tests/helpers';

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
    'Dragon',
    'Démonstration',
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

test('seule une fiche qui déclare sa page porte un lien vers elle', async ({
  page,
}) => {
  await page.goto('/styleguide/project-card');
  const articles = page.getByRole('article');

  await expect(
    articles.last().getByRole('link', {
      name: 'Voir la page du projet Démonstration',
    }),
  ).toHaveAttribute('href', '/projets/demo');
  await expect(
    articles.getByRole('link', { name: 'Voir la page du projet Dragon' }),
  ).toHaveAttribute('href', '/projets/dragon');
  await expect(articles.getByRole('link')).toHaveCount(2);
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

testAppearances('/styleguide/project-card', 'project-card');
