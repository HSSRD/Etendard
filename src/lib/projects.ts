import { getCollection } from 'astro:content';

/** Ce que linkProjects lit d'une fiche de la collection `projects`. */
interface ProjectEntry {
  id: string;
  body?: string | undefined;
  data: { order: number; units?: { id: string }[] | undefined };
}

const byOrder = (a: ProjectEntry, b: ProjectEntry) =>
  a.data.order - b.data.order || a.id.localeCompare(b.id);

/**
 * Regroupe les fiches en projets racines (aucune fiche ne les référence) et leurs sous-unités,
 * triés par `order` (ticket #14). Astro 7 ne fait que journaliser une référence cassée :
 * toute fiche mal reliée ou mal rédigée fait donc échouer le build ici.
 */
export const linkProjects = <P extends ProjectEntry>(projects: P[]) => {
  const ids = new Set(projects.map((project) => project.id));
  const referenced = new Set<string>();
  const errors: string[] = [];

  for (const project of projects) {
    if (!project.body?.trim()) {
      errors.push(`${project.id} : corps Markdown vide.`);
    } else if (/^#{1,6}\s/m.test(project.body)) {
      errors.push(
        `${project.id} : titre Markdown interdit, la carte porte le titre.`,
      );
    }
    for (const { id } of project.data.units ?? []) {
      if (!ids.has(id)) errors.push(`${project.id} : « ${id} » inexistant.`);
      referenced.add(id);
    }
  }
  // Une sous-unité n'a pas de sous-unités : interdit aussi l'auto-référence et les cycles.
  for (const project of projects) {
    if (referenced.has(project.id) && project.data.units?.length) {
      errors.push(`${project.id} : une sous-unité ne peut pas avoir de units.`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`src/content/projects :\n${errors.join('\n')}`);
  }

  return projects
    .filter((project) => !referenced.has(project.id))
    .toSorted(byOrder)
    .map((root) => {
      const unitIds = new Set(root.data.units?.map((unit) => unit.id));
      return {
        root,
        units: projects
          .filter((project) => unitIds.has(project.id))
          .toSorted(byOrder),
      };
    });
};

/** Projets racines de la collection et leurs sous-unités. */
export const getProjects = async () =>
  linkProjects(await getCollection('projects'));
