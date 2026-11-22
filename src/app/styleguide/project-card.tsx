// ProjectCard dans chacun de ses états (ticket #14) : présentation (intro), carte de sous-unité,
// carte d'un projet autonome, puis carte d'une fiche qui a sa page (lien vers elle).
import ProjectCard from '@/components/ProjectCard';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';
import { projectGroups } from '@/lib/projects';

const states = projectGroups
  .flatMap(({ root, units }) => [
    {
      label: `${units.length > 0 ? 'Présentation (intro)' : 'Carte'} ${root.title}`,
      project: root,
      intro: units.length > 0,
    },
    ...units.map((project) => ({
      label: `Carte ${project.title}`,
      project,
      intro: false,
    })),
  ])
  .concat({
    label: 'Carte avec page (ADR 0016)',
    project: demo.carte,
    intro: false,
  });

export default function ProjectCardPage() {
  return (
    <StyleguideStates
      name="ProjectCard"
      description="Composant ProjectCard d’Étendard : la carte d’un projet."
      states={states.map(({ label, project, intro }) => ({
        label,
        node: <ProjectCard project={project} intro={intro} />,
      }))}
    />
  );
}
