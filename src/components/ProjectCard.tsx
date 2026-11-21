// Carte d'un projet (ticket #14) : titre, résumé et paragraphes de sa fiche.
// `intro` : présentation sans cadre, pour le projet qui chapeaute ses sous-unités.
// Une fiche qui déclare sa `page` (ADR 0016) porte un lien vers elle.
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { TextLink } from '@/lib/anchors';
import type { Project } from '@/lib/validate-projects';
import { themedStyles } from '@/theme/theme';
import { borderWidth, fontSize, radius, shadow, space } from '@/theme/tokens';
import { paragraph, useTypography } from '@/theme/typography';

interface Props {
  project: Project;
  intro?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function ProjectCard({ project, intro = false, style }: Props) {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <View role="article" style={[intro ? styles.intro : styles.card, style]}>
      <Text role="heading" aria-level={3} style={typography.h3}>
        {project.title}
      </Text>
      <Text role={paragraph} style={[typography.body, styles.summary]}>
        {project.summary}
      </Text>
      <View style={styles.body}>
        {project.body.map((text) => (
          <Text
            role={paragraph}
            key={text}
            style={[typography.body, styles.muted]}
          >
            {text}
          </Text>
        ))}
      </View>
      {project.page && (
        <Text role={paragraph} style={typography.body}>
          <TextLink href={project.page} style={typography.link}>
            Voir la page du projet {project.title}
          </TextLink>
        </Text>
      )}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: 'solid',
    borderWidth,
    boxShadow: shadow(colors).sm,
    padding: space[5],
    rowGap: space[3],
  },
  intro: { rowGap: space[3] },
  summary: { fontSize: fontSize.lg },
  body: { rowGap: space[3] },
  muted: { color: colors.textMuted },
}));
