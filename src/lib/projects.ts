import { getCollection, type CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'projects'>;

/** Projet racine de la one page : ses `units` sont les sous-unités présentées. */
const ROOT_ID = 'hussard';

/**
 * Hussard et ses sous-unités, triées par `order` (ticket #14).
 * Astro 7 ne fait que journaliser une référence cassée : on fait échouer le build sur toute
 * fiche mal reliée (référence inexistante, doublon, auto-référence, fiche orpheline).
 */
export const getProjects = async () => {
  const projects = await getCollection('projects');
  const ids = new Set(projects.map((project) => project.id));
  const fail = (message: string) => {
    throw new Error(`src/content/projects : ${message}`);
  };

  for (const project of projects) {
    const units = (project.data.units ?? []).map((unit) => unit.id);
    for (const id of units) {
      if (!ids.has(id)) fail(`${project.id} référence « ${id} », inexistant.`);
    }
    if (units.includes(project.id)) fail(`${project.id} se référence.`);
    if (new Set(units).size !== units.length) {
      fail(`${project.id} référence deux fois la même fiche.`);
    }
  }

  const root = projects.find((project) => project.id === ROOT_ID);
  if (!root) return fail(`fiche ${ROOT_ID}.md introuvable.`);
  const unitIds = new Set((root.data.units ?? []).map((unit) => unit.id));
  const orphans = projects.filter(
    (project) => project !== root && !unitIds.has(project.id),
  );
  if (orphans.length > 0) {
    fail(
      `${orphans.map((project) => project.id).join(', ')} absent des units de ${ROOT_ID}.`,
    );
  }

  const units = projects
    .filter((project) => unitIds.has(project.id))
    .toSorted((a: Project, b: Project) => a.data.order - b.data.order);
  return { root, units };
};
