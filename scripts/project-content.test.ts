import { pagePath } from '../src/lib/project-pages.ts';
import fiches from '../src/content/projects.ts';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateProjectContent } from '../src/lib/validate-project-pages.ts';
import {
  validateProjects,
  type Project,
} from '../src/lib/validate-projects.ts';
import { loadProjectContents } from './project-content.ts';

const contents = await loadProjectContents();

describe('pages de projet de src/content/projets/', () => {
  it('lit au moins le projet Dragon', () => {
    expect(contents.map(({ dir }) => dir)).toContain('dragon');
  });

  it.each(contents.map((content) => [content.dir, content] as const))(
    '%s : contenu valide',
    (_, content) => {
      expect(() => validateProjectContent(content)).not.toThrow();
    },
  );

  it.each(contents.map((content) => [content.dir, content] as const))(
    '%s : chaque page de la navigation a sa route',
    (dir, { meta }) => {
      const { pages } = meta.data as { pages: { slug: string }[] };
      for (const { slug } of pages) {
        const route = `../src/app/projets/${dir}/${slug || 'index'}.tsx`;
        expect(existsSync(new URL(route, import.meta.url)), route).toBe(true);
      }
    },
  );
});

describe('projet de démonstration du styleguide', () => {
  it('est valide', async () => {
    const { default: demo } = await import('../src/content/demo-projet.ts');
    expect(() =>
      validateProjectContent({
        dir: 'demo',
        meta: { file: 'demo-projet.ts', data: demo.projet },
        pages: demo.pages.map((data) => ({ file: 'demo-projet.ts', data })),
      }),
    ).not.toThrow();
    // La carte est une sous-unité : sa racine (factice) la référence.
    const racine = { ...demo.carte, id: 'racine', units: ['demo'] };
    expect(() => validateProjects([racine, demo.carte])).not.toThrow();
  });
});

describe('cartes de src/content/projects.ts', () => {
  it('chaque page déclarée par une carte est celle d’un projet', () => {
    const dirs = contents.map(({ dir }) => pagePath(dir, ''));
    for (const { id, page } of fiches as Project[]) {
      if (page) expect(dirs, `${id} : ${page}`).toContain(page);
    }
  });
});
