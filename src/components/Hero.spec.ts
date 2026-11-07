import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

/** Aucun défilement horizontal à la largeur du projet (375 px compris). */
const expectNoHorizontalScroll = async (page: Page) => {
  // clientWidth exclut la barre de défilement verticale, contrairement à innerWidth.
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
};

for (const scheme of schemes) {
  test(`Hero, thème ${scheme} : contenu, accessibilité et capture`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/hero');

    const hero = page.locator('.hero');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText(
      'Étendard',
    );
    // Espace insécable avant « ! » : textContent, car toHaveText normalise les espaces.
    expect(await hero.locator('.hero__lead').textContent()).toContain(
      'Bienvenue\u00a0! Voici le site qui regroupe tous les projets de Hussard.',
    );
    const cta = hero.getByRole('link', { name: 'Découvrir les projets' });
    await expect(cta).toHaveAttribute('href', '#projets');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`hero-${scheme}.png`, {
      fullPage: true,
    });

    // État survol (pointeur fin) : le CTA se souligne.
    await cta.hover();
    await expect(cta).toHaveCSS('text-decoration-line', 'underline');
    await expect(page).toHaveScreenshot(`hero-${scheme}-hover.png`, {
      fullPage: true,
    });
    await page.mouse.move(0, 0);

    // État focus clavier : Tab jusqu'au CTA, quel que soit l'ordre des éléments qui le précèdent.
    for (
      let i = 0;
      i < 10 && !(await cta.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS('outline-style', 'solid');
    expect(
      Number.parseFloat(
        await cta.evaluate((el) => getComputedStyle(el).outlineWidth),
      ),
    ).toBeGreaterThan(0);
    await expect(page).toHaveScreenshot(`hero-${scheme}-focus.png`, {
      fullPage: true,
    });

    // Mode couleurs forcées : la bordure (transparente sinon) reste le contour du bouton.
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(cta).toHaveCSS('border-top-style', 'solid');
    expect(
      Number.parseFloat(
        await cta.evaluate((el) => getComputedStyle(el).borderTopWidth),
      ),
    ).toBeGreaterThan(0);
  });
}

test('accueil : le Hero remplit l’écran sous le header, centré, et mène aux projets', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('section#accueil > .hero')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  const layout = await page.evaluate(() => {
    // --header-height en pixels, même sonde que tests/accueil.spec.ts.
    const probe = document.createElement('div');
    probe.style.height = 'var(--header-height)';
    document.body.append(probe);
    const headerHeight = probe.getBoundingClientRect().height;
    probe.remove();

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
  });

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
  await page.getByRole('link', { name: 'Découvrir les projets' }).click();
  await expect(page).toHaveURL(/#projets$/);
  await expect
    .poll(() =>
      page.locator('#projets').evaluate((el) => el.getBoundingClientRect().top),
    )
    .toBeCloseTo(layout.headerHeight, 0);
});
