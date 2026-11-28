import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// Le site publié, dist/ (playwright.publie.config.ts) : son JavaScript ne connaît pas le styleguide (#85).

/**
 * `expo serve` répond « Not Found » en texte brut à une adresse sans fichier ; sur le serveur, Caddy
 * sert alors la page 404 d'Expo avec le statut 404. Le test reprend cette règle du Caddyfile.
 */
const caddyfile = await readFile(
  new URL('../infra/pi/Caddyfile', import.meta.url),
  'utf8',
);
// Première réécriture du bloc, même précédée de commentaires ou de directives sans accolade.
const notFoundPage =
  /^\s*handle_errors 404 \{[^}]*?^\s*rewrite \* (\S+)$/m.exec(caddyfile)?.[1];
if (!notFoundPage)
  throw new Error('réécriture des 404 introuvable dans infra/pi/Caddyfile');

/** Ouvre `url` avec la page 404 de Caddy, attend l'hydratation et renvoie le statut. */
const open = async (page: Page, url: string) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Chromium signale le statut 404 du document lui-même : attendu ici.
    const documentStatus =
      message.location().url === page.url() &&
      /status of 404/.test(message.text());
    if (!documentStatus) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  // Seul le document ouvert : les fichiers d'Expo ne passent pas par le test.
  await page.route(url, async (route) => {
    const response = await route.fetch();
    if (response.status() !== 404) return route.fulfill({ response });
    const fallback = await route.fetch({
      url: new URL(notFoundPage, route.request().url()).href,
    });
    expect(fallback.status(), notFoundPage).toBe(200);
    await route.fulfill({ response: fallback, status: 404 });
  });

  const response = await page.goto(url);
  // Les scripts d'Expo ont tourné : React a hydraté le titre pré-rendu.
  const h1 = page.getByRole('heading', { level: 1 });
  await expect
    .poll(() =>
      h1.evaluate((heading) =>
        Object.keys(heading).some((key) => key.startsWith('__reactFiber')),
      ),
    )
    .toBe(true);
  // Une route inconnue du serveur mais connue du JavaScript remplacerait la page après hydratation.
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
  return { status: response?.status(), h1 };
};

test('/ répond 200 et affiche la one page', async ({ page }) => {
  const { status } = await open(page, '/');
  expect(status).toBe(200);
  await expect(page).toHaveTitle(/Étendard/);
  await expect(page.locator('#accueil')).toBeVisible();
});

for (const url of ['/adresse-inconnue', '/styleguide', '/styleguide/hero']) {
  test(`${url} répond 404 avec la page 404 du site`, async ({ page }) => {
    const { status, h1 } = await open(page, url);
    expect(status).toBe(404);
    await expect(page).toHaveTitle('Page introuvable — Étendard');
    await expect(h1).toHaveText('Page introuvable');
  });
}
