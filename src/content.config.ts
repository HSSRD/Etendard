// Collections de contenu validées au build (ADR 0014).
// Les liens entre fiches (`units`) sont vérifiés par getProjects (src/lib/projects.ts).
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Projets et sous-unités : une fiche Markdown par projet dans src/content/projects/. */
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string().trim().min(1),
    /** Une phrase. */
    summary: z.string().trim().min(1),
    /** Rang d'affichage parmi les projets de même niveau. */
    order: z.number(),
    units: z.array(reference('projects')).optional(),
  }),
});

export const collections = { projects };
