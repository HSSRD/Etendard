// Section d'accueil de la one page (ticket #13) : seul titre de niveau 1 de la page et appel à
// descendre vers les projets, sur une vidéo de fond (ticket #22) voilée, aux bords assombris,
// dont le bas se fond dans le fond de la page. Toujours en thème sombre.
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextLink } from '@/lib/anchors';
import { ThemeScope, themedStyles } from '@/theme/theme';
import {
  borderWidth,
  css,
  fontSize,
  fontWeight,
  hero,
  layout,
  radius,
  screenBelowHeader,
  space,
} from '@/theme/tokens';
import { paragraph, useTypography } from '@/theme/typography';
import HeroVideo from './HeroVideo';

export default function Hero() {
  const styles = useStyles();
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  // iOS et Android : l'écran sous le header (sur le web, la hauteur vient du CSS, sans JavaScript).
  const fill = Platform.OS !== 'web' && {
    minHeight: height - top - bottom - layout.headerHeight,
  };
  return (
    <View testID="hero" style={[styles.hero, fill]}>
      <HeroVideo />
      <View
        testID="hero-overlay"
        style={[StyleSheet.absoluteFill, styles.overlay]}
        aria-hidden
      />
      <ThemeScope scheme="dark" style={styles.transparent}>
        <Content />
      </ThemeScope>
    </View>
  );
}

/** Contenu en thème sombre (couleurs du ThemeScope), sans fond : la vidéo reste visible. */
function Content() {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <View style={styles.content}>
      <Text
        role="heading"
        aria-level={1}
        style={[typography.h1, styles.center]}
      >
        Étendard
      </Text>
      <Text
        role={paragraph}
        style={[typography.body, styles.lead, styles.center]}
      >
        Bienvenue{' '}! Voici le site qui regroupe tous les projets de Hussard.
      </Text>
      <TextLink
        href="#projets"
        dataSet={{ hover: 'underline' }}
        style={[typography.body, styles.cta]}
      >
        Découvrir les projets
      </TextLink>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  hero: {
    backgroundColor: hero.shade,
    justifyContent: 'center',
    minHeight: screenBelowHeader,
    paddingHorizontal: space[4],
    paddingVertical: space[9],
  },
  // Voile, vignettage, et bas fondu dans le fond de la page sur le seul padding bas :
  // le texte, toujours clair, ne passe jamais sur le fondu (thème clair).
  overlay: {
    backgroundColor: hero.veil,
    backgroundImage: [
      css(
        `linear-gradient(transparent calc(100% - ${space[9]}px), ${colors.background})`,
        `linear-gradient(transparent ${hero.fadeStop}, ${colors.background})`,
      ),
      `radial-gradient(transparent ${hero.vignetteStop}, ${hero.shade})`,
    ].join(', '),
  },
  transparent: { backgroundColor: 'transparent' },
  content: { alignItems: 'center', rowGap: space[5] },
  center: { textAlign: 'center' },
  lead: { fontSize: fontSize.lg, textWrap: 'balance' },
  // Bordure transparente : seul contour du bouton en mode couleurs forcées.
  cta: {
    backgroundColor: colors.accent,
    borderColor: 'transparent',
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth,
    color: colors.background,
    fontWeight: fontWeight.bold,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    textDecorationLine: 'none',
  },
}));
