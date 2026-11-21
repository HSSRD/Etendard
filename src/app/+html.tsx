// Gabarit HTML des pages web exportées (ADR 0015). Le <head> propre à chaque page (titre,
// description, robots) vient de BaseLayout. Styles et scripts en ligne d'Expo sont sortis en
// fichiers par scripts/export-web.js : la CSP du Caddyfile refuse tout ce qui est en ligne.
import { useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';
import { palettes } from '@/theme/tokens';
import { webCss } from '@/theme/web-css';

export default function Root({ children }: { children: ReactNode }) {
  // Feuille de react-native-web, scripts et préchargements, insérés par Expo.
  const { headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        {/* Fond de la page de chaque thème (palettes.background), vérifié par les tests Playwright. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={palettes.light.background}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={palettes.dark.background}
        />
        {/* Couleurs de l'icône : accent et surface du thème clair (tokens.ts). */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:site_name" content="Étendard" />
        <style
          id="etendard-theme"
          dangerouslySetInnerHTML={{ __html: webCss }}
        />
        {headNodes}
      </head>
      <body>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
