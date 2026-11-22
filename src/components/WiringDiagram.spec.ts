import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, testAppearances } from '../../tests/helpers';

test('le schéma est une image nommée qui contient chaque bloc et chaque liaison', async ({
  page,
}) => {
  await page.goto('/styleguide/wiring-diagram');

  const schema = page.getByRole('img', {
    name: 'Schéma de démonstration des liaisons.',
  });
  await expect(schema).toHaveAttribute('data-testid', 'schema');
  for (const text of [
    'Commande',
    'Radiocommande',
    'au sol',
    'commandes',
    'Contrôleur de vol',
    '← position',
    'GPS',
    'Puissance',
    '→ alimentation',
    'BEC',
    'Plus tard',
    'Moteurs',
  ]) {
    await expect(schema.getByText(text, { exact: true })).toBeVisible();
  }
});

test('les chaînes s’empilent à 375 px et se côtoient au-delà', async ({
  page,
}, testInfo) => {
  await page.goto('/styleguide/wiring-diagram');
  await expectNoHorizontalScroll(page);
  const top = (text: string) =>
    page
      .getByTestId('schema')
      .getByText(text, { exact: true })
      .evaluate((element) => element.getBoundingClientRect().top);

  if (testInfo.project.name === 'chromium-375') {
    expect(await top('Puissance')).toBeGreaterThan(
      await top('Contrôleur de vol'),
    );
  } else {
    expect(await top('Puissance')).toBe(await top('Commande'));
  }
});

test('l’index du styleguide mène à la page de WiringDiagram', async ({
  page,
}) => {
  await page.goto('/styleguide');
  await expect(
    page.getByRole('link', { name: 'WiringDiagram' }),
  ).toHaveAttribute('href', '/styleguide/wiring-diagram');
});

testAppearances('/styleguide/wiring-diagram', 'wiring-diagram');
