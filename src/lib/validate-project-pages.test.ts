import { describe, expect, it } from 'vitest';
import {
  validateProjectContent,
  type ProjectContent,
} from './validate-project-pages';

const sha = '0123456789abcdef0123456789abcdef01234567';

const section = (overrides: Record<string, unknown> = {}) => ({
  id: 'essai',
  title: 'Essai',
  source: { path: 'README.md', sha, date: '2026-11-21' },
  blocks: [{ type: 'paragraph', text: 'Texte.' }],
  ...overrides,
});

const page = (overrides: Record<string, unknown> = {}) => ({
  project: 'essai',
  slug: '',
  title: 'Essai',
  description: 'Un projet d’essai.',
  sections: [section()],
  ...overrides,
});

const meta = (overrides: Record<string, unknown> = {}) => ({
  id: 'essai',
  title: 'Essai',
  summary: 'Un projet d’essai.',
  status: 'en-cours',
  repo: 'https://github.com/HSSRD/Essai',
  pages: [{ slug: '', label: 'Présentation' }],
  ...overrides,
});

const content = (
  pages: unknown[] = [page()],
  data: unknown = meta(),
): ProjectContent => ({
  dir: 'essai',
  meta: { file: 'projet.ts', data },
  pages: pages.map((entry, index) => ({
    file: `page-${index}.ts`,
    data: entry,
  })),
});

const table = (rows: unknown[][]) => ({
  type: 'table',
  caption: 'Options',
  columns: ['Option', 'Prix'],
  rows,
});

const withBlock = (block: unknown) =>
  content([page({ sections: [section({ blocks: [block] })] })]);

describe('validateProjectContent', () => {
  it('accepte un projet complet : statuts, tableau, prix datés, liens', () => {
    expect(() =>
      validateProjectContent(
        content([
          page({
            sections: [
              section({
                status: 'termine',
                blocks: [
                  { type: 'list', items: ['Un.', 'Deux.'] },
                  table([
                    [
                      'Carbone',
                      { price: { min: 20, max: 40, date: '2026-11-20' } },
                    ],
                    ['Phase 1', { status: 'a-venir' }],
                  ]),
                  {
                    type: 'links',
                    items: [
                      { label: 'Repo', href: 'https://github.com/HSSRD/Essai' },
                      {
                        label: 'ADR',
                        href: `https://github.com/HSSRD/Essai/blob/${sha}/docs/adr.md`,
                      },
                    ],
                  },
                ],
              }),
            ],
          }),
        ]),
      ),
    ).not.toThrow();
  });

  it.each([
    [
      'une section sans source',
      content([page({ sections: [section({ source: undefined })] })]),
      'page-0.ts (section « essai », sections.0.source) : section sans source',
    ],
    [
      'une source sans SHA',
      content([
        page({
          sections: [
            section({ source: { path: 'README.md', date: '2026-11-21' } }),
          ],
        }),
      ]),
      'section « essai », sections.0.source.sha) : source sans SHA',
    ],
    [
      'une source au SHA abrégé',
      content([
        page({
          sections: [
            section({
              source: { path: 'README.md', sha: '3afc561', date: '2026-11-21' },
            }),
          ],
        }),
      ]),
      'SHA complet de 40 caractères',
    ],
    [
      'une source sans date',
      content([
        page({ sections: [section({ source: { path: 'README.md', sha } })] }),
      ]),
      'section « essai », sections.0.source.date) : source sans date',
    ],
    [
      'un prix sans date de relevé',
      withBlock(table([['Carbone', { price: { min: 20, max: 40 } }]])),
      'prix sans date',
    ],
    [
      'un prix ponctuel (fourchette vide)',
      withBlock(
        table([
          ['Carbone', { price: { min: 20, max: 20, date: '2026-11-20' } }],
        ]),
      ),
      'fourchette',
    ],
    [
      'un montant en euros dans un texte',
      withBlock({ type: 'paragraph', text: 'Il coûte 30 €.' }),
      'montant hors d’un prix',
    ],
    [
      'un statut inconnu',
      content([page({ sections: [section({ status: 'fini' })] })]),
      'section « essai », sections.0.status) : statut inconnu',
    ],
    [
      'un statut inconnu dans la fiche',
      content([page()], meta({ status: 'fini' })),
      'projet.ts (status) : statut inconnu',
    ],
    [
      'une ligne de tableau incomplète',
      withBlock(table([['Carbone']])),
      'autant de cellules que de colonnes',
    ],
    [
      'un lien vers un fichier aux données exclues',
      withBlock({
        type: 'links',
        items: [
          {
            label: 'BOM',
            href: `https://github.com/HSSRD/Essai/blob/${sha}/docs/bom.md`,
          },
        ],
      }),
      'données jamais publiées',
    ],
    [
      'un lien vers un fichier non épinglé',
      withBlock({
        type: 'links',
        items: [
          {
            label: 'ADR',
            href: 'https://github.com/HSSRD/Essai/blob/main/docs/adr.md',
          },
        ],
      }),
      'épinglé à un SHA complet',
    ],
    [
      'une page absente de la navigation',
      content([page(), page({ slug: 'materiel' })]),
      'page « materiel » absente de la navigation',
    ],
    [
      'une entrée de navigation sans page',
      content(
        [page()],
        meta({
          pages: [
            { slug: '', label: 'Présentation' },
            { slug: 'achats', label: 'Achats' },
          ],
        }),
      ),
      'page « achats » : 0 fichiers de contenu',
    ],
    [
      'une navigation qui ne commence pas par l’accueil',
      content([page()], meta({ pages: [{ slug: 'achats', label: 'Achats' }] })),
      'commence par l’accueil',
    ],
    [
      'une fiche dont l’id n’est pas le dossier',
      content([page({ project: 'autre' })], meta({ id: 'autre' })),
      'id « autre » ≠ dossier « essai »',
    ],
    [
      'deux sections au même id',
      content([page({ sections: [section(), section()] })]),
      'section « essai » en double',
    ],
  ])('refuse %s, avec un message qui le nomme', (_, input, message) => {
    expect(() => validateProjectContent(input as ProjectContent)).toThrow(
      message,
    );
  });
});
