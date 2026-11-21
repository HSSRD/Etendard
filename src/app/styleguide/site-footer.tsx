// SiteFooter (ticket #12) : un seul état (année figée pour des captures stables), testé dans les
// deux thèmes par SiteFooter.spec.ts.
import { Text, View } from 'react-native';
import SiteFooter from '@/components/SiteFooter';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { useTypography } from '@/theme/typography';

export default function SiteFooterPage() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="SiteFooter — Styleguide — Étendard"
      description="Bas de page d’Étendard : publication, code source et retour en haut."
      footer={<SiteFooter year={2026} />}
    >
      {/* Cible du lien « Retour en haut », comme la section d'accueil de la one page. */}
      <View style={[pageStyles.column, pageStyles.page]}>
        <Text role="heading" aria-level={1} id="accueil" style={typography.h1}>
          SiteFooter
        </Text>
      </View>
    </BaseLayout>
  );
}
