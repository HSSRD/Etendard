import { expect, test } from '@playwright/test';
import { testAppearances } from '../../tests/helpers';

test('la navigation liste les pages du projet et marque la page courante', async ({
  page,
}) => {
  await page.goto('/styleguide/project-nav');

  const navs = page.getByRole('navigation', {
    name: 'Pages du projet Démonstration',
  });
  await expect(navs).toHaveCount(2);
  for (const [index, current] of ['Présentation', 'Matériel'].entries()) {
    const nav = navs.nth(index);
    const links = nav.getByRole('link');
    await expect(links).toHaveText(['Présentation', 'Matériel']);
    await expect(links.nth(0)).toHaveAttribute('href', '/projets/demo');
    await expect(links.nth(1)).toHaveAttribute(
      'href',
      '/projets/demo/materiel',
    );
    await expect(nav.getByRole('link', { name: current })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
  }
});

test('l’index du styleguide mène à la page de ProjectNav', async ({ page }) => {
  await page.goto('/styleguide');
  await expect(page.getByRole('link', { name: 'ProjectNav' })).toHaveAttribute(
    'href',
    '/styleguide/project-nav',
  );
});

testAppearances('/styleguide/project-nav', 'project-nav');
