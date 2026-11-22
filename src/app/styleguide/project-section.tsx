// ProjectSection dans chacun de ses états (ADR 0016) : tableau et statut, liste et liens,
// prix datés, source sans lien (fichier aux données jamais publiées), figure avant les blocs.
import ProjectSection from '@/components/ProjectSection';
import WiringDiagram from '@/components/WiringDiagram';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';

const sections = demo.pages.flatMap((page) => page.sections);

export default function ProjectSectionPage() {
  return (
    <StyleguideStates
      name="ProjectSection"
      description="Composant ProjectSection d’Étendard : une section de page de projet et sa source."
      states={[
        ...sections.map((section) => ({
          label: `Section « ${section.title} »`,
          node: <ProjectSection section={section} repo={demo.projet.repo} />,
        })),
        // La source de la première section, avec un schéma et un seul paragraphe.
        ...sections.slice(0, 1).map((section) => ({
          label: 'Section avec figure',
          node: (
            <ProjectSection
              section={{
                ...section,
                id: 'schema',
                title: 'Schéma',
                blocks: [
                  { type: 'paragraph', text: 'La figure précède les blocs.' },
                ],
              }}
              repo={demo.projet.repo}
              figure={<WiringDiagram {...demo.schema} />}
            />
          ),
        })),
      ]}
    />
  );
}
