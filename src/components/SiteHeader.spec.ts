import { expect, test, type Page } from '@playwright/test';
import {
  expectNoAxeViolations,
  schemes,
  themeBackground,
} from '../../tests/helpers';

const pages = ['/styleguide/site-header', '/'];

const header = (page: Page) => page.locator('body > header.site-header');
const nav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigation principale' });

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
  });
}

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // Sur la page styleguide, #projets n'est pas en bas de page : le clic la fait défiler
  // exactement jusqu'au bas du header (scroll-margin-top du socle).
  test('un clic sur « Projets » arrête la section juste sous le header', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/styleguide/site-header');
    await expect(page.locator('script')).toHaveCount(0);

    await nav(page).getByRole('link', { name: 'Projets' }).click();
    await expect(page).toHaveURL(/#projets$/);
    const headerBox = await header(page).boundingBox();
    const sectionBox = await page.locator('#projets').boundingBox();
    expect(headerBox?.y).toBe(0);
    expect(sectionBox?.y).toBeCloseTo(headerBox?.height ?? Infinity, 0);
    await expect(page.locator('#projets h2')).toBeInViewport();

    // Retour en haut par le nom du site.
    await header(page).getByRole('link', { name: 'Étendard' }).click();
    await expect(page).toHaveURL(/#accueil$/);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test('le header colle en haut, au-dessus du contenu, à la hauteur du token, sur une ligne', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  await expect(header(page)).toHaveCSS('position', 'sticky');
  await expect(header(page)).toHaveCSS('top', '0px');
  // Fond opaque : vérifié par thème plus bas.

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
  // Peint au-dessus du contenu qui défile dessous.
  expect(
    await page.evaluate(() =>
      document.elementFromPoint(1, 1)?.closest('.site-header'),
    ),
  ).toBeTruthy();
});

test('chaque lien du header a un focus visible au clavier', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  const brand = header(page).getByRole('link', { name: 'Étendard' });
  // Tab jusqu'au header, quel que soit le nombre d'éléments focusables avant lui.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    if (await brand.evaluate((element) => element === document.activeElement))
      break;
  }
  for (const [index, name] of ['Étendard', 'Accueil', 'Projets'].entries()) {
    if (index > 0) await page.keyboard.press('Tab');
    const link = header(page).getByRole('link', { name, exact: true });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).not.toHaveCSS('outline-width', '0px');
  }
  await expect(header(page)).toHaveScreenshot('site-header-focus.png');
});

test('avec un texte agrandi à 200 %, le header ne déborde pas horizontalement', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  // Chaque lien reste entier à l'écran, anneau de focus compris (décalage + épaisseur, en px).
  const ring = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.height = 'calc(var(--focus-offset) + var(--focus-width))';
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });
  expect(ring).toBeGreaterThan(0);
  const links = await header(page).getByRole('link').all();
  expect(links).toHaveLength(3);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  for (const link of links) {
    const box = await link.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(ring);
    expect(box?.x).toBeGreaterThanOrEqual(ring);
    expect((box?.x ?? Infinity) + (box?.width ?? 0)).toBeLessThanOrEqual(
      width - ring,
    );
  }
  await expect(header(page)).toHaveScreenshot('site-header-texte-agrandi.png');
});

test('les liens du header se soulignent au survol', async ({ page }) => {
  await page.goto('/styleguide/site-header');
  // Le dernier survolé (« Projets ») est celui de la capture.
  for (const name of ['Étendard', 'Projets']) {
    const link = header(page).getByRole('link', { name, exact: true });
    await expect(link).toHaveCSS('text-decoration-line', 'none');
    await link.hover();
    await expect(link).toHaveCSS('text-decoration-line', 'underline');
  }
  await expect(header(page)).toHaveScreenshot('site-header-survol.png');
});

for (const scheme of schemes) {
  test(`thème ${scheme} : accessibilité et capture`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/site-header');

    // Même fond que la page, donc que <meta name="theme-color"> : pas de couture sous la barre du navigateur.
    await expect(header(page)).toHaveCSS(
      'background-color',
      await themeBackground(page, scheme),
    );
    await expectNoAxeViolations(page);
    await expect(header(page)).toHaveScreenshot(`site-header-${scheme}.png`);
  });
}
