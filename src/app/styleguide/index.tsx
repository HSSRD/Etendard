// Index du styleguide : chaque composant y ajoute un lien vers sa page (ADR 0003).
import { Text, View } from 'react-native';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { TextLink } from '@/lib/anchors';
import { useTypography } from '@/theme/typography';

const pages = [
  ['tokens', 'Tokens'],
  ['site-header', 'SiteHeader'],
  ['site-footer', 'SiteFooter'],
  ['hero', 'Hero'],
  ['project-card', 'ProjectCard'],
  ['projects-section', 'ProjectsSection'],
  ['status-badge', 'StatusBadge'],
  ['data-table', 'DataTable'],
  ['project-header', 'ProjectHeader'],
  ['project-section', 'ProjectSection'],
  ['project-nav', 'ProjectNav'],
  ['wiring-diagram', 'WiringDiagram'],
] as const;

export default function Styleguide() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="Styleguide — Étendard"
      description="Styleguide d’Étendard : chaque composant dans chacun de ses états."
    >
      <View style={[pageStyles.column, pageStyles.page]}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          Styleguide
        </Text>
        <View role="list">
          {pages.map(([slug, label]) => (
            <View role="listitem" key={slug}>
              <Text style={typography.body}>
                <TextLink href={`/styleguide/${slug}`} style={typography.link}>
                  {label}
                </TextLink>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </BaseLayout>
  );
}
