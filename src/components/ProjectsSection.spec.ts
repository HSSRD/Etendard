import { expect, test, type Page } from '@playwright/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  schemes,
} from '../../tests/helpers';

/** Niveaux des titres (h1 → 1…) sous `selector`, dans l'ordre du document. */
const headingLevels = (page: Page, selector: string) =>
  page
    .locator(selector)
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );

test('Projets, puis Hussard, Overwatch et Sentry, puis Dragon, titres h1 → h2 → h3', async ({
  page,
}) => {
  await page.goto('/styleguide/projects-section');

  const section = page.locator('#projets').getByTestId('projects-section');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText(
    'Projets',
  );
  await expect(section.getByRole('heading', { level: 3 })).toHaveText([
    'Hussard',
    'Overwatch',
    'Sentry',
    'Dragon',
  ]);
  await expect(
    section.getByTestId('project-units').locator('> article'),
  ).toHaveCount(2);
  expect(await headingLevels(page, 'body')).toEqual([1, 2, 3, 3, 3, 3]);
});

test('la one page insère la section dans #projets', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('#projets > [data-testid="projects-section"]'),
  ).toHaveCount(1);
  expect(await headingLevels(page, '#projets')).toEqual([2, 3, 3, 3, 3]);
});

test('aucune adresse, aucun port ni lien vers les repos privés', async ({
  page,
}) => {
  await page.goto('/styleguide/projects-section');
  const section = page.getByTestId('projects-section');

  // Seul lien : la page du projet Dragon, sur le site (ADR 0016).
  await expect(section.locator('a')).toHaveCount(1);
  await expect(section.locator('a')).toHaveAttribute('href', '/projets/dragon');
  // Le HTML, pas seulement le texte : une image ou un commentaire ne doit rien divulguer.
  expect(await section.innerHTML()).not.toMatch(
    /https?:|www\.|github|\.local\b|\.ts\.net|\d+\.\d+\.\d+\.\d+|\.lan\b|:\d{2,5}|\bport\s*[:=]?\s*\d/i,
  );
});

test('les cartes sont côte à côte à partir de 768 px, empilées en dessous', async ({
  page,
}) => {
  await page.goto('/styleguide/projects-section');
  const cards = page.getByTestId('project-units').first().locator('> article');
  const first = await cards.first().boundingBox();
  const second = await cards.nth(1).boundingBox();
  if (!first || !second) throw new Error('deux cartes visibles attendues');

  if ((page.viewportSize()?.width ?? 0) >= 768) {
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
  } else {
    expect(second.x).toBe(first.x);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  }
});

// Écrans étroits : les cartes rétrécissent, la page ne défile pas en largeur.
for (const width of [320, 360]) {
  test(`à ${width} px, les cartes tiennent dans la page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/styleguide/projects-section');
    await expectNoHorizontalScroll(page);
  });
}

// Seuil exact : à 767 px, la largeur utile ne tient plus deux cartes.
test('à 767 px, les cartes sont encore empilées', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await page.goto('/styleguide/projects-section');
  const cards = page.getByTestId('project-units').first().locator('> article');
  const first = await cards.first().boundingBox();
  const second = await cards.nth(1).boundingBox();
  if (!first || !second) throw new Error('deux cartes visibles attendues');
  expect(second.x).toBe(first.x);
});

for (const scheme of schemes) {
  test(`ProjectsSection, thème ${scheme} : accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/projects-section');

    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`projects-section-${scheme}.png`, {
      fullPage: true,
    });
  });
}
