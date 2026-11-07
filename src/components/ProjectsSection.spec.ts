import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const pages = ['/styleguide/projects', '/'];

for (const url of pages) {
  test(`${url} : Projets, Hussard puis Overwatch et Sentry, titres h1 → h2 → h3`, async ({
    page,
  }) => {
    await page.goto(url);

    const section = page.locator('section#projets .projects-section');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      'Projets',
    );
    await expect(
      section.locator('.projects-section__intro').getByRole('heading'),
    ).toHaveText('Hussard');
    await expect(
      section.locator('article.project-card').getByRole('heading'),
    ).toHaveText(['Overwatch', 'Sentry']);

    const levels = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((headings) =>
        headings.map((heading) => Number(heading.tagName.slice(1))),
      );
    expect(levels).toEqual([1, 2, 3, 3, 3]);
  });
}

test('aucune adresse, aucun port ni lien vers les repos privés', async ({
  page,
}) => {
  await page.goto('/styleguide/projects');
  const section = page.locator('.projects-section');

  await expect(section.locator('a')).toHaveCount(0);
  const text = await section.innerText();
  expect(text).not.toMatch(/https?:|www\.|github|\d+\.\d+\.\d+\.\d+|:\d{2,5}/i);
  await expect(page.locator('script')).toHaveCount(0);
});

test('les cartes sont côte à côte à partir de 768 px, empilées en dessous', async ({
  page,
}) => {
  await page.goto('/styleguide/projects');
  const [first, second] = await page
    .locator('article.project-card')
    .evaluateAll((articles) =>
      articles.map((article) => article.getBoundingClientRect()),
    );
  if (!first || !second) throw new Error('deux cartes attendues');

  if ((page.viewportSize()?.width ?? 0) >= 768) {
    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
  } else {
    expect(second.left).toBe(first.left);
    expect(second.top).toBeGreaterThanOrEqual(first.bottom);
  }
});

for (const scheme of schemes) {
  test(`ProjectsSection, thème ${scheme} : accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/projects');

    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`projects-${scheme}.png`, {
      fullPage: true,
    });
  });
}
