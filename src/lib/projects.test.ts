import { describe, expect, it, vi } from 'vitest';
import { linkProjects } from './projects';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const fiche = (
  id: string,
  order: number,
  units?: string[],
  body = 'Texte.',
) => ({
  id,
  body,
  data: { order, units: units?.map((unit) => ({ id: unit })) },
});

describe('linkProjects', () => {
  it('regroupe chaque racine avec ses sous-unités, triées par order puis id', () => {
    const groups = linkProjects([
      fiche('sentry', 2),
      fiche('hussard', 1, ['sentry', 'overwatch', 'bis']),
      fiche('overwatch', 1),
      fiche('bis', 1),
    ]);
    expect(
      groups.map(({ root, units }) => [root.id, units.map((unit) => unit.id)]),
    ).toEqual([['hussard', ['bis', 'overwatch', 'sentry']]]);
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
    ['un corps vide', [fiche('a', 1, [], ' \n')], 'a : corps Markdown vide.'],
    [
      'un titre dans le corps',
      [fiche('a', 1, [], 'Texte.\n\n## Titre')],
      'a : titre Markdown interdit',
    ],
  ])('refuse %s', (_, projects, message) => {
    expect(() => linkProjects(projects)).toThrow(message);
  });
});
