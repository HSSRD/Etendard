import { defineConfig, devices } from '@playwright/test';

// Port distinct de celui d'astro dev (4321) : les tests ne visent jamais le serveur de dev.
const port = 4322;
const baseURL = `http://localhost:${port}`;

/**
 * Les captures ne sont fiables que dans l'image Docker officielle de Playwright (ADR 0003),
 * reconnaissable à l'emplacement de ses navigateurs. Ailleurs, `toHaveScreenshot` est ignoré.
 */
const inPlaywrightImage =
  process.env['PLAYWRIGHT_BROWSERS_PATH'] === '/ms-playwright';

const widths = [375, 768, 1280];

export default defineConfig({
  testMatch: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  ignoreSnapshots: !inPlaywrightImage,
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__captures__/{testFileName}/{arg}-{projectName}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled' } },
  use: { baseURL },
  projects: widths.map((width) => ({
    name: `chromium-${width}`,
    use: { ...devices['Desktop Chrome'], viewport: { width, height: 900 } },
  })),
  webServer: {
    // Build dédié avec le styleguide, séparé de dist/ qui est publié.
    command: `astro build --outDir dist-styleguide && astro preview --outDir dist-styleguide --port ${port}`,
    env: { STYLEGUIDE: '1' },
    url: baseURL,
    reuseExistingServer: false,
  },
});
