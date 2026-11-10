import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { schemes, themeBackground } from './helpers';

/** La CSP n'est écrite que dans le Caddyfile du Pi (ticket #25) : le test la lit là. */
const caddyfile = await readFile(
  new URL('../infra/pi/Caddyfile', import.meta.url),
  'utf8',
);
const csp = /^\s*Content-Security-Policy "([^"]+)"$/m.exec(caddyfile)?.[1];
if (!csp) throw new Error('CSP introuvable dans infra/pi/Caddyfile');

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
  // La CSP de la page est celle de la réponse HTML : seul le document la reçoit.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });

  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toBe(csp);
  const body = page.locator('body');
  for (const scheme of schemes) {
    await page.emulateMedia({ colorScheme: scheme });
    // Fond du thème : les feuilles de style ont bien été appliquées.
    await expect(body).toHaveCSS(
      'background-color',
      await themeBackground(page, scheme),
    );
  }
  expect(errors).toEqual([]);

  // Témoin : la CSP est bien appliquée, un <style> en ligne est refusé.
  await expect(
    page.addStyleTag({ content: 'body { background-color: red; }' }),
  ).rejects.toThrow(/Content Security Policy/);
});
