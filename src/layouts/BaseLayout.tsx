// Structure commune des pages sur iOS et Android (ADR 0015) : header fixe sous la barre d'état,
// puis le contenu et le footer dans un ScrollView que les liens « #x » font défiler.
// Le <head> et le lien d'évitement n'existent que sur le web (BaseLayout.web.tsx).
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnchorScrollView } from '@/lib/anchors';
import { themedStyles } from '@/theme/theme';

export interface BaseLayoutProps {
  title: string;
  description: string;
  /** Page hors index des moteurs de recherche (web) : par défaut, tout le styleguide. */
  noindex?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export default function BaseLayout({
  header,
  footer,
  children,
}: BaseLayoutProps) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={['top']} style={styles.page}>
      <AnchorScrollView header={header} style={styles.page}>
        {children}
        {footer}
      </AnchorScrollView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((colors) => ({
  page: { backgroundColor: colors.background, flex: 1 },
}));
