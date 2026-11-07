// Collections de contenu validées au build (ADR 0014).
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Identifiants des fiches de projet : nom du fichier sans `.md`. */
const projectIds = new Set(
  Object.keys(import.meta.glob('./content/projects/*.md')).map((path) =>
    path.replace(/^.*\/|\.md$/g, ''),
  ),
);

/** Projets et sous-unités : une fiche Markdown par projet dans src/content/projects/. */
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string().min(1),
    /** Une phrase. */
    summary: z.string().min(1),
    /** Rang d'affichage parmi les projets de même niveau. */
    order: z.number(),
    // Astro 7 se contente de journaliser une référence cassée : on la refuse au build.
    units: z
      .array(
        reference('projects').refine(({ id }) => projectIds.has(id), {
          message: 'Projet inexistant.',
        }),
      )
      .optional(),
  }),
});

export const collections = { projects };
