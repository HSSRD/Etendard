import { createServer } from 'node:net';
import { defineConfig, devices } from '@playwright/test';

const ci = !['', '0', 'false'].includes(process.env['CI'] ?? '');

/**
 * Port libre choisi une fois par lancement, puis hérité par les workers via l'environnement :
 * deux worktrees (ou un `astro dev`) ne partagent jamais le serveur de test. Si le port est
 * repris pendant le build, `astro preview` échoue (strictPort) au lieu de servir ailleurs.
 */
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('port introuvable')),
      );
    });
  });
process.env['E2E_PORT'] ??= String(await freePort());
const port = process.env['E2E_PORT'];
const baseURL = `http://localhost:${port}`;

/**
 * Les captures ne sont fiables que dans l'image Docker officielle de Playwright (ADR 0003),
 * reconnaissable à l'emplacement de ses navigateurs. Ailleurs, `toHaveScreenshot` est ignoré,
 * sauf en CI où ce serait un faux vert.
 */
const inPlaywrightImage =
  process.env['PLAYWRIGHT_BROWSERS_PATH'] === '/ms-playwright';
if (ci && !inPlaywrightImage) {
  throw new Error('En CI, Playwright doit tourner dans son image Docker.');
}

const widths = [375, 768, 1280];

export default defineConfig({
  testMatch: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
  forbidOnly: ci,
  reporter: ci ? 'github' : 'list',
  ignoreSnapshots: !inPlaywrightImage,
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__captures__/{testFileName}/{arg}-{projectName}{ext}',
  use: { baseURL },
  projects: widths.map((width) => ({
    name: `chromium-${width}`,
    use: { ...devices['Desktop Chrome'], viewport: { width, height: 900 } },
  })),
  webServer: {
    // Build dédié avec le styleguide, séparé de dist/ qui est publié.
    command: `pnpm exec astro build --outDir dist-styleguide && pnpm exec astro preview --outDir dist-styleguide --port ${port}`,
    env: { STYLEGUIDE: '1' },
    url: baseURL,
    timeout: 300_000,
  },
});
