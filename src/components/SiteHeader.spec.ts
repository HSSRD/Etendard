import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const pages = ['/styleguide/site-header', '/'];

const header = (page: Page) => page.locator('body > header.site-header');
const nav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigation principale' });

/** --header-height en pixels. */
const headerHeight = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.height = 'var(--header-height)';
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });

for (const url of pages) {
  test(`${url} : nom du site et navigation par ancres`, async ({ page }) => {
    await page.goto(url);

    // Inséré dans l'emplacement header du layout, juste avant <main>.
    await expect(page.locator('body > header + main#contenu')).toHaveCount(1);
    await expect(header(page)).toHaveCount(1);
    await expect(
      header(page).getByRole('link', { name: 'Étendard', exact: true }),
    ).toHaveAttribute('href', '#accueil');
    const links = nav(page).getByRole('link');
    await expect(links).toHaveText(['Accueil', 'Projets']);
    await expect(links.nth(0)).toHaveAttribute('href', '#accueil');
    await expect(links.nth(1)).toHaveAttribute('href', '#projets');
    await expect(page.locator('script')).toHaveCount(0);
  });

  test(`${url} : un clic sur « Projets » amène le titre sous le header`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await nav(page).getByRole('link', { name: 'Projets' }).click();
    await expect(page).toHaveURL(/#projets$/);

    const title = page.locator('#projets h2');
    await expect(title).toBeInViewport();
    const headerBox = await header(page).boundingBox();
    const titleBox = await title.boundingBox();
    expect(headerBox?.y).toBe(0);
    expect(titleBox?.y).toBeGreaterThanOrEqual(
      (headerBox?.y ?? 0) + (headerBox?.height ?? Infinity),
    );
  });
}

test('le header reste collé en haut, opaque, à la hauteur du token', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  await expect(header(page)).toHaveCSS('position', 'sticky');
  await expect(header(page)).toHaveCSS('top', '0px');
  // rgb() et non rgba() : fond opaque.
  await expect(header(page)).toHaveCSS('background-color', /^rgb\(/);
  const height = await headerHeight(page);
  expect(height).toBeGreaterThan(0);
  await expect(header(page)).toHaveCSS('height', `${height}px`);

  await page.mouse.wheel(0, 2000);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect((await header(page).boundingBox())?.y).toBe(0);
});

test('le nom et les liens tiennent sur une ligne, sans défilement horizontal', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  const height = await headerHeight(page);
  for (const link of await header(page).getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('chaque lien du header a un focus visible au clavier', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  // Le premier Tab atteint le lien d'évitement du layout.
  await page.keyboard.press('Tab');
  for (const name of ['Étendard', 'Accueil', 'Projets']) {
    await page.keyboard.press('Tab');
    const link = header(page).getByRole('link', { name, exact: true });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).not.toHaveCSS('outline-width', '0px');
  }
});

for (const scheme of schemes) {
  test(`thème ${scheme} : accessibilité et capture`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/site-header');

    await expectNoAxeViolations(page);
    await expect(header(page)).toHaveScreenshot(`site-header-${scheme}.png`);
  });
}
