// StatusBadge dans chacun de ses états (ADR 0016) : un par statut.
import StatusBadge from '@/components/StatusBadge';
import StyleguideStates from '@/layouts/StyleguideStates';
import { statusLabels, type Status } from '@/lib/project-pages';

export default function StatusBadgePage() {
  return (
    <StyleguideStates
      name="StatusBadge"
      description="Composant StatusBadge d’Étendard : le statut d’un projet ou d’une section."
      states={(Object.keys(statusLabels) as Status[]).map((status) => ({
        label: `Statut ${status}`,
        node: <StatusBadge status={status} />,
      }))}
    />
  );
}
