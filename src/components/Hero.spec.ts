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
    await expect(hero.locator('.hero__lead')).toHaveText(
      'Bienvenue ! Voici le site qui regroupe tous les projets de Hussard.',
    );
    const cta = hero.getByRole('link', { name: 'Découvrir les projets' });
    await expect(cta).toHaveAttribute('href', '#projets');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`hero-${scheme}.png`, {
      fullPage: true,
    });

    // État focus clavier du CTA.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
    await expect(page).toHaveScreenshot(`hero-${scheme}-focus.png`, {
      fullPage: true,
    });
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

    const box = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`${selector} introuvable`);
      return element.getBoundingClientRect();
    };
    return {
      expectedHeight: window.innerHeight - headerHeight,
      section: box('#accueil'),
      projets: box('#projets'),
      title: box('.hero__title'),
      cta: box('.hero__cta'),
    };
  });

  expect(layout.section.height).toBeCloseTo(layout.expectedHeight, 0);
  expect(layout.projets.top).toBeCloseTo(layout.section.bottom, 0);

  // Contenu centré : marges égales de part et d'autre, verticalement et horizontalement.
  const above = layout.title.top - layout.section.top;
  const below = layout.section.bottom - layout.cta.bottom;
  expect(above).toBeGreaterThan(0);
  expect(above).toBeCloseTo(below, 0);
  const sectionCenter = layout.section.left + layout.section.width / 2;
  for (const element of [layout.title, layout.cta]) {
    expect(element.left + element.width / 2).toBeCloseTo(sectionCenter, 0);
  }

  // L'appel à l'action mène à la section projets, qui existe et s'affiche.
  await page.getByRole('link', { name: 'Découvrir les projets' }).click();
  await expect(page).toHaveURL(/#projets$/);
  await expect(page.locator('#projets')).toBeInViewport();
});
