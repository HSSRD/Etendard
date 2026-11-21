// En-tête d'une page de projet (ADR 0016) : titre de la page, résumé, statut du projet
// et lien vers son repo.
import { Text, View } from 'react-native';
import { TextLink } from '@/lib/anchors';
import type { ProjectMeta, ProjectPage } from '@/lib/validate-project-pages';
import { themedStyles } from '@/theme/theme';
import { fontSize, space } from '@/theme/tokens';
import { paragraph, useTypography } from '@/theme/typography';
import StatusBadge from './StatusBadge';

interface Props {
  project: ProjectMeta;
  page: ProjectPage;
}

export default function ProjectHeader({ project, page }: Props) {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <View testID="project-header" style={styles.header}>
      <Text role="heading" aria-level={1} style={typography.h1}>
        {page.title}
      </Text>
      <Text role={paragraph} style={[typography.body, styles.summary]}>
        {page.description}
      </Text>
      <View style={styles.meta}>
        <StatusBadge status={project.status} />
        <Text role={paragraph} style={typography.body}>
          <TextLink href={project.repo} rel="noopener" style={typography.link}>
            Dépôt {project.title} sur GitHub
          </TextLink>
        </Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  header: { rowGap: space[4] },
  summary: { color: colors.textMuted, fontSize: fontSize.lg },
  meta: {
    alignItems: 'center',
    columnGap: space[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[2],
  },
}));
