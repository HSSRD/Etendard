// Architecture du projet Dragon (ADR 0016) : /projets/dragon/architecture, avec le schéma des
// liaisons en tête de sa section.
import WiringDiagram from '@/components/WiringDiagram';
import architecture, { schema } from '@/content/projets/dragon/architecture';
import projet from '@/content/projets/dragon/projet';
import ProjectLayout from '@/layouts/ProjectLayout';

export default function Architecture() {
  return (
    <ProjectLayout
      project={projet}
      page={architecture}
      figures={{ schema: <WiringDiagram {...schema} /> }}
    />
  );
}
