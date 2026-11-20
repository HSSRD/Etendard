// Validation des fiches de src/content/projects.ts (ADR 0015), au build (scripts/check-content.ts)
// et dans Vitest : Zod n'est jamais envoyé au navigateur ni embarqué dans les apps.
import { z } from 'zod';

/** Texte non vide, sans espace au début ni à la fin : validé tel que l'app l'affiche. */
const text = z
  .string()
  .regex(/^\S(?:[\s\S]*\S)?$/, 'texte vide ou entouré d’espaces');

const projectSchema = z.strictObject({
  /** Identifiant unique, référencé par les `units` d'un autre projet. */
  id: text,
  title: text,
  /** Une phrase. */
  summary: text,
  /** Rang d'affichage parmi les projets de même niveau. */
  order: z.number(),
  units: z.array(z.string()).optional(),
  /** Paragraphes de la fiche, sans titre : la carte porte le titre. */
  body: z.array(text).min(1),
});

export type Project = z.infer<typeof projectSchema>;

/**
 * Valide les fiches et leurs liens : un projet racine (non référencé) a des units, une sous-unité
 * n'en a pas, chaque fiche est référencée au plus une fois. Lève une erreur qui liste chaque problème.
 */
export const validateProjects = (input: unknown): Project[] => {
  const parsed = z.array(projectSchema).safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `src/content/projects.ts :\n${z.prettifyError(parsed.error)}`,
    );
  }
  const projects = parsed.data;
  const ids = new Set<string>();
  const referenced = new Set<string>();
  const errors: string[] = [];

  for (const { id } of projects) {
    if (ids.has(id)) errors.push(`${id} : identifiant en double.`);
    ids.add(id);
  }
  for (const project of projects) {
    for (const id of project.units ?? []) {
      if (!ids.has(id)) errors.push(`${project.id} : « ${id} » inexistant.`);
      if (referenced.has(id)) errors.push(`${id} : référencé deux fois.`);
      referenced.add(id);
    }
  }
  for (const project of projects) {
    const hasUnits = Boolean(project.units?.length);
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
    throw new Error(`src/content/projects.ts :\n${errors.join('\n')}`);
  }
  return projects;
};
