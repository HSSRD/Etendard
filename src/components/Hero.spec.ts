import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, schemes } from '../../tests/helpers';

const lead =
  'Bienvenue ! Voici le site qui regroupe tous les projets de Hussard.';

/** Le Hero : seul <h1>, texte d'accueil et appel à l'action vers #projets. */
const expectHeroContent = async (page: Page) => {
  const hero = page.locator('.hero');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Étendard');
  await expect(hero.locator('.hero__lead')).toHaveText(lead);
  await expect(
    hero.getByRole('link', { name: 'Découvrir les projets' }),
  ).toHaveAttribute('href', '#projets');
};

/** Aucun défilement horizontal à la largeur du projet (375 px compris). */
const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test('styleguide : le Hero affiche titre, texte et appel à l’action', async ({
  page,
}) => {
  await page.goto('/styleguide/hero');
  await expectHeroContent(page);
  await expectNoHorizontalScroll(page);
});

test('accueil : le Hero remplit l’écran sous le header, centré, projets juste dessous', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('section#accueil > .hero')).toHaveCount(1);
  await expectHeroContent(page);
  await expectNoHorizontalScroll(page);
  await expect(page.locator('script')).toHaveCount(0);

  const layout = await page.evaluate(() => {
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

  expect(layout.expectedHeight).toBeGreaterThan(0);
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
});

test('accueil : l’appel à l’action mène à la section projets', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Découvrir les projets' }).click();
  await expect(page).toHaveURL(/#projets$/);
});

for (const scheme of schemes) {
  test(`Hero, thème ${scheme} : accessibilité et capture`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/styleguide/hero');

    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`hero-${scheme}.png`, {
      fullPage: true,
    });
  });
}
