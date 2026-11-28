import { defineConfig, devices } from '@playwright/test';
import base, { baseURL, port } from './playwright.config';

/**
 * Le site publié (ADR 0003) : dist/, sans styleguide, tel que `pnpm build` l'a validé et que
 * deploy.yml l'archive. Lancé par `pnpm test:publie` dans `pnpm verify`, après le build et
 * ses contrôles ; il ne reconstruit rien, pour tester exactement ces fichiers.
 */
export default defineConfig({
  ...base,
  testMatch: 'tests/site-publie.spec.ts',
  testIgnore: [],
  fullyParallel: true,
  projects: [{ name: 'publie', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `pnpm exec expo serve dist --port ${port}`,
    url: baseURL,
  },
});
