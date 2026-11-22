// Matrice de compatibilité de la page Matériel (#99) : chaque fiche qu'elle cite est une section.
import { describe, expect, it } from 'vitest';
import type { Table } from '../../../lib/validate-project-pages';
import materiel, { fiches } from './materiel';

const matrix = materiel.sections
  .find((section) => section.id === 'compatibilite')
  ?.blocks.find((block): block is Table => block.type === 'table');

describe('matrice de compatibilité', () => {
  it('a ses 9 contraintes', () => {
    expect(matrix?.rows).toHaveLength(9);
  });

  it.each(matrix?.rows ?? [])(
    '« %s » ne cite que des fiches de la page',
    (_, concerned) => {
      const titles = fiches.map(({ title }) => title);
      // La cellule est exactement la liste des titres cités, dans l’ordre des fiches.
      const cited = titles.filter((title) => String(concerned).includes(title));
      expect(cited.length).toBeGreaterThanOrEqual(2);
      expect(cited.join(', ')).toBe(concerned);
    },
  );
});
