import { statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  cssToPixels,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  schemes,
  tabTo,
  themeBackground,
} from '../../tests/helpers';

test('Hero : vidéo de fond décorative, muette, en boucle, qui couvre la section', async ({
  page,
}) => {
  await page.goto('/styleguide/hero');

  const video = page.locator('.hero__video');
  for (const attribute of ['autoplay', 'muted', 'loop', 'playsinline']) {
    await expect(video).toHaveAttribute(attribute, '');
  }
  await expect(video).toHaveAttribute('preload', 'metadata');
  await expect(video).toHaveAttribute('poster', '/accueil/bienvenue.avif');
  await expect(video).toHaveAttribute('aria-hidden', 'true');
  await expect(video).not.toHaveAttribute('controls');
  const sources = await video
    .locator('source')
    .evaluateAll((elements) =>
      elements.map((source) => [
        source.getAttribute('src'),
        source.getAttribute('type'),
      ]),
    );
  expect(sources).toEqual([
    ['/accueil/bienvenue.webm', 'video/webm'],
    ['/accueil/bienvenue.mp4', 'video/mp4'],
  ]);

  // Budgets du ticket #22 : 3 Mo par vidéo, 150 Ko pour le poster.
  for (const [path, budget] of [
    ['/accueil/bienvenue.webm', 3_000_000],
    ['/accueil/bienvenue.mp4', 3_000_000],
    ['/accueil/bienvenue.avif', 150_000],
  ] as const) {
    expect(statSync(`public${path}`).size).toBeLessThanOrEqual(budget);
  }

  // Lecture automatique et muette de la source WebM.
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => ({
        playing: !element.paused && element.currentTime > 0,
        muted: element.muted,
        source: new URL(element.currentSrc, location.href).pathname,
      })),
    )
    .toEqual({
      playing: true,
      muted: true,
      source: '/accueil/bienvenue.webm',
    });

  // Cadrage : la vidéo occupe toute la section, recadrée sans déformation.
  const [videoBox, heroBox] = await Promise.all([
    video.boundingBox(),
    page.locator('.hero').boundingBox(),
  ]);
  expect(videoBox).toEqual(heroBox);
  await expect(video).toHaveCSS('object-fit', 'cover');
  await expectNoHorizontalScroll(page);
});

test('Hero, mouvement réduit : la vidéo n’est pas chargée, seul le poster s’affiche', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/styleguide/hero');

  const video = page.locator('.hero__video');
  await expect(video).toBeVisible();
  // Aucune source ne s'applique : NETWORK_NO_SOURCE, rien n'est lu ni téléchargé.
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => ({
        source: element.currentSrc,
        network: element.networkState,
        paused: element.paused,
      })),
    )
    .toEqual({ source: '', network: 3, paused: true });
});

for (const scheme of schemes) {
  test(`Hero, thème ${scheme} : toujours sombre, fondu vers le fond de la page`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/styleguide/hero');

    // Contenu en thème sombre (couleurs light-dark()) quel que soit le thème de la page.
    await expect(page.locator('.hero__content')).toHaveCSS(
      'color-scheme',
      'dark',
    );
    await expect(page.locator('.hero')).toHaveCSS(
      'background-color',
      'rgb(0, 0, 0)',
    );

    // Bas de la section fondu dans le fond de la page, du thème de la page, sur le seul
    // padding bas : le texte, toujours clair, ne passe jamais sur le fondu (thème clair).
    const { fade, paddingBottom } = await page
      .locator('.hero')
      .evaluate((hero) => ({
        fade: getComputedStyle(hero, '::after').backgroundImage,
        paddingBottom: getComputedStyle(hero).paddingBottom,
      }));
    expect(fade).toContain(
      `linear-gradient(rgba(0, 0, 0, 0) calc(100% - ${paddingBottom}), ${await themeBackground(page, scheme)})`,
    );
    expect(fade).toContain('radial-gradient(');
  });

  test(`Hero, thème ${scheme} : contenu, accessibilité et capture`, async ({
    page,
  }) => {
    // Mouvement réduit : la vidéo reste figée sur le poster, les captures sont stables.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/styleguide/hero');

    const hero = page.locator('.hero');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText(
      'Étendard',
    );
    // Espace insécable avant « ! » : textContent, car toHaveText normalise les espaces.
    expect((await hero.locator('.hero__lead').textContent())?.trim()).toBe(
      'Bienvenue\u00a0! Voici le site qui regroupe tous les projets de Hussard.',
    );
    const cta = hero.getByRole('link', {
      name: 'Découvrir les projets',
      exact: true,
    });
    await expect(cta).toHaveAttribute('href', '#projets');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await expect.soft(page).toHaveScreenshot(`hero-${scheme}.png`, {
      fullPage: true,
    });

    // État survol (appareils qui survolent) : le CTA, non souligné au repos, se souligne.
    await expect(cta).toHaveCSS('text-decoration-line', 'none');
    await cta.hover();
    await expect(cta).toHaveCSS('text-decoration-line', 'underline');
    await expect.soft(page).toHaveScreenshot(`hero-${scheme}-hover.png`, {
      fullPage: true,
    });
    await page.mouse.move(0, 0);

    // État focus clavier : Tab jusqu'au CTA.
    await tabTo(page, cta);
    await expect(cta).toHaveCSS('outline-style', 'solid');
    await expect(cta).toHaveCSS('outline-width', /^[1-9]/);
    // Contour de la couleur du fond du bouton : le décalage le rend distinct.
    await expect(cta).toHaveCSS('outline-offset', /^[1-9]/);
    await expect.soft(page).toHaveScreenshot(`hero-${scheme}-focus.png`, {
      fullPage: true,
    });

    // Mode couleurs forcées : la bordure (transparente sinon) reste le contour du bouton.
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(cta).toHaveCSS('border-top-style', 'solid');
    await expect(cta).toHaveCSS('border-top-width', /^[1-9]/);
    await expect(cta).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    await expect(page).toHaveScreenshot(`hero-${scheme}-forced-colors.png`, {
      fullPage: true,
    });
  });
}

test('l’index du styleguide mène à la page du Hero', async ({ page }) => {
  await page.goto('/styleguide');
  await expect(
    page.getByRole('link', { name: 'Hero', exact: true }),
  ).toHaveAttribute('href', '/styleguide/hero');
});

test('accueil : le Hero remplit l’écran sous le header, centré, et mène aux projets', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('section#accueil > .hero')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  const headerHeight = await cssToPixels(page, 'var(--header-height)');
  const layout = await page.evaluate((headerHeight) => {
    const find = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`${selector} introuvable`);
      return element;
    };
    const box = (selector: string) => find(selector).getBoundingClientRect();
    const heroStyle = getComputedStyle(find('.hero'));
    const padding = (side: 'Top' | 'Left' | 'Right') =>
      Number.parseFloat(heroStyle[`padding${side}`]);
    return {
      expectedHeight: window.innerHeight - headerHeight,
      section: box('#accueil'),
      projets: box('#projets'),
      headerHeight,
      paddingTop: padding('Top'),
      contentWidth:
        find('.hero').clientWidth - padding('Left') - padding('Right'),
      title: box('.hero h1'),
      cta: box('.hero__cta'),
    };
  }, headerHeight);

  expect(layout.section.height).toBeCloseTo(layout.expectedHeight, 0);
  expect(layout.projets.top).toBeCloseTo(layout.section.bottom, 0);

  // Contenu centré : espace libre (au-delà du padding) égal au-dessus et en dessous,
  // CTA à sa largeur naturelle et centré, texte centré.
  const above = layout.title.top - layout.section.top;
  const below = layout.section.bottom - layout.cta.bottom;
  expect(above).toBeGreaterThan(layout.paddingTop + 1);
  expect(above).toBeCloseTo(below, 0);
  expect(layout.cta.width).toBeLessThan(layout.contentWidth - 1);
  const sectionCenter = layout.section.left + layout.section.width / 2;
  for (const element of [layout.title, layout.cta]) {
    expect(element.left + element.width / 2).toBeCloseTo(sectionCenter, 0);
  }
  await expect(page.locator('.hero__lead')).toHaveCSS('text-align', 'center');

  // L'appel à l'action fait défiler jusqu'à #projets, arrêtée sous le header.
  // La page est allongée pour que le défilement soit possible tant qu'elle est courte.
  await page
    .locator('body')
    .evaluate((body) => body.style.setProperty('padding-bottom', '200vh'));
  await page
    .getByRole('link', { name: 'Découvrir les projets', exact: true })
    .click();
  await expect(page).toHaveURL(/#projets$/);
  await expect
    .poll(() =>
      page.locator('#projets').evaluate((el) => el.getBoundingClientRect().top),
    )
    .toBeCloseTo(layout.headerHeight, 0);
});
