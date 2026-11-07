import { defineConfig } from 'vitest/config';

// Vitest teste la logique TypeScript ; les *.spec.ts sont des tests Playwright (ADR 0003).
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], passWithNoTests: true },
});
