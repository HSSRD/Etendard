import { expect, test } from '@playwright/test';
import demo from '../content/demo-projet';
import { expectNoHorizontalScroll, testAppearances } from '../../tests/helpers';

test('le schéma est une image nommée qui contient chaque bloc et chaque liaison', async ({
  page,
}) => {
  await page.goto('/styleguide/wiring-diagram');

  const schema = page.getByRole('img', {
    name: 'Schéma de démonstration des liaisons.',
  });
  await expect(schema).toHaveAttribute('data-testid', 'schema');
  const texts = demo.schema.chains.flatMap(({ title, steps }) => [
    title,
    ...steps.flatMap((step) => [
      step.label,
      step.detail,
      step.via,
      ...(step.branches ?? []).flatMap((branch) => [
        branch.label,
        branch.detail,
        `${branch.direction === 'in' ? '←' : '→'}\u00a0${branch.via}`,
      ]),
    ]),
  ]);
  for (const text of [
    ...texts.filter((text) => text !== undefined),
    'Plus tard',
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
