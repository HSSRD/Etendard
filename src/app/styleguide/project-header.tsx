// ProjectHeader dans chacun de ses états (ADR 0016) : accueil du projet, puis sous-page.
import ProjectHeader from '@/components/ProjectHeader';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';

export default function ProjectHeaderPage() {
  return (
    <StyleguideStates
      name="ProjectHeader"
      description="Composant ProjectHeader d’Étendard : l’en-tête d’une page de projet."
      states={demo.pages.map((page) => ({
        label: page.slug ? `Sous-page ${page.slug}` : 'Accueil du projet',
        node: <ProjectHeader project={demo.projet} page={page} />,
      }))}
    />
  );
}
