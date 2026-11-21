import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, testAppearances } from '../../tests/helpers';

test('chaque tableau est nommé par sa légende, avec ses en-têtes et ses cellules', async ({
  page,
}) => {
  await page.goto('/styleguide/data-table');

  const phases = page.getByRole('table', { name: 'Phases du projet' });
  // En-têtes cachés en liste (chaque cellule porte le nom de sa colonne) : comptés quand même.
  await expect(
    phases.getByRole('columnheader', { includeHidden: true }),
  ).toHaveText(['Phase', 'Objectif', 'Critère de sortie', 'Statut']);
  await expect(phases.getByRole('row', { includeHidden: true })).toHaveCount(4);
  await expect(phases.getByRole('cell').last()).toContainText('À venir');

  const options = page.getByRole('table', { name: 'Options comparées' });
  await expect(options.getByRole('cell').nth(2)).toContainText(
    '5 à 10 €, relevé le 2026-11-20',
  );
});

test('le tableau passe en liste quand ses colonnes n’ont pas la place', async ({
  page,
}, testInfo) => {
  await page.goto('/styleguide/data-table');
  await expectNoHorizontalScroll(page);

  const phases = page.getByRole('table', { name: 'Phases du projet' });
  const head = phases.getByTestId('table-head');
  const label = phases.getByTestId('cell-label').first();
  const cells = phases.getByRole('row').nth(1).getByRole('cell');
  const [first, second] = await Promise.all([
    cells.nth(0).boundingBox(),
    cells.nth(1).boundingBox(),
  ]);
  // 4 colonnes de 160 px et leurs écarts : en liste à 375 px de fenêtre, en tableau à partir de 768 px.
  if (testInfo.project.name === 'chromium-375') {
    await expect(head).toBeHidden();
    await expect(label).toHaveText('Phase :');
    expect(second?.y).toBeGreaterThan(first?.y ?? Infinity);
  } else {
    await expect(head).toBeVisible();
    await expect(label).toBeHidden();
    expect(second?.y).toBe(first?.y);
  }
});

test('l’index du styleguide mène à la page de DataTable', async ({ page }) => {
  await page.goto('/styleguide');
  await expect(page.getByRole('link', { name: 'DataTable' })).toHaveAttribute(
    'href',
    '/styleguide/data-table',
  );
});

testAppearances('/styleguide/data-table', 'data-table');
