// ProjectNav dans chacun de ses états (ADR 0016) : une page courante par état. Chaque état nomme
// son projet d'après la page courante : deux navigations de même nom seraient ambiguës.
import ProjectNav from '@/components/ProjectNav';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';

export default function ProjectNavPage() {
  return (
    <StyleguideStates
      name="ProjectNav"
      description="Composant ProjectNav d’Étendard : la navigation entre les pages d’un projet."
      states={demo.projet.pages.map(({ slug, label }) => ({
        label: `Page courante : ${label}`,
        node: (
          <ProjectNav
            project={{
              ...demo.projet,
              title: `${demo.projet.title} (${label})`,
            }}
            current={slug}
          />
        ),
      }))}
    />
  );
}
