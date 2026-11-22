// Matériel du projet Dragon (ADR 0016) : /projets/dragon/materiel.
import materiel from '@/content/projets/dragon/materiel';
import projet from '@/content/projets/dragon/projet';
import ProjectLayout from '@/layouts/ProjectLayout';

export default function Materiel() {
  return <ProjectLayout project={projet} page={materiel} />;
}
