// Structure commune des pages web (ADR 0015) : <head> de la page, lien d'évitement,
// header, <main id="contenu">, footer. La page défile dans le document : ancres sans JavaScript.
import { usePathname } from 'expo-router';
import { View } from 'react-native';
import { TextLink } from '@/lib/anchors';
import { themedStyles } from '@/theme/theme';
import { radius, shadow, space, zIndex } from '@/theme/tokens';
import { useTypography } from '@/theme/typography';
import type { BaseLayoutProps } from './BaseLayout';

export default function BaseLayout({
  title,
  description,
  noindex,
  header,
  footer,
  children,
}: BaseLayoutProps) {
  // Page hors index des moteurs de recherche : par défaut, tout le styleguide.
  const pathname = usePathname();
  const hidden = noindex ?? /^\/styleguide(\/|$)/.test(pathname);
  const typography = useTypography();
  const styles = useStyles();
  return (
    <>
      {/* Balises hissées dans le <head> par React 19, au rendu statique comme au client. */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {hidden && <meta name="robots" content="noindex" />}
      <TextLink
        href="#contenu"
        dataSet={{ skipLink: '' }}
        style={[typography.body, typography.link, styles.skipLink]}
      >
        Aller au contenu
      </TextLink>
      {header}
      <View role="main" id="contenu">
        {children}
      </View>
      {footer}
    </>
  );
}

const useStyles = themedStyles((colors) => ({
  skipLink: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    boxShadow: shadow(colors).md,
    left: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    position: 'absolute',
    top: space[2],
    zIndex: zIndex.skipLink,
  },
}));
