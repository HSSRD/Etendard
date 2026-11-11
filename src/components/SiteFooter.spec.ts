import { expect, test } from '@playwright/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  schemes,
} from '../../tests/helpers';

const url = '/styleguide/site-footer';

test('le footer affiche l’éditeur, l’année et ses liens, sans débordement', async ({
  page,
}) => {
  await page.goto(url);
  const footer = page.getByRole('contentinfo');

  await expect(footer).toContainClass('site-footer');
  await expect(footer).toContainText('Étendard, la vitrine des projets HSSRD');
  await expect(footer).toContainText('© 2026 HSSRD');

  const source = footer.getByRole('link', { name: 'Code source sur GitHub' });
  await expect(source).toHaveAttribute(
    'href',
    'https://github.com/HSSRD/Etendard',
  );
  await expect(source).toHaveAttribute('rel', 'noopener');
  await expect(
    footer.getByRole('link', { name: 'Retour en haut' }),
  ).toHaveAttribute('href', '#accueil');

  await expectNoHorizontalScroll(page);
});

test('sur la one page, le footer suit <main> et « Retour en haut » remonte à l’accueil', async ({
  page,
}) => {
  // Défilement instantané : le défilement doux est déjà testé par accueil.spec.ts.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const footer = page.locator('main#contenu + footer.site-footer');
  // Année du build ; la précédente n'est admise que le 1er janvier (build lancé la veille).
  const now = new Date();
  const years = [now.getFullYear()];
  if (now.getMonth() === 0 && now.getDate() === 1) {
    years.push(now.getFullYear() - 1);
  }
  await expect(footer).toContainText(
    new RegExp(`© (${years.join('|')}) HSSRD`),
  );

  // Espaceur injecté : la page défile quel que soit son contenu et la hauteur de la fenêtre.
  const accueil = page.locator('#accueil');
  await accueil.evaluate((section) => {
    const spacer = document.createElement('div');
    spacer.style.height = '300vh';
    section.after(spacer);
  });
  await footer.scrollIntoViewIfNeeded();
  await expect(accueil).not.toBeInViewport();

  await footer.getByRole('link', { name: 'Retour en haut' }).click();
  await expect(page).toHaveURL(/#accueil$/);
  await expect(accueil).toBeInViewport();
});

for (const scheme of schemes) {
  test(`footer, thème ${scheme} : accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);

    await expectNoAxeViolations(page);
    await expect(page.getByRole('contentinfo')).toHaveScreenshot(
      `site-footer-${scheme}.png`,
    );
  });
}
