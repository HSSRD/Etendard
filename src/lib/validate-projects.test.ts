import { describe, expect, it } from 'vitest';
import fiches from '../content/projects';
import { groupProjects, projectGroups } from './projects';
import { validateProjects } from './validate-projects';

const fiche = (id: string, order: number, units?: string[]) => ({
  id,
  title: id,
  summary: `Résumé de ${id}.`,
  order,
  ...(units && { units }),
  body: ['Texte.'],
});

describe('groupProjects', () => {
  it('regroupe chaque racine avec ses sous-unités, triées par order puis id', () => {
    const groups = groupProjects([
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

  it('regroupe les fiches du site : Hussard, puis Overwatch et Sentry', () => {
    expect(
      projectGroups.map(({ root, units }) => [
        root.title,
        units.map((unit) => unit.title),
      ]),
    ).toEqual([['Hussard', ['Overwatch', 'Sentry']]]);
  });
});

describe('validateProjects', () => {
  it('accepte les fiches du site', () => {
    expect(validateProjects(fiches)).toEqual(fiches);
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
      'un identifiant en double',
      [fiche('a', 1, ['b']), fiche('b', 1), fiche('b', 2)],
      'b : identifiant en double.',
    ],
    [
      'un corps vide',
      [{ ...fiche('a', 1, ['b']), body: [] }, fiche('b', 1)],
      'body',
    ],
    [
      'un paragraphe blanc',
      [{ ...fiche('a', 1, ['b']), body: ['  '] }, fiche('b', 1)],
      'body[0]',
    ],
    [
      'un titre manquant',
      [{ ...fiche('a', 1, ['b']), title: '' }, fiche('b', 1)],
      'title',
    ],
    [
      'un champ inconnu',
      [{ ...fiche('a', 1, ['b']), titre: 'faute' }, fiche('b', 1)],
      'titre',
    ],
  ])('refuse %s, avec un message qui le nomme', (_, projects, message) => {
    expect(() => validateProjects(projects)).toThrow(message);
  });
});
