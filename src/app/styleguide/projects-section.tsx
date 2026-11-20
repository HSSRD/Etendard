// ProjectsSection telle qu'insérée dans la one page (ticket #14).
import { Text, View } from 'react-native';
import ProjectsSection from '@/components/ProjectsSection';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { AnchorTarget } from '@/lib/anchors';
import { useTypography } from '@/theme/typography';

export default function ProjectsSectionPage() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="ProjectsSection — Styleguide — Étendard"
      description="Composant ProjectsSection d’Étendard : la section des projets."
    >
      {/* Aligné sur le contenu centré de la section. */}
      <View style={pageStyles.page}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          ProjectsSection
        </Text>
      </View>
      <AnchorTarget id="projets">
        <ProjectsSection />
      </AnchorTarget>
    </BaseLayout>
  );
}
