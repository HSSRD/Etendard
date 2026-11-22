// Navigation entre les pages d'un projet (ADR 0016) : une entrée par page de projet.ts,
// la page courante marquée aria-current.
import { View } from 'react-native';
import { TextLink } from '@/lib/anchors';
import { pagePath } from '@/lib/project-pages';
import type { ProjectMeta } from '@/lib/validate-project-pages';
import { themedStyles } from '@/theme/theme';
import { borderWidth, fontWeight, space } from '@/theme/tokens';
import { useTypography } from '@/theme/typography';

interface Props {
  project: ProjectMeta;
  /** Slug de la page affichée (vide pour l'accueil du projet). */
  current: string;
}

export default function ProjectNav({ project, current }: Props) {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <View
      role="navigation"
      aria-label={`Pages du projet ${project.title}`}
      style={styles.nav}
    >
      <View role="list" style={styles.list}>
        {project.pages.map(({ slug, label }) => (
          <View role="listitem" key={slug}>
            <TextLink
              href={pagePath(project.id, slug)}
              aria-current={slug === current ? 'page' : undefined}
              dataSet={{ hover: 'underline' }}
              style={[
                typography.body,
                styles.link,
                slug === current && styles.current,
              ]}
            >
              {label}
            </TextLink>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  nav: {
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidth,
    borderTopColor: colors.border,
    borderTopWidth: borderWidth,
  },
  list: {
    columnGap: space[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[1],
  },
  link: { color: colors.accent, paddingVertical: space[2] },
  current: { color: colors.text, fontWeight: fontWeight.bold },
}));
