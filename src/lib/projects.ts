// Projets de la one page : fiches de src/content/projects.ts, validées au build
// (validate-projects.ts), regroupées ici sans Zod pour ne pas l'envoyer au navigateur.
import fiches from '../content/projects';
import type { Project } from './validate-projects';

// Départage par identifiant, sans locale : même ordre sur tous les postes.
const byOrder = (a: Project, b: Project) =>
  a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Projets racines (absents des units de tout autre) et leurs sous-unités, triés par `order`. */
export const groupProjects = (projects: Project[]) => {
  const units = new Set(projects.flatMap((project) => project.units ?? []));
  return projects
    .filter((project) => !units.has(project.id))
    .toSorted(byOrder)
    .map((root) => ({
      root,
      units: projects
        .filter((project) => root.units?.includes(project.id))
        .toSorted(byOrder),
    }));
};

export const projectGroups = groupProjects(fiches);
