// Mise en page commune des pages simples : styleguide (ADR 0003), page introuvable.
import { StyleSheet } from 'react-native';
import { css, layout, radius, space } from '@/theme/tokens';

export const pageStyles = StyleSheet.create({
  /** Contenu centré, à la largeur des sections de la one page. */
  page: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: space[4],
    paddingVertical: space[6],
    rowGap: space[6],
    width: '100%',
  },
  /** Un état d'un composant : son titre, puis le composant. */
  state: { rowGap: space[4] },
  /** Panneau d'un thème (ThemeScope), aux coins de sa bordure. */
  panel: { borderRadius: radius.lg },
  /** Bloc d'un écran sous le header. */
  screen: {
    minHeight: css(`calc(100svh - ${layout.headerHeight}px)`, 600),
    paddingHorizontal: space[4],
    paddingVertical: space[6],
  },
});
