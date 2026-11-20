// Thème clair et sombre des composants (ADR 0015).
// Web : chaque couleur est une variable CSS (web-css.ts), le thème suit donc `prefers-color-scheme`
// dès le HTML pré-rendu, sans JavaScript, et `data-theme` le surcharge sur un conteneur.
// iOS et Android : le thème du système (useColorScheme), surchargé par ThemeScope.
import { createContext, use, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  useColorScheme,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  colorNames,
  palettes,
  type ColorName,
  type Colors,
  type Scheme,
} from './tokens';

/** `textMuted` → `--color-text-muted`. */
export const cssVariable = (name: ColorName) =>
  `--color-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const webColors = Object.fromEntries(
  colorNames.map((name) => [name, `var(${cssVariable(name)})`]),
) as Colors;

/** Couleurs d'un thème : variables CSS sur le web (le thème suit le CSS), valeurs sur iOS et Android. */
const colorsFor = (scheme: Scheme) =>
  Platform.OS === 'web' ? webColors : palettes[scheme];

const SchemeContext = createContext<Scheme | null>(null);

const useScheme = (): Scheme => {
  const system = useColorScheme();
  return use(SchemeContext) ?? (system === 'dark' ? 'dark' : 'light');
};

/**
 * Styles qui dépendent des couleurs du thème : `const useStyles = themedStyles((c) => ({…}))`.
 * Les feuilles sont créées une fois, au chargement du module : sur le web, une seule, pré-rendue en
 * classes CSS (jamais d'attribut style, refusé par la CSP) ; sur iOS et Android, une par thème.
 */
export const themedStyles = <T extends Record<string, ViewStyle | TextStyle>>(
  make: (colors: Colors) => T,
) => {
  if (Platform.OS === 'web') {
    const sheet = StyleSheet.create(make(webColors));
    return () => sheet;
  }
  const sheets = {
    light: StyleSheet.create(make(colorsFor('light'))),
    dark: StyleSheet.create(make(colorsFor('dark'))),
  };
  return function useThemedStyles() {
    return sheets[useScheme()];
  };
};

/** Fond de chaque thème, quel que soit le thème du parent. */
const scopeStyles = StyleSheet.create({
  light: { backgroundColor: colorsFor('light').background },
  dark: { backgroundColor: colorsFor('dark').background },
});

interface ThemeScopeProps {
  scheme: Scheme;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Conteneur qui impose un thème à son contenu, avec le fond de ce thème (surchargeable par `style`). */
export function ThemeScope({ scheme, style, children }: ThemeScopeProps) {
  return (
    <SchemeContext value={scheme}>
      <View dataSet={{ theme: scheme }} style={[scopeStyles[scheme], style]}>
        {children}
      </View>
    </SchemeContext>
  );
}
