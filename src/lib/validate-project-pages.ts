// Validation des pages de projet de src/content/projets/ (ADR 0016), au build (scripts/check-content.ts)
// et dans Vitest : Zod n'est jamais envoyé au navigateur ni embarqué dans les apps.
import { z } from 'zod';
import {
  isLinkable,
  statusLabels,
  tableMaxColumns,
  type Status,
} from './project-pages.ts';
import { text } from './validate-projects.ts';

/** Texte affiché : pas de montant en euros hors d'un prix daté. */
const prose = text.refine(
  (value) => !/€|\beuros?\b|\bEUR\b/i.test(value),
  'montant hors d’un prix : écris une fourchette datée { min, max, date }',
);

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'identifiant en kebab-case');

const date = (what: string) =>
  z.iso.date({
    error: (issue) =>
      issue.input === undefined
        ? `${what} sans date`
        : 'date au format AAAA-MM-JJ',
  });

const status = z.enum(Object.keys(statusLabels) as [Status, ...Status[]], {
  error: `statut inconnu (${Object.keys(statusLabels).join(', ')})`,
});

const price = z
  .strictObject({
    min: z.number().nonnegative(),
    max: z.number(),
    date: date('prix'),
  })
  .refine(({ min, max }) => min < max, 'fourchette : min inférieur à max');

const source = z.strictObject(
  {
    /** Chemin du fichier dans le repo du projet. */
    path: text.refine(
      (path) => !path.startsWith('/') && !path.split('/').includes('..'),
      'chemin relatif à la racine du repo',
    ),
    /** Commit lu, en entier. */
    sha: z
      .string({ error: 'source sans SHA' })
      .regex(/^[0-9a-f]{40}$/, 'SHA complet de 40 caractères hexadécimaux'),
    /** Date du relevé. */
    date: date('source'),
  },
  { error: 'section sans source' },
);

/** Lien d'un fichier GitHub : épinglé à un SHA complet, jamais vers un fichier exclu. */
const githubFile =
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/([^/]+)\/(.+)$/;

const href = z
  .url({ protocol: /^https$/, error: 'URL https' })
  .refine((url) => {
    const file = githubFile.exec(url);
    return !file || /^[0-9a-f]{40}$/.test(file[1] ?? '');
  }, 'lien GitHub vers un fichier : épinglé à un SHA complet')
  .refine((url) => {
    const file = githubFile.exec(url);
    return !file || isLinkable(file[2] ?? '');
  }, 'lien vers un fichier aux données jamais publiées');

/** Cellule : un texte, ou un objet qui porte un statut ou un prix. */
const cell = z.union([
  prose,
  z
    .strictObject({ status: status.optional(), price: price.optional() })
    .refine(
      (value) => Object.keys(value).length === 1,
      'cellule : un statut ou un prix',
    ),
]);

const table = z
  .strictObject({
    type: z.literal('table'),
    caption: prose,
    columns: z.array(prose).min(2).max(tableMaxColumns),
    rows: z.array(z.array(cell)).min(1),
  })
  .refine(
    ({ columns, rows }) => rows.every((row) => row.length === columns.length),
    'chaque ligne a autant de cellules que de colonnes',
  );

const block = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), text: prose }),
  z.strictObject({ type: z.literal('list'), items: z.array(prose).min(1) }),
  table,
  z.strictObject({
    type: z.literal('links'),
    items: z.array(z.strictObject({ label: prose, href })).min(1),
  }),
]);

const section = z.strictObject({
  /** Ancre de la section dans la page. */
  id: slug,
  title: prose,
  status: status.optional(),
  source,
  blocks: z.array(block).min(1),
});

const projectPageSchema = z.strictObject({
  /** Identifiant du projet (son dossier). */
  project: slug,
  /** Vide pour l'accueil du projet. */
  slug: z.union([z.literal(''), slug]),
  title: prose,
  /** Une phrase : résumé sous le titre et description de la page. */
  description: prose,
  sections: z.array(section).min(1),
});

const projectMetaSchema = z.strictObject({
  id: slug,
  title: prose,
  summary: prose,
  status,
  /** Racine du repo source. */
  repo: z.url({ protocol: /^https$/, hostname: /^github\.com$/ }),
  /** Pages du projet, dans l'ordre de la navigation : l'accueil (slug vide) d'abord. */
  pages: z
    .array(
      z.strictObject({ slug: z.union([z.literal(''), slug]), label: prose }),
    )
    .min(1),
});

export type ProjectPage = z.infer<typeof projectPageSchema>;
export type ProjectMeta = z.infer<typeof projectMetaSchema>;
export type Section = ProjectPage['sections'][number];
export type Block = Section['blocks'][number];
export type Table = Extract<Block, { type: 'table' }>;
export type Cell = Table['rows'][number][number];

/**
 * Une cellule refusée est une union en échec : son message utile est celui de la variante du bon
 * type (l'objet pour un objet), pas « Invalid input ».
 */
const unfold = (issue: z.core.$ZodIssue): z.core.$ZodIssue[] => {
  if (issue.code !== 'invalid_union') return [issue];
  const typed = issue.errors.filter(
    (branch) =>
      !branch.some(({ code, path }) => code === 'invalid_type' && !path.length),
  );
  const [branch] = typed;
  if (typed.length !== 1 || !branch) return [issue];
  return branch.flatMap((inner) =>
    unfold({ ...inner, path: [...issue.path, ...inner.path] }),
  );
};

/** Problèmes d'un contenu, chacun préfixé du fichier et, s'il y a lieu, de la section. */
const issues = (file: string, input: unknown, error: z.ZodError) =>
  error.issues.flatMap(unfold).map((issue) => {
    const [first, index] = issue.path;
    const sections = (input as { sections?: { id?: unknown }[] } | null)
      ?.sections;
    const id =
      first === 'sections' && typeof index === 'number'
        ? sections?.[index]?.id
        : undefined;
    const where = [
      typeof id === 'string' ? `section « ${id} »` : undefined,
      issue.path.length > 0 ? issue.path.join('.') : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    return `${file}${where ? ` (${where})` : ''} : ${issue.message}`;
  });

export interface ProjectContent {
  /** Dossier du projet dans src/content/projets/. */
  dir: string;
  meta: { file: string; data: unknown };
  pages: { file: string; data: unknown }[];
}

/**
 * Valide un projet : sa fiche, chacune de ses pages, et leurs liens (une page par entrée de la
 * navigation et inversement, l'accueil en premier). Lève une erreur qui liste chaque problème.
 */
export const validateProjectContent = ({
  dir,
  meta,
  pages,
}: ProjectContent) => {
  const errors: string[] = [];
  const parsedMeta = projectMetaSchema.safeParse(meta.data);
  if (!parsedMeta.success) {
    errors.push(...issues(meta.file, meta.data, parsedMeta.error));
  }
  const parsedPages = pages.flatMap(({ file, data }) => {
    const parsed = projectPageSchema.safeParse(data);
    if (parsed.success) return [{ file, page: parsed.data }];
    errors.push(...issues(file, data, parsed.error));
    return [];
  });
  if (parsedMeta.success) {
    const { id, pages: nav } = parsedMeta.data;
    if (id !== dir)
      errors.push(`${meta.file} : id « ${id} » ≠ dossier « ${dir} ».`);
    if (nav[0]?.slug !== '') {
      errors.push(
        `${meta.file} : la navigation commence par l’accueil (slug vide).`,
      );
    }
    const slugs = nav.map((entry) => entry.slug);
    for (const [index, entry] of slugs.entries()) {
      if (slugs.indexOf(entry) !== index) {
        errors.push(`${meta.file} : page « ${entry} » en double.`);
      }
    }
    for (const { file, page } of parsedPages) {
      if (page.project !== id) {
        errors.push(`${file} : projet « ${page.project} » ≠ « ${id} ».`);
      }
      if (!slugs.includes(page.slug)) {
        errors.push(
          `${file} : page « ${page.slug} » absente de la navigation.`,
        );
      }
      const ids = page.sections.map((entry) => entry.id);
      for (const [index, entry] of ids.entries()) {
        if (ids.indexOf(entry) !== index) {
          errors.push(`${file} : section « ${entry} » en double.`);
        }
      }
    }
    // Une page invalide est déjà signalée : sans elle, ce décompte serait faux.
    for (const entry of parsedPages.length === pages.length ? slugs : []) {
      const count = parsedPages.filter(
        ({ page }) => page.slug === entry,
      ).length;
      if (count !== 1) {
        errors.push(
          `${meta.file} : page « ${entry} » : ${count} fichiers de contenu au lieu d’un.`,
        );
      }
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
};
