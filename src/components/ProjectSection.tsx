// Section d'une page de projet (ADR 0016) : titre, statut, figure facultative, blocs (paragraphes,
// listes, tableaux, liens), puis sa source : fichier du repo, commit et date du relevé.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { AnchorTarget, TextLink } from '@/lib/anchors';
import { sourceUrl } from '@/lib/project-pages';
import type { Block, Section } from '@/lib/validate-project-pages';
import { themedStyles } from '@/theme/theme';
import { fontSize, space } from '@/theme/tokens';
import { paragraph, useTypography } from '@/theme/typography';
import DataTable from './DataTable';
import StatusBadge from './StatusBadge';

function SectionBlock({ block }: { block: Block }) {
  const styles = useStyles();
  const typography = useTypography();
  switch (block.type) {
    case 'paragraph':
      return (
        <Text role={paragraph} style={typography.body}>
          {block.text}
        </Text>
      );
    case 'list':
      return (
        <View role="list" style={styles.list}>
          {block.items.map((item, index) => (
            <View role="listitem" key={index} style={styles.item}>
              <Text aria-hidden style={typography.body}>
                •
              </Text>
              <Text style={[typography.body, styles.itemText]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      return <DataTable table={block} />;
    case 'links':
      return (
        <View role="list" style={styles.list}>
          {block.items.map(({ label, href }, index) => (
            <View role="listitem" key={index}>
              <Text style={typography.body}>
                <TextLink href={href} rel="noopener" style={typography.link}>
                  {label}
                </TextLink>
              </Text>
            </View>
          ))}
        </View>
      );
  }
}

interface Props {
  section: Section;
  /** Racine du repo source, pour lier le fichier de la source. */
  repo: string;
  /** Composant posé avant les blocs (schéma) : le modèle de contenu n'a que du texte. */
  figure?: ReactNode;
}

export default function ProjectSection({ section, repo, figure }: Props) {
  const styles = useStyles();
  const typography = useTypography();
  const { path, sha, date } = section.source;
  const url = sourceUrl(repo, path, sha);
  const note = [typography.body, styles.note];
  return (
    <AnchorTarget
      id={section.id}
      role="region"
      aria-labelledby={`${section.id}-titre`}
      style={styles.section}
    >
      <View style={styles.title}>
        <Text
          role="heading"
          aria-level={2}
          id={`${section.id}-titre`}
          style={typography.h2}
        >
          {section.title}
        </Text>
        {section.status && <StatusBadge status={section.status} />}
      </View>
      {figure}
      {section.blocks.map((block, index) => (
        <SectionBlock key={index} block={block} />
      ))}
      <Text role={paragraph} testID="source" style={note}>
        Source :{' '}
        {url ? (
          <TextLink
            href={url}
            rel="noopener"
            style={[typography.link, typography.code]}
          >
            {path}
          </TextLink>
        ) : (
          <Text style={typography.code}>{path}</Text>
        )}{' '}
        au commit {sha.slice(0, 7)}, relevé le {date}
      </Text>
    </AnchorTarget>
  );
}

const useStyles = themedStyles((colors) => ({
  section: { rowGap: space[4] },
  title: {
    alignItems: 'center',
    columnGap: space[3],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[2],
  },
  list: { rowGap: space[2] },
  item: { columnGap: space[2], flexDirection: 'row' },
  itemText: { flexShrink: 1 },
  note: { color: colors.textMuted, fontSize: fontSize.sm },
}));
