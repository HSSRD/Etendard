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

// Sur la page styleguide, les sections font chacune un écran : le clic fait défiler.
test('un clic sur « Projets » amène la section juste sous le header, sans JavaScript', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/styleguide/site-header');
  await expect(page.locator('script')).toHaveCount(0);

  await nav(page).getByRole('link', { name: 'Projets' }).click();
  await expect(page).toHaveURL(/#projets$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const headerBox = await header(page).boundingBox();
  const sectionBox = await page.locator('#projets').boundingBox();
  expect(headerBox?.y).toBe(0);
  expect(sectionBox?.y).toBeGreaterThanOrEqual(headerBox?.height ?? Infinity);
  await expect(page.locator('#projets h2')).toBeInViewport();
});

test('le header colle en haut, opaque, à la hauteur du token, sur une ligne', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  await expect(header(page)).toHaveCSS('position', 'sticky');
  await expect(header(page)).toHaveCSS('top', '0px');
  // Fond opaque : vérifié par thème plus bas (même couleur que la page).

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
  await expect(header(page)).toHaveScreenshot('site-header-focus.png');
});

test('avec un texte agrandi à 200 %, le header passe à la ligne sans défilement horizontal', async ({
  page,
}) => {
  await page.goto('/styleguide/site-header');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  // Chaque lien reste entier à l'écran, anneau de focus compris (décalage + épaisseur).
  const links = await header(page)
    .getByRole('link')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          top: element.getBoundingClientRect().top,
          ring:
            Number.parseFloat(style.getPropertyValue('--focus-offset')) +
            Number.parseFloat(style.getPropertyValue('--focus-width')),
        };
      }),
    );
  expect(links).toHaveLength(3);
  for (const { ring, top } of links) {
    expect(ring).toBeGreaterThan(0);
    expect(top).toBeGreaterThanOrEqual(ring);
  }
  for (const link of await header(page).getByRole('link').all()) {
    await expect(link).toBeInViewport({ ratio: 1 });
  }
  await expect(header(page)).toHaveScreenshot('site-header-texte-agrandi.png');
});

test('un lien du header se souligne au survol', async ({ page }) => {
  await page.goto('/styleguide/site-header');
  const link = nav(page).getByRole('link', { name: 'Projets' });
  await expect(link).toHaveCSS('text-decoration-line', 'none');
  await link.hover();
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
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
