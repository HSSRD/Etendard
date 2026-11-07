import { getCollection } from 'astro:content';

/** Ce que linkProjects lit d'une fiche de la collection `projects`. */
interface ProjectEntry {
  id: string;
  rendered?: { html: string } | undefined;
  data: { order: number; units?: { id: string }[] | undefined };
}

// Départage par identifiant, sans locale : même ordre sur tous les postes.
const byOrder = (a: ProjectEntry, b: ProjectEntry) =>
  a.data.order - b.data.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Texte visible d'un HTML rendu : sans balises, commentaires ni espaces. */
const visibleText = (html = '') =>
  html.replace(/<!--[\s\S]*?-->|<[^>]*>|&nbsp;|&#160;|\s/g, '');

/**
 * Regroupe les fiches en projets racines (non référencés, avec des units) et leurs sous-unités,
 * triés par `order` (ticket #14). Astro 7 ne fait que journaliser une référence cassée :
 * toute fiche mal reliée ou mal rédigée fait donc échouer le build ici.
 */
export const linkProjects = <P extends ProjectEntry>(projects: P[]) => {
  const ids = new Set(projects.map((project) => project.id));
  const referenced = new Set<string>();
  const errors: string[] = [];

  for (const project of projects) {
    const html = project.rendered?.html;
    if (!visibleText(html)) {
      errors.push(`${project.id} : corps Markdown vide.`);
    } else if (/<h[1-6][\s>]/i.test(html ?? '')) {
      errors.push(
        `${project.id} : titre Markdown interdit, la carte porte le titre.`,
      );
    }
    for (const { id } of project.data.units ?? []) {
      if (!ids.has(id)) errors.push(`${project.id} : « ${id} » inexistant.`);
      if (referenced.has(id)) errors.push(`${id} : référencé deux fois.`);
      referenced.add(id);
    }
  }
  for (const project of projects) {
    const hasUnits = Boolean(project.data.units?.length);
    // Une sous-unité n'a pas de sous-unités : interdit aussi l'auto-référence et les cycles.
    if (referenced.has(project.id) && hasUnits) {
      errors.push(`${project.id} : une sous-unité ne peut pas avoir de units.`);
    }
    // Une racine sans units est une sous-unité oubliée dans les units de son projet.
    if (!referenced.has(project.id) && !hasUnits) {
      errors.push(`${project.id} : absent des units de tout projet.`);
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
