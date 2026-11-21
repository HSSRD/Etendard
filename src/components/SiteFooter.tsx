// Bas de page du site (ticket #12), rendu dans l'emplacement « footer » de BaseLayout.
import { Text, View } from 'react-native';
import { TextLink } from '@/lib/anchors';
import { themedStyles } from '@/theme/theme';
import { borderWidth, fontSize, space } from '@/theme/tokens';
import { pageStyles } from '@/layouts/page-styles';
import { paragraph, useTypography } from '@/theme/typography';

interface Props {
  /** Année du copyright ; par défaut celle du build. Figée sur le styleguide pour les captures. */
  year?: number;
}

export default function SiteFooter({ year = new Date().getFullYear() }: Props) {
  const styles = useStyles();
  const typography = useTypography();
  const text = [typography.body, styles.text];
  return (
    <View role="contentinfo" style={styles.footer}>
      <View style={[pageStyles.column, styles.inner]}>
        <Text role={paragraph} style={[text, styles.tagline]}>
          Étendard, la vitrine des projets HSSRD
        </Text>
        {/* Année du build, figée dans le HTML pré-rendu : l'hydratation la garde. */}
        <Text role={paragraph} style={text} suppressHydrationWarning>
          © {year} HSSRD
        </Text>
        <Text role={paragraph} style={text}>
          <TextLink
            href="https://github.com/HSSRD/Etendard"
            rel="noopener"
            style={typography.link}
          >
            Code source sur GitHub
          </TextLink>
        </Text>
        <Text role={paragraph} style={text}>
          <TextLink href="#accueil" style={typography.link}>
            Retour en haut
          </TextLink>
        </Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  footer: { borderTopColor: colors.border, borderTopWidth: borderWidth },
  inner: {
    alignItems: 'center',
    columnGap: space[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: space[6],
    rowGap: space[2],
  },
  text: { color: colors.textMuted, fontSize: fontSize.sm },
  tagline: { color: colors.text },
}));
