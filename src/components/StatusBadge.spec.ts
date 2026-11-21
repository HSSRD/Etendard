import { expect, test } from '@playwright/test';
import { testAppearances } from '../../tests/helpers';

test('chaque statut a son libellé', async ({ page }) => {
  await page.goto('/styleguide/status-badge');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'StatusBadge',
  );
  await expect(page.getByTestId('status-badge')).toHaveText([
    'À venir',
    'En cours',
    'Terminé',
  ]);
});

test('l’index du styleguide mène à la page de StatusBadge', async ({
  page,
}) => {
  await page.goto('/styleguide');
  await expect(page.getByRole('link', { name: 'StatusBadge' })).toHaveAttribute(
    'href',
    '/styleguide/status-badge',
  );
});

testAppearances('/styleguide/status-badge', 'status-badge');
