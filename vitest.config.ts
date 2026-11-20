import { defineConfig } from 'vitest/config';

// Vitest teste la logique TypeScript ; les *.spec.ts sont des tests Playwright (ADR 0003).
// react-native est remplacé par react-native-web : les modules du thème s'importent sous Node.
export default defineConfig({
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
  },
});
