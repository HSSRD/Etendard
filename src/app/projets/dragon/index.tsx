// Accueil du projet Dragon (ADR 0016) : /projets/dragon.
import accueil from '@/content/projets/dragon/accueil';
import projet from '@/content/projets/dragon/projet';
import ProjectLayout from '@/layouts/ProjectLayout';

export default function Dragon() {
  return <ProjectLayout project={projet} page={accueil} />;
}
