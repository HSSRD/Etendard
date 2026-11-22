// Achats et budget du projet Dragon (ADR 0016) : /projets/dragon/achats.
import achats from '@/content/projets/dragon/achats';
import projet from '@/content/projets/dragon/projet';
import ProjectLayout from '@/layouts/ProjectLayout';

export default function Achats() {
  return <ProjectLayout project={projet} page={achats} />;
}
