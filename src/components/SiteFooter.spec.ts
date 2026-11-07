import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const url = '/styleguide/site-footer';

test('le footer affiche l’éditeur, l’année et ses liens, sans débordement', async ({
  page,
}) => {
  await page.goto(url);
  const footer = page.getByRole('contentinfo');

  await expect(footer).toHaveClass('site-footer');
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

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('la one page rend le footer après <main>, avec l’année du build', async ({
  page,
}) => {
  await page.goto('/');
  const footer = page.locator('main#contenu + footer.site-footer');
  // Build et test peuvent encadrer le passage à la nouvelle année.
  const year = new Date().getFullYear();
  await expect(footer).toContainText(
    new RegExp(`© (${year - 1}|${year}) HSSRD`),
  );

  await footer.getByRole('link', { name: 'Retour en haut' }).click();
  await expect(page).toHaveURL(/#accueil$/);
  await expect(page.locator('#accueil')).toBeInViewport();
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
