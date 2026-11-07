import { rm } from 'node:fs/promises';
import { defineConfig } from 'astro/config';

/** Les pages /styleguide ne sont publiées que si STYLEGUIDE=1 (ADR 0003). */
const styleguide = {
  name: 'styleguide',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      if (process.env.STYLEGUIDE !== '1') {
        await rm(new URL('styleguide/', dir), { recursive: true, force: true });
      }
    },
  },
};

export default defineConfig({
  output: 'static',
  integrations: [styleguide],
  // `astro preview` échoue si son port est pris au lieu d'en changer en silence (tests e2e).
  vite: { preview: { strictPort: true } },
});
