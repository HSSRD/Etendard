import { expect, test } from '@playwright/test';
import { testAppearances } from '../../tests/helpers';

test('l’en-tête montre le titre, le résumé, le statut et le lien vers le repo', async ({
  page,
}) => {
  await page.goto('/styleguide/project-header');

  const headers = page.getByTestId('project-header');
  await expect(headers.getByRole('heading', { level: 1 })).toHaveText([
    'Démonstration',
    'Matériel',
  ]);
  const first = headers.first();
  await expect(first.getByRole('paragraph').first()).toHaveText(
    'Un projet de démonstration des pages de projet.',
  );
  await expect(first.getByTestId('status-badge')).toHaveText('En cours');
  await expect(
    first.getByRole('link', { name: 'Dépôt Démonstration sur GitHub' }),
  ).toHaveAttribute('href', 'https://github.com/HSSRD/Dragon');
});

test('l’index du styleguide mène à la page de ProjectHeader', async ({
  page,
}) => {
  await page.goto('/styleguide');
  await expect(
    page.getByRole('link', { name: 'ProjectHeader' }),
  ).toHaveAttribute('href', '/styleguide/project-header');
});

testAppearances('/styleguide/project-header', 'project-header');
