// Schéma des liaisons entre composants (ADR 0016, #102) : des chaînes verticales de blocs reliés
// par des flèches, en Views (aucune dépendance de dessin). Les chaînes passent l'une sous l'autre
// quand la largeur manque, sans requête média. Une image pour les lecteurs d'écran : la page en
// donne la liste des liaisons juste après.
import { Text, View } from 'react-native';
import { themedStyles } from '@/theme/theme';
import {
  borderWidth,
  fontSize,
  fontWeight,
  layout,
  radius,
  space,
} from '@/theme/tokens';
import { useTypography } from '@/theme/typography';

export interface DiagramNode {
  label: string;
  /** Précision sous le nom (modèle, logiciel). */
  detail?: string;
}

/** Liaison latérale : un bloc qui alimente l'étape (`in`) ou qu'elle alimente (`out`). */
export interface DiagramBranch extends DiagramNode {
  direction: 'in' | 'out';
  via: string;
  /** Prévu pour une phase suivante : bordure en tirets et mention « plus tard ». */
  later?: boolean;
}

export interface DiagramStep extends DiagramNode {
  /** Liaison depuis l'étape précédente, écrite sur la flèche. */
  via?: string;
  branches?: DiagramBranch[];
}

export interface DiagramChain {
  title: string;
  steps: DiagramStep[];
}

interface Props {
  /** Nom de l'image pour les lecteurs d'écran. */
  label: string;
  chains: DiagramChain[];
}

function Node({ label, detail, later }: DiagramNode & { later?: boolean }) {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <View style={[styles.node, later && styles.later]}>
      {later && <Text style={[typography.body, styles.note]}>Plus tard</Text>}
      <Text style={[typography.body, styles.label]}>{label}</Text>
      {detail && <Text style={[typography.body, styles.note]}>{detail}</Text>}
    </View>
  );
}

export default function WiringDiagram({ label, chains }: Props) {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <View role="img" aria-label={label} testID="schema" style={styles.diagram}>
      {chains.map((chain) => (
        <View key={chain.title} style={styles.chain}>
          <Text style={[typography.body, styles.label]}>{chain.title}</Text>
          {chain.steps.map((step, index) => (
            <View key={step.label} style={styles.step}>
              {index > 0 && (
                <View style={styles.arrow}>
                  <Text style={typography.body}>↓</Text>
                  {step.via && (
                    <Text style={[typography.body, styles.note]}>
                      {step.via}
                    </Text>
                  )}
                </View>
              )}
              <Node {...step} />
              {step.branches?.map((branch) => (
                <View key={branch.label} style={styles.branch}>
                  <Text style={[typography.body, styles.note, styles.via]}>
                    {branch.direction === 'in' ? '←' : '→'} {branch.via}
                  </Text>
                  <Node {...branch} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  diagram: {
    columnGap: space[6],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[6],
  },
  chain: { flexBasis: layout.diagramColumn, flexGrow: 1, rowGap: space[2] },
  step: { rowGap: space[2] },
  node: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth,
    flexShrink: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  later: { borderColor: colors.textMuted, borderStyle: 'dashed' },
  label: { fontWeight: fontWeight.bold },
  note: { color: colors.textMuted, fontSize: fontSize.sm },
  arrow: {
    alignItems: 'center',
    columnGap: space[2],
    flexDirection: 'row',
    paddingLeft: space[4],
  },
  // Trait vertical qui rattache la liaison latérale au bloc de l'étape.
  branch: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderLeftWidth: borderWidth,
    borderStyle: 'solid',
    columnGap: space[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: space[4],
    paddingLeft: space[3],
    rowGap: space[1],
  },
  via: { flexShrink: 1 },
}));
