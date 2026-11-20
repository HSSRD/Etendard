// Section « Projets » de la one page (ticket #14) : chaque projet racine (Hussard), puis une
// carte par sous-unité, sur deux colonnes à partir de 768 px de large.
import { StyleSheet, Text, View } from 'react-native';
import { projectGroups } from '@/lib/projects';
import { layout, space } from '@/theme/tokens';
import { pageStyles } from '@/layouts/page-styles';
import { useTypography } from '@/theme/typography';
import ProjectCard from './ProjectCard';

export default function ProjectsSection() {
  const typography = useTypography();
  return (
    <View testID="projects-section" style={[pageStyles.column, styles.section]}>
      <Text role="heading" aria-level={2} style={typography.h2}>
        Projets
      </Text>
      {projectGroups.map(({ root, units }) => (
        <View key={root.id} style={styles.group}>
          <ProjectCard project={root} intro />
          <View testID="project-units" style={styles.units}>
            {units.map((unit) => (
              <ProjectCard key={unit.id} project={unit} style={styles.unit} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Deux colonnes sans media query (le HTML pré-rendu ne connaît pas la largeur) : chaque carte
 * fait au moins la moitié de la largeur utile à 768 px, les cartes passent donc à la ligne en dessous.
 */
const unitBasis = (layout.twoColumns - 2 * space[4] - space[5]) / 2;

const styles = StyleSheet.create({
  section: {
    paddingVertical: space[8],
    rowGap: space[6],
  },
  group: { rowGap: space[6] },
  units: {
    columnGap: space[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[5],
  },
  unit: { flexBasis: unitBasis, flexGrow: 1, minWidth: 0 },
});
