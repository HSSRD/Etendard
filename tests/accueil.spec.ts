import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, schemes, themeBackground } from './helpers';

test('la page d’accueil pose la structure de la one page', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page).toHaveTitle('Étendard');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /.+/,
  );
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1',
  );

  const main = page.locator('main#contenu');
  await expect(main.locator('section#accueil h1')).toHaveText('Étendard');
  await expect(main.locator('section#projets h2')).toHaveText('Projets');
  await expect(page.locator('script')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('le lien d’évitement apparaît au clavier et mène au contenu', async ({
  page,
}) => {
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(skipLink).toHaveAttribute('href', '#contenu');
  await expect(skipLink).toHaveCSS('opacity', '0');

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS('opacity', '1');
  await expect(page).toHaveScreenshot('lien-evitement.png');

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#contenu$/);
});

test('les ancres défilent en douceur et s’arrêtent sous le header', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');

  // --header-height converti en pixels, comme getComputedStyle le renvoie.
  const headerHeight = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.height = 'var(--header-height)';
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return `${height}px`;
  });
  expect(headerHeight).not.toBe('0px');
  for (const id of ['accueil', 'projets']) {
    await expect(page.locator(`#${id}`)).toHaveCSS(
      'scroll-margin-top',
      headerHeight,
    );
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  const durations = await page.evaluate(() =>
    ['--duration-fast', '--duration-base'].map((token) =>
      getComputedStyle(document.documentElement).getPropertyValue(token),
    ),
  );
  expect(durations).toEqual(['0s', '0s']);
});

for (const scheme of schemes) {
  test(`thème ${scheme} : fond, accessibilité et capture`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');

    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      await themeBackground(page, scheme),
    );
    await expectNoAxeViolations(page);
    await expect(page).toHaveScreenshot(`accueil-${scheme}.png`, {
      fullPage: true,
    });
  });
}

test('data-theme sur <html> surcharge prefers-color-scheme', async ({
  page,
}) => {
  await page.goto('/');
  const html = page.locator('html');
  const body = page.locator('body');

  for (const scheme of schemes) {
    const other = scheme === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: other });
    await html.evaluate(
      (element, theme) => element.setAttribute('data-theme', theme),
      scheme,
    );
    await expect(body).toHaveCSS(
      'background-color',
      await themeBackground(page, scheme),
    );
  }
});
