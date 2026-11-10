import { expect, test } from '@playwright/test';
import { hexToRgb } from './helpers';

test('l’icône référencée est un SVG servi aux couleurs de tokens.css', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute('type', 'image/svg+xml');

  const response = await request.get((await icon.getAttribute('href')) ?? '');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml\b/);

  // Valeurs des tokens au thème clair, au format de getComputedStyle.
  const tokens = await page.evaluate(() =>
    ['--color-accent', '--color-surface'].map((token) => {
      const probe = document.createElement('div');
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }),
  );
  const svg = await response.text();
  expect(svg).not.toMatch(/#[0-9a-f]{3}\b|rgb\(|hsl\(/i);
  const colors = [...new Set(svg.match(/#[0-9a-f]{6}\b/gi))].map(hexToRgb);
  expect(colors.sort()).toEqual(tokens.sort());
});

test('la page d’accueil émet les métadonnées Open Graph', async ({ page }) => {
  await page.goto('/');
  const og = (property: string) =>
    page.locator(`meta[property="og:${property}"]`);
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute('content');

  await expect(og('title')).toHaveAttribute('content', await page.title());
  await expect(og('description')).toHaveAttribute('content', description ?? '');
  await expect(og('type')).toHaveAttribute('content', 'website');
  await expect(og('locale')).toHaveAttribute('content', 'fr_FR');
  await expect(og('site_name')).toHaveAttribute('content', 'Étendard');
});
