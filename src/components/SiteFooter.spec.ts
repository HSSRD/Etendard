import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const url = '/styleguide/site-footer';

test('le footer affiche l’éditeur, l’année du build et ses liens', async ({
  page,
}) => {
  await page.goto(url);
  const footer = page.getByRole('contentinfo');

  await expect(footer).toHaveClass('site-footer');
  await expect(footer).toContainText('Étendard, la vitrine des projets HSSRD');
  await expect(footer).toContainText(`© ${new Date().getFullYear()} HSSRD`);

  const source = footer.getByRole('link', { name: 'Code source sur GitHub' });
  await expect(source).toHaveAttribute(
    'href',
    'https://github.com/HSSRD/Etendard',
  );
  await expect(source).toHaveAttribute('rel', 'noopener');

  const top = footer.getByRole('link', { name: 'Retour en haut' });
  await expect(top).toHaveAttribute('href', '#accueil');
  await top.click();
  await expect(page).toHaveURL(/#accueil$/);
});

test('la one page rend le footer après <main>', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main#contenu + footer.site-footer')).toHaveCount(
    1,
  );
  await expect(page.locator('#accueil')).toHaveCount(1);
});

test('le footer tient dans la largeur sans défilement horizontal', async ({
  page,
}) => {
  await page.goto(url);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

for (const scheme of schemes) {
  test(`footer, thème ${scheme} : accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);

    await expectNoAxeViolations(page);
    // L'année change à chaque build : masquée pour garder une capture stable.
    const footer = page.getByRole('contentinfo');
    await expect(footer).toHaveScreenshot(`site-footer-${scheme}.png`, {
      mask: [footer.locator('.site-footer__copyright')],
    });
  });
}
