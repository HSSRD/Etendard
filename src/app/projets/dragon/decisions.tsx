// Décisions du projet Dragon (ADR 0016) : /projets/dragon/decisions.
import decisions from '@/content/projets/dragon/decisions';
import projet from '@/content/projets/dragon/projet';
import ProjectLayout from '@/layouts/ProjectLayout';

export default function Decisions() {
  return <ProjectLayout project={projet} page={decisions} />;
}
