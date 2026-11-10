import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { schemes, themeBackground } from './helpers';

/** La CSP n'est écrite que dans le Caddyfile du Pi (ticket #25) : le test la lit là. */
const caddyfile = await readFile(
  new URL('../infra/pi/Caddyfile', import.meta.url),
  'utf8',
);
const csp = /^\s*Content-Security-Policy "([^"]+)"$/m.exec(caddyfile)?.[1];

test('la one page s’affiche sans violation de la CSP de Caddy', async ({
  page,
}) => {
  expect(csp).toMatch(/frame-ancestors 'none'/);
  expect(csp).not.toMatch(/unsafe-inline/);

  // Chromium signale chaque ressource bloquée par la CSP dans la console, en erreur.
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Toutes les réponses reçoivent la CSP, comme sous Caddy.
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp ?? '' },
    });
  });

  for (const scheme of schemes) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    // Fond du thème : les feuilles de style ont bien été appliquées.
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      await themeBackground(page, scheme),
    );
  }
  expect(errors).toEqual([]);
});
