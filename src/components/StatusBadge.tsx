// Badge de statut d'un projet, d'une section ou d'une cellule (ADR 0016) : le libellé porte le sens,
// la couleur de la bordure ne fait que le souligner.
import { Text } from 'react-native';
import { statusLabels, type Status } from '@/lib/project-pages';
import { themedStyles } from '@/theme/theme';
import {
  borderWidth,
  fontSize,
  fontWeight,
  radius,
  space,
} from '@/theme/tokens';
import { useTypography } from '@/theme/typography';

export default function StatusBadge({ status }: { status: Status }) {
  const styles = useStyles();
  const typography = useTypography();
  return (
    <Text
      testID="status-badge"
      style={[typography.body, styles.badge, styles[status]]}
    >
      {statusLabels[status]}
    </Text>
  );
}

const useStyles = themedStyles((colors) => ({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderStyle: 'solid',
    borderWidth,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    paddingHorizontal: space[2],
  },
  'a-venir': { borderColor: colors.textMuted, color: colors.textMuted },
  'en-cours': { borderColor: colors.accent },
  termine: { borderColor: colors.text },
  propose: { borderColor: colors.textMuted },
  accepte: { borderColor: colors.text },
}));
