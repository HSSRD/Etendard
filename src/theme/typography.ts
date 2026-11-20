// Styles de texte communs (ADR 0015) : React Native n'hérite pas la police d'un parent View,
// chaque Text reçoit donc la sienne.
import type { Role } from 'react-native';
import { themedStyles } from './theme';
import {
  fontFamily,
  fontSize,
  fontWeight,
  leading,
  lineHeight,
} from './tokens';

const heading = (size: number) => ({
  fontFamily: fontFamily.sans,
  fontSize: size,
  fontWeight: fontWeight.bold,
  lineHeight: leading(size, lineHeight.tight),
});

export const useTypography = themedStyles((colors) => ({
  body: {
    color: colors.text,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    lineHeight: leading(fontSize.base, lineHeight.base),
  },
  h1: { ...heading(fontSize['3xl']), color: colors.text },
  h2: { ...heading(fontSize['2xl']), color: colors.text },
  h3: { ...heading(fontSize.xl), color: colors.text },
  link: { color: colors.accent, textDecorationLine: 'underline' },
  code: { fontFamily: fontFamily.mono },
}));

/** Rôle de react-native-web rendu en <p>, absent des types de React Native (sans effet sur iOS et Android). */
export const paragraph = 'paragraph' as Role;
