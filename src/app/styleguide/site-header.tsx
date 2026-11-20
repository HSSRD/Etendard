// SiteHeader (ticket #11). Un seul rendu statique ; les états survol, focus et texte agrandi sont
// produits et capturés par SiteHeader.spec.ts. Les blocs factices font chacun un écran : #projets
// n'est pas en bas de page, le défilement vers l'ancre dépend donc bien de scroll-margin-top.
import { Text, View } from 'react-native';
import SiteHeader from '@/components/SiteHeader';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { AnchorTarget } from '@/lib/anchors';
import { paragraph, useTypography } from '@/theme/typography';

export default function SiteHeaderPage() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="SiteHeader — Styleguide — Étendard"
      description="Styleguide d’Étendard : en-tête collant et navigation par ancres."
      header={<SiteHeader />}
    >
      <AnchorTarget id="accueil" style={pageStyles.screen}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          SiteHeader
        </Text>
      </AnchorTarget>
      <AnchorTarget id="projets" style={pageStyles.screen}>
        <Text role="heading" aria-level={2} style={typography.h2}>
          Projets
        </Text>
      </AnchorTarget>
      <View style={pageStyles.screen}>
        <Text role={paragraph} style={typography.body}>
          Suite de la page : #projets peut défiler jusque sous le header.
        </Text>
      </View>
    </BaseLayout>
  );
}
