// Vidéo de fond du Hero sur iOS et Android : muette, en boucle, sans contrôles, cachée aux
// lecteurs d'écran. Rien n'est lu si l'utilisateur a demandé de réduire les animations.
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import source from '../../public/accueil/bienvenue.mp4';

export default function HeroVideo() {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  const player = useVideoPlayer(reduceMotion === false ? source : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  if (reduceMotion !== false) return null;
  return (
    <VideoView
      player={player}
      contentFit="cover"
      nativeControls={false}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    />
  );
}
