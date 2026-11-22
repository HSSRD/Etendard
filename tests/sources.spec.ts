import { expect, test } from '@playwright/test';
import { loadProjectContents } from '../scripts/project-content';
import { isLinkable, pagePath } from '../src/lib/project-pages';
import type {
  ProjectMeta,
  ProjectPage,
} from '../src/lib/validate-project-pages';
import { region } from './helpers';

// Ticket #103, critère 4 : chaque page de projet affiche, par section, la date et le SHA court de
// sa source, liée à ce SHA dans le repo source, sauf un fichier aux données jamais publiées (ADR 0016).
const pages = (await loadProjectContents()).flatMap(({ meta, pages }) =>
  pages.map(({ data }) => ({
    project: meta.data as ProjectMeta,
    page: data as ProjectPage,
  })),
);

test.use({ javaScriptEnabled: false });

for (const { project, page: content } of pages) {
  const url = pagePath(project.id, content.slug);

  test(`${url} : source datée de chaque section, liée à son SHA`, async ({
    page,
  }) => {
    await page.goto(url);
    for (const { title, source } of content.sections) {
      const shown = region(page, title).getByTestId('source');
      await expect(shown).toHaveText(
        `Source : ${source.path} au commit ${source.sha.slice(0, 7)}, relevé le ${source.date}`,
      );
      // URL écrite ici, pas par sourceUrl : le test ne compare pas le code à lui-même.
      if (isLinkable(source.path)) {
        await expect(shown.getByRole('link')).toHaveAttribute(
          'href',
          `${project.repo}/blob/${source.sha}/${source.path}`,
        );
      } else {
        await expect(shown.getByRole('link')).toHaveCount(0);
      }
    }
    await expect(
      page.locator(
        'a[href*="bom.md"], a[href*="ordre-achat.md"], a[href*="commandes"]',
      ),
    ).toHaveCount(0);
  });
}
