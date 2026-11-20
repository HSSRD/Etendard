// Props de react-native-web absentes des types de React Native (ADR 0015) : ignorées sur iOS et Android.
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    /** Attributs `data-*` sur le web. */
    dataSet?: Record<string, string>;
  }

  interface TextProps {
    /** Attributs `data-*` sur le web. */
    dataSet?: Record<string, string>;
    /** Lien : rendu en `<a href>` sur le web. */
    href?: string;
    hrefAttrs?: { rel?: string; target?: string; download?: boolean };
    /** Transmis à l'élément DOM : texte du HTML pré-rendu gardé à l'hydratation. */
    suppressHydrationWarning?: boolean;
  }
}
