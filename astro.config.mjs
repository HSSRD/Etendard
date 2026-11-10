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
  // CSS en fichiers /_astro/*.css, jamais en <style> : la CSP de
  // infra/pi/Caddyfile s'en tient à style-src 'self' (ticket #25).
  build: { inlineStylesheets: 'never' },
  integrations: [styleguide],
  // Tests e2e : `astro preview` échoue si son port est pris au lieu d'en changer en silence.
  vite: { preview: { strictPort: process.env.E2E_PORT !== undefined } },
});
