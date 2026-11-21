// Design tokens (ADR 0015) : seule source des valeurs visuelles du site et des apps.
// Couleurs par thème : sur le web, les composants les lisent en variables CSS (web-css.ts), le thème
// suit donc `prefers-color-scheme` sans JavaScript ; sur iOS et Android, par useColorScheme (theme.tsx).
// --color-background est repris par les <meta name="theme-color"> (+html.tsx),
// accent et surface (thème clair) par public/favicon.svg.
import { Platform } from 'react-native';

/** Contrastes WCAG AA vérifiés par axe sur /styleguide/tokens. */
export const palettes = {
  light: {
    background: '#f6f7f9',
    surface: '#ffffff',
    text: '#14171c',
    textMuted: '#525a66',
    accent: '#1f5fc4',
    border: '#d4d9e1',
    focus: '#1f5fc4',
    shadow: '#14171c1f',
  },
  dark: {
    background: '#0e1116',
    surface: '#171b22',
    text: '#e7e9ee',
    textMuted: '#a3abb8',
    accent: '#7eaaf5',
    border: '#2d333d',
    focus: '#7eaaf5',
    shadow: '#00000080',
  },
} as const;

export type Scheme = keyof typeof palettes;
export type ColorName = keyof (typeof palettes)['light'];
export type Colors = Record<ColorName, string>;
export const colorNames = Object.keys(palettes.light) as ColorName[];

/** Section d'accueil, toujours sombre : fond sous la vidéo et voile posé dessus. */
export const hero = {
  shade: '#000000',
  veil: '#000000a6',
  /** Début du vignettage des bords. */
  vignetteStop: '45%',
  /** iOS et Android : début du fondu du bas (le web le pose sur le padding bas, en calc()). */
  fadeStop: '85%',
} as const;

/** Espacements, en px. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
} as const;

/** Polices système : le web reçoit la pile CSS, iOS et Android leur police par défaut. */
export const fontFamily = {
  sans: Platform.select({
    web: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  }),
  mono: Platform.select({
    web: "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace",
    ios: 'Menlo',
    default: 'monospace',
  }),
};

/**
 * Valeur CSS passée telle quelle par react-native-web (clamp(), calc(), unités de fenêtre),
 * remplacée par `native` sur iOS et Android. Le type est celui de la valeur native.
 */
export const css = <T>(web: string, native: T): T =>
  Platform.OS === 'web' ? (web as T) : native;

/** Mise en page. */
export const layout = {
  contentMaxWidth: 1152,
  headerHeight: 64,
  /** Largeur à partir de laquelle les cartes de projets passent sur deux colonnes. */
  twoColumns: 768,
} as const;

/** Hauteur d'un écran sous le header (web) ; iOS et Android la calculent avec la fenêtre. */
export const screenBelowHeader = css<number | undefined>(
  `calc(100svh - ${layout.headerHeight}px)`,
  undefined,
);

export const fontSize = {
  sm: 14,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  /** Titre du site : grandit avec la fenêtre sur le web, de 36 à 56 px. */
  '3xl': css('clamp(36px, calc(24px + 3vw), 56px)', 40),
} as const;

export const fontWeight = { regular: '400', bold: '700' } as const;

/** Interlignes, en facteur de la taille de police. */
export const lineHeight = { tight: 1.2, base: 1.6 } as const;

/** Hauteur de ligne : facteur sur le web, px sur iOS et Android (qui n'acceptent pas de facteur). */
export const leading = (size: number, factor: number) =>
  css(String(factor), Math.round(size * factor));

export const radius = { sm: 4, md: 8, lg: 16 } as const;

export const borderWidth = 1;

export const focus = { width: 3, offset: 2 } as const;

/** Décalage du soulignement des liens (web). */
export const underlineOffset = '0.15em';

/** Ombres CSS, couleur de l'ombre du thème courant comprise. */
export const shadow = (colors: Colors) => ({
  sm: `0 1px 2px ${colors.shadow}`,
  md: `0 4px 12px ${colors.shadow}`,
});

export const zIndex = { header: 10, skipLink: 20 } as const;
