import { expect, test } from '@playwright/test';

test('l’icône référencée est un SVG servi', async ({ page, request }) => {
  await page.goto('/');
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute('type', 'image/svg+xml');

  const href = await icon.getAttribute('href');
  const response = await request.get(href ?? '');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml\b/);
});

test('les couleurs de l’icône sont celles de tokens.css', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  const svg = await (await request.get(href ?? '')).text();

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
  const colors = [...new Set(svg.match(/#[0-9a-f]{6}\b/gi))].map((hex) => {
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(hex.slice(i, i + 2), 16),
    );
    return `rgb(${r}, ${g}, ${b})`;
  });
  expect(svg).not.toMatch(/#[0-9a-f]{3}\b|rgb\(|hsl\(/i);
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
