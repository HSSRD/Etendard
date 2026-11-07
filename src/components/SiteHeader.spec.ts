import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const pages = ['/styleguide/site-header', '/'];

const header = (page: Page) => page.locator('body > header.site-header');
const nav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigation principale' });

for (const url of pages) {
  test(`${url} : nom, navigation par ancres et titre visible sous le header`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
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

    await links.nth(1).click();
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

test('le header colle en haut, opaque, à la hauteur du token, sur une ligne', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  await expect(header(page)).toHaveCSS('position', 'sticky');
  await expect(header(page)).toHaveCSS('top', '0px');
  // rgb() et non rgba() : fond opaque.
  await expect(header(page)).toHaveCSS('background-color', /^rgb\(/);

  // Hauteur du token, et chaque lien tient dans le header sans déborder à droite :
  // un retour à la ligne ferait sortir un lien du header.
  const layout = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.height = 'var(--header-height)';
    document.body.append(probe);
    const tokenHeight = probe.getBoundingClientRect().height;
    probe.remove();
    const root = document.documentElement;
    return {
      tokenHeight,
      headerHeight: document
        .querySelector('.site-header')
        ?.getBoundingClientRect().height,
      links: [...document.querySelectorAll('.site-header a')].map((link) => {
        const { bottom, right, top } = link.getBoundingClientRect();
        return { bottom, right, top };
      }),
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
  expect(layout.tokenHeight).toBeGreaterThan(0);
  expect(layout.headerHeight).toBe(layout.tokenHeight);
  expect(layout.links).toHaveLength(3);
  for (const link of layout.links) {
    expect(link.top).toBeGreaterThanOrEqual(0);
    expect(link.bottom).toBeLessThanOrEqual(layout.tokenHeight);
    expect(link.right).toBeLessThanOrEqual(layout.clientWidth);
  }
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

  await page.mouse.wheel(0, 2000);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect((await header(page).boundingBox())?.y).toBe(0);
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
