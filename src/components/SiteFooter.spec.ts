import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

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
  // Le build peut dater de l'année précédente seulement s'il précède le Nouvel An.
  const now = new Date();
  const years = [now.getFullYear()];
  if (now.getMonth() === 0) years.push(now.getFullYear() - 1);
  await expect(footer).toContainText(
    new RegExp(`© (${years.join('|')}) HSSRD`),
  );
});

test('« Retour en haut » remonte jusqu’à la section d’accueil', async ({
  page,
}) => {
  // Fenêtre basse : la page défile même tant que la one page est courte.
  const width = page.viewportSize()?.width ?? 1280;
  await page.setViewportSize({ width, height: 60 });
  await page.goto('/');
  const accueil = page.locator('#accueil');
  const top = page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Retour en haut' });
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  );
  await expect(accueil).not.toBeInViewport();

  await top.click();
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
