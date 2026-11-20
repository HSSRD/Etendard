// En-tête de la one page : nom du site et navigation par ancres (ticket #11).
// Web : collant en haut de la page ; iOS et Android : fixe au-dessus du ScrollView (BaseLayout).
import { View } from 'react-native';
import { TextLink } from '@/lib/anchors';
import { themedStyles } from '@/theme/theme';
import {
  borderWidth,
  css,
  fontSize,
  fontWeight,
  layout,
  space,
  zIndex,
} from '@/theme/tokens';
import { pageStyles } from '@/layouts/page-styles';
import { useTypography } from '@/theme/typography';

const links = [
  { href: '#accueil', label: 'Accueil' },
  { href: '#projets', label: 'Projets' },
];

export default function SiteHeader() {
  const styles = useStyles();
  const typography = useTypography();
  const link = [typography.body, styles.link];
  return (
    <View role="banner" style={styles.header}>
      <View style={[pageStyles.column, styles.inner]}>
        <TextLink
          href="#accueil"
          dataSet={{ hover: 'underline' }}
          style={[link, styles.brand]}
        >
          Étendard
        </TextLink>
        <View role="navigation" aria-label="Navigation principale">
          <View role="list" style={styles.list}>
            {links.map(({ href, label }) => (
              <View role="listitem" key={href}>
                <TextLink
                  href={href}
                  dataSet={{ hover: 'underline' }}
                  style={link}
                >
                  {label}
                </TextLink>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  // Même fond que la page (et que <meta name="theme-color">), séparé par une bordure.
  // Hauteur minimale : avec un texte agrandi, le header passe à la ligne au lieu de déborder.
  header: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidth,
    minHeight: layout.headerHeight,
    position: css('sticky', 'relative'),
    top: 0,
    zIndex: zIndex.header,
  },
  inner: {
    // alignContent : avec flexWrap, la ligne est centrée dans la hauteur du header (RN Web la colle en haut).
    alignContent: 'center',
    alignItems: 'center',
    columnGap: space[4],
    flexDirection: 'row',
    flexGrow: 1,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  // Marge verticale : cible de tap plus haute que la ligne de texte.
  link: { paddingVertical: space[1] },
  brand: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  list: { columnGap: space[5], flexDirection: 'row', flexWrap: 'wrap' },
}));
