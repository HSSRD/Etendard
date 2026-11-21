// Vidéo de fond du Hero sur le web (ticket #22) : décorative, muette, sans JavaScript.
// Les sources ne s'appliquent pas en mouvement réduit : seul le poster s'affiche, rien n'est téléchargé.
import { StyleSheet } from 'react-native';
import { unstable_createElement as createElement } from 'react-native-web';

const noMotion = '(prefers-reduced-motion: no-preference)';

export default function HeroVideo() {
  // <video> avec les styles de StyleSheet, compilés en classes comme ceux des composants.
  return createElement('video', {
    testID: 'hero-video',
    style: [StyleSheet.absoluteFill, styles.video],
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: 'metadata',
    poster: '/accueil/bienvenue.avif',
    'aria-hidden': true,
    children: [
      <source
        key="webm"
        src="/accueil/bienvenue.webm"
        type="video/webm"
        media={noMotion}
      />,
      <source
        key="mp4"
        src="/accueil/bienvenue.mp4"
        type="video/mp4"
        media={noMotion}
      />,
    ],
  });
}

const styles = StyleSheet.create({
  video: { height: '100%', objectFit: 'cover', width: '100%' },
});
