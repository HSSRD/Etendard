import { expect, test } from '@playwright/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoInlineCode,
  schemes,
} from './helpers';

// Accueil du projet Dragon (ADR 0016), route statique pré-rendue.
const url = '/projets/dragon';

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le HTML pré-rendu contient le titre et la navigation du projet', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(page).toHaveTitle('Dragon — Étendard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragon');
    const nav = page.getByRole('navigation', {
      name: 'Pages du projet Dragon',
    });
    await expect(
      nav.getByRole('link', { name: 'Présentation' }),
    ).toHaveAttribute('href', url);
    await expect(
      nav.getByRole('link', { name: 'Présentation' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('link', { name: 'Dépôt Dragon sur GitHub' }),
    ).toHaveAttribute('href', 'https://github.com/HSSRD/Dragon');
    // Header et footer du site : retour à la one page, et haut de cette page.
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Projets' }),
    ).toHaveAttribute('href', '/#projets');
    await expect(
      page.getByRole('link', { name: 'Retour en haut' }),
    ).toHaveAttribute('href', '#haut');
    await expect(page.locator('#haut')).toHaveCount(1);
  });
});

test('la page n’a ni style ni script en ligne', async ({ page }) => {
  await expectNoInlineCode(page, url);
});

for (const scheme of schemes) {
  test(`${url}, thème ${scheme} : accessibilité, sans défilement horizontal`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}
