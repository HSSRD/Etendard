import { describe, expect, it, vi } from 'vitest';
import { linkProjects } from './projects';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const fiche = (
  id: string,
  order: number,
  units?: string[],
  html = '<p>Texte.</p>',
) => ({
  id,
  rendered: { html },
  data: { order, units: units?.map((unit) => ({ id: unit })) },
});

describe('linkProjects', () => {
  it('regroupe chaque racine avec ses sous-unités, triées par order puis id', () => {
    const groups = linkProjects([
      fiche('sentry', 2),
      fiche('hussard', 1, ['sentry', 'overwatch', 'bis']),
      fiche('overwatch', 1),
      fiche('bis', 1),
      fiche('vigie', 0, ['radar']),
      fiche('radar', 1),
    ]);
    expect(
      groups.map(({ root, units }) => [root.id, units.map((unit) => unit.id)]),
    ).toEqual([
      ['vigie', ['radar']],
      ['hussard', ['bis', 'overwatch', 'sentry']],
    ]);
  });

  it.each([
    [
      'une référence inexistante',
      [fiche('a', 1, ['x'])],
      'a : « x » inexistant.',
    ],
    ['une auto-référence', [fiche('a', 1, ['a'])], 'a : une sous-unité'],
    [
      'une sous-unité qui a des units',
      [fiche('a', 1, ['b']), fiche('b', 1, ['c']), fiche('c', 1)],
      'b : une sous-unité',
    ],
    [
      'une fiche référencée deux fois',
      [fiche('a', 1, ['c']), fiche('b', 1, ['c']), fiche('c', 1)],
      'c : référencé deux fois.',
    ],
    [
      'une fiche reliée à aucun projet',
      [fiche('a', 1, ['b']), fiche('b', 1), fiche('oubli', 1)],
      'oubli : absent des units de tout projet.',
    ],
    [
      'un corps vide',
      [fiche('a', 1, ['b'], '<!-- TODO -->\n<p>&nbsp;</p>'), fiche('b', 1)],
      'a : corps Markdown vide.',
    ],
    [
      'un titre dans le corps, Markdown ou HTML',
      [fiche('a', 1, ['b'], '<p>Texte.</p>\n<h2>Titre</h2>'), fiche('b', 1)],
      'a : titre Markdown interdit',
    ],
  ])('refuse %s', (_, projects, message) => {
    expect(() => linkProjects(projects)).toThrow(message);
  });
});
