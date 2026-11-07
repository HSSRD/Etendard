// Collections de contenu validées au build (ADR 0014).
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Identifiant d'une fiche : son nom de fichier sans `.md`, pour le loader comme pour `units`. */
const toId = (path: string) => path.replace(/^.*\/|\.md$/g, '');

// Astro 7 se contente de journaliser une référence cassée : `units` la refuse au build.
// import.meta.glob n'accepte qu'un motif littéral, le même que celui du loader.
const projectIds = new Set(
  Object.keys(import.meta.glob('./content/projects/*.md')).map(toId),
);

/** Projets et sous-unités : une fiche Markdown par projet dans src/content/projects/. */
const projects = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './src/content/projects',
    generateId: ({ entry }) => toId(entry),
  }),
  schema: z.object({
    title: z.string().min(1),
    /** Une phrase. */
    summary: z.string().min(1),
    /** Rang d'affichage parmi les projets de même niveau. */
    order: z.number(),
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
