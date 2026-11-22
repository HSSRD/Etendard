import { expect, test } from '@playwright/test';
import { testAppearances } from '../../tests/helpers';

const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';

test('chaque section est une région titrée, avec sa source et sa date', async ({
  page,
}) => {
  await page.goto('/styleguide/project-section');

  const roadmap = page.getByRole('region', {
    name: 'Feuille de route',
    exact: true,
  });
  await expect(roadmap.getByRole('heading', { level: 2 })).toHaveText(
    'Feuille de route',
  );
  await expect(roadmap.getByTestId('status-badge').first()).toHaveText(
    'En cours',
  );
  await expect(roadmap.getByRole('table')).toHaveCount(1);
  const source = roadmap.getByTestId('source');
  await expect(source).toHaveText(
    'Source : README.md au commit 3afc561, relevé le 2026-11-21',
  );
  await expect(source.getByRole('link', { name: 'README.md' })).toHaveAttribute(
    'href',
    `https://github.com/HSSRD/Dragon/blob/${sha}/README.md`,
  );

  const method = page.getByRole('region', { name: 'Méthode', exact: true });
  await expect(method.getByRole('listitem')).toHaveCount(4);
  await expect(
    method.getByRole('link', { name: 'ADR-001 : architecture logicielle' }),
  ).toHaveAttribute('href', new RegExp(`/blob/${sha}/docs/decisions/`));
});

test('une source aux données jamais publiées est citée sans lien', async ({
  page,
}) => {
  await page.goto('/styleguide/project-section');

  const budget = page.getByRole('region', { name: 'Budget', exact: true });
  await expect(budget.getByTestId('source')).toContainText(
    'docs/phase-1-construction/bom.md au commit 3afc561',
  );
  await expect(budget.getByRole('link')).toHaveCount(0);
  await expect(page.locator('a[href*="bom.md"]')).toHaveCount(0);
});

test('l’index du styleguide mène à la page de ProjectSection', async ({
  page,
}) => {
  await page.goto('/styleguide');
  await expect(
    page.getByRole('link', { name: 'ProjectSection' }),
  ).toHaveAttribute('href', '/styleguide/project-section');
});

testAppearances('/styleguide/project-section', 'project-section');
