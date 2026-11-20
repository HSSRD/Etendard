// Modules sans types fournis (ADR 0015).

declare module 'react-native-web' {
  /** Élément DOM quelconque, avec les props de React Native (style compilé en classes, aria-*). */
  export function unstable_createElement(
    type: string,
    props: Record<string, unknown>,
  ): import('react').ReactElement;
}

/** Vidéo importée : identifiant d'asset de Metro (iOS et Android). */
declare module '*.mp4' {
  const asset: number;
  export default asset;
}
