// Mises en page communes : colonne centrée des sections, pages simples (styleguide, page introuvable).
import { StyleSheet } from 'react-native';
import { layout, radius, screenBelowHeader, space } from '@/theme/tokens';

export const pageStyles = StyleSheet.create({
  /** Colonne centrée, à la largeur du contenu, avec sa marge latérale. */
  column: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingHorizontal: space[4],
    width: '100%',
  },
  /** Contenu d'une page simple, dans la colonne. */
  page: { paddingVertical: space[6], rowGap: space[6] },
  /** Titre au-dessus d'une section qui porte son propre padding. */
  heading: { paddingTop: space[6] },
  /** Un état d'un composant : son titre, puis le composant. */
  state: { rowGap: space[4] },
  /** Panneau d'un thème (ThemeScope), aux coins de sa bordure. */
  panel: { borderRadius: radius.lg },
  /** Bloc d'un écran sous le header. */
  screen: {
    minHeight: screenBelowHeader,
    paddingHorizontal: space[4],
    paddingVertical: space[6],
  },
});
