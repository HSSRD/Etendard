// ProjectCard dans chacun de ses états (ticket #14) : présentation (intro), puis carte de sous-unité.
import { Text, View } from 'react-native';
import ProjectCard from '@/components/ProjectCard';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { projectGroups } from '@/lib/projects';
import { useTypography } from '@/theme/typography';

const states = projectGroups.flatMap(({ root, units }) => [
  { label: `Présentation (intro) ${root.title}`, project: root, intro: true },
  ...units.map((project) => ({
    label: `Carte ${project.title}`,
    project,
    intro: false,
  })),
]);

export default function ProjectCardPage() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="ProjectCard — Styleguide — Étendard"
      description="Composant ProjectCard d’Étendard : la carte d’un projet."
    >
      <View style={pageStyles.page}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          ProjectCard
        </Text>
        {states.map((state, index) => (
          <View
            key={state.label}
            role="region"
            aria-labelledby={`etat-${index}`}
            style={pageStyles.state}
          >
            <Text
              role="heading"
              aria-level={2}
              id={`etat-${index}`}
              style={typography.h2}
            >
              {state.label}
            </Text>
            <ProjectCard project={state.project} intro={state.intro} />
          </View>
        ))}
      </View>
    </BaseLayout>
  );
}
