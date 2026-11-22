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

/** Texte affiché : pas de montant en euros hors d'un prix ou d'un budget daté. */
const prose = text.refine(
  (value) => !/€|\beuros?\b|\bEUR\b/i.test(value),
  'montant hors d’un prix ou d’un budget : écris une cellule { price } ou { budget } datée',
);

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'identifiant en kebab-case');

/** Page d'un projet : vide pour son accueil. */
const pageSlug = z.union([z.literal(''), slug]);

/** SHA complet d'un commit. */
const fullSha = /^[0-9a-f]{40}$/;

/** Message propre à une valeur absente ; sinon, le message de Zod. */
const whenMissing = (message: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? message : undefined;

const date = (what: string) =>
  z.iso.date({
    error: (issue) =>
      issue.input === undefined
        ? `${what} sans date`
        : 'date au format AAAA-MM-JJ',
  });

const status = z.enum(Object.keys(statusLabels) as [Status, ...Status[]], {
  error: (issue) =>
    issue.code === 'invalid_value'
      ? `statut inconnu (${Object.keys(statusLabels).join(', ')})`
      : undefined,
});

const price = z
  .strictObject({
    min: z.number().nonnegative(),
    max: z.number(),
    date: date('prix'),
  })
  .refine(({ min, max }) => min < max, 'fourchette : min inférieur à max');

/**
 * Montant prévu au budget (plafond, dépense ou reste) : une valeur ou une fourchette, négative
 * quand la prévision dépasse le plafond. Un prix, lui, est un relevé : jamais ponctuel ni négatif.
 */
const budget = z
  .strictObject({
    min: z.number(),
    max: z.number(),
    date: date('budget'),
  })
  .refine(({ min, max }) => min <= max, 'budget : min au plus égal à max');

const source = z.strictObject(
  {
    /** Chemin du fichier dans le repo du projet. */
    path: text.refine(
      (path) =>
        !path.startsWith('/') &&
        !path.split('/').includes('..') &&
        !/[#?%\\]/.test(path),
      'chemin relatif à la racine du repo, sans #, ?, % ni \\',
    ),
    /** Commit lu, en entier. */
    sha: z
      .string({ error: whenMissing('source sans SHA') })
      .regex(fullSha, 'SHA complet de 40 caractères hexadécimaux'),
    /** Date du relevé. */
    date: date('source'),
  },
  { error: whenMissing('section sans source') },
);

/** Fichier d'un repo sur github.com : `/<org>/<repo>/<vue>/<ref>/<chemin>`. */
const githubFile =
  /^\/[^/]+\/[^/]+\/(?:blob|tree|raw|blame|commits|edit)\/([^/]+)\/(.+)$/;

/** Chemin d'URL décodé ; tel quel si son encodage est invalide (« 100% »). */
const decoded = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/** Fichier brut : `/<org>/<repo>/<ref>/<chemin>`. */
const rawFile = /^\/[^/]+\/[^/]+\/([^/]+)\/(.+)$/;

/** Lien externe : jamais vers un fichier exclu (quel que soit l'hôte), épinglé à un SHA sur GitHub. */
const href = z
  .url({ protocol: /^https$/, error: 'URL https' })
  .superRefine((value, context) => {
    // Zod passe ici même quand z.url a échoué : une URL invalide est déjà signalée.
    if (!URL.canParse(value)) return;
    const url = new URL(value);
    const path = decoded(url.pathname);
    if (!isLinkable(path)) {
      context.addIssue({
        code: 'custom',
        message: 'lien vers un fichier aux données jamais publiées',
      });
    }
    const host = url.hostname.replace(/^www\./, '');
    const file =
      host === 'github.com'
        ? githubFile.exec(path)
        : host === 'raw.githubusercontent.com' && rawFile.exec(path);
    if (file && !fullSha.test(file[1] ?? '')) {
      context.addIssue({
        code: 'custom',
        message: 'lien GitHub vers un fichier : épinglé à un SHA complet',
      });
    }
  });

/** Cellule : un texte, ou un objet qui porte un statut, un prix ou un budget. */
const cell = z.union([
  prose,
  z
    .strictObject({
      status: status.optional(),
      price: price.optional(),
      budget: budget.optional(),
    })
    .refine(
      (value) =>
        Object.values(value).filter((entry) => entry !== undefined).length ===
        1,
      'cellule : un statut, un prix ou un budget',
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

/** Ids posés par la mise en page (ProjectLayout, BaseLayout) : jamais ceux d'une section. */
const layoutIds = new Set(['haut', 'contenu']);

const section = z.strictObject({
  /** Ancre de la section dans la page ; son titre prend l'id `<id>-titre`. */
  id: slug.refine(
    (id) => !layoutIds.has(id) && !id.endsWith('-titre'),
    'id réservé (haut, contenu) ou finissant par -titre',
  ),
  title: prose,
  status: status.optional(),
  source,
  blocks: z.array(block).min(1),
});

const projectPageSchema = z.strictObject({
  /** Identifiant du projet (son dossier). */
  project: slug,
  /** Vide pour l'accueil du projet. */
  slug: pageSlug,
  title: prose,
  /** Une phrase : résumé sous le titre et description de la page. */
  description: prose,
  sections: z.array(section).min(1),
});

const projectMetaSchema = z.strictObject({
  id: slug,
  title: prose,
  status,
  /** Racine du repo source. */
  repo: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/,
      'repo : https://github.com/<org>/<repo>, sans / final',
    ),
  /** Pages du projet, dans l'ordre de la navigation : l'accueil (slug vide) d'abord. */
  pages: z.array(z.strictObject({ slug: pageSlug, label: prose })).min(1),
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

/** Valeurs présentes plus d'une fois dans `list`. */
const duplicates = (list: string[]) =>
  new Set(list.filter((entry, index) => list.indexOf(entry) !== index));

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
    for (const entry of duplicates(slugs)) {
      errors.push(`${meta.file} : page « ${entry} » en double.`);
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
      for (const entry of duplicates(ids)) {
        errors.push(`${file} : section « ${entry} » en double.`);
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
