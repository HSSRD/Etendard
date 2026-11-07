/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Config Vite d'Astro : alias `@/` et modules `astro:*` disponibles dans les tests.
// Vitest teste la logique TypeScript ; les *.spec.ts sont des tests Playwright (ADR 0003).
export default getViteConfig({
  test: { include: ['src/**/*.test.ts'], passWithNoTests: true },
});
