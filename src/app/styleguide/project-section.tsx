// ProjectSection dans chacun de ses états (ADR 0016) : tableau et statut, liste et liens,
// prix datés, source sans lien (fichier aux données jamais publiées).
import ProjectSection from '@/components/ProjectSection';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';

export default function ProjectSectionPage() {
  return (
    <StyleguideStates
      name="ProjectSection"
      description="Composant ProjectSection d’Étendard : une section de page de projet et sa source."
      states={demo.pages
        .flatMap((page) => page.sections)
        .map((section) => ({
          label: `Section « ${section.title} »`,
          node: <ProjectSection section={section} repo={demo.projet.repo} />,
        }))}
    />
  );
}
