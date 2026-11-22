import { expect, test, type Locator, type Page } from '@playwright/test';
import materiel, {
  compatibilite as matrix,
  fiches,
} from '../src/content/projets/dragon/materiel';
import { cellText, pagePath } from '../src/lib/project-pages';
import type { ProjectPage, Table } from '../src/lib/validate-project-pages';
import {
  appearances,
  dataRows,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoInlineCode,
  region,
} from './helpers';

// Matériel du projet Dragon (ADR 0016, #99) : une section par fiche d'achat, puis la matrice.
const content: ProjectPage = materiel;
const url = pagePath(content.project, content.slug);

/** Le tableau `table` de `scope` affiche toutes ses lignes, chaque cellule à sa place. */
const expectTable = async (scope: Page | Locator, table: Table) => {
  const shown = dataRows(scope, table.caption);
  await expect(shown).toHaveCount(table.rows.length);
  for (const column of table.columns.keys()) {
    await expect(shown).toContainText(
      table.rows.map((row) => cellText(row[column] ?? '')),
    );
  }
};

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le HTML pré-rendu contient le titre, la navigation et chaque section', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(page).toHaveTitle('Matériel — Dragon — Étendard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Matériel',
    );
    const nav = page.getByRole('navigation', {
      name: 'Pages du projet Dragon',
    });
    const link = nav.getByRole('link', { name: 'Matériel' });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(
      nav.getByRole('link', { name: 'Présentation' }),
    ).toHaveAttribute('href', pagePath(content.project, ''));
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      content.sections.map((section) => section.title),
    );
  });

  test('chaque fiche donne son rôle, son choix, une alternative écartée et un prix daté', async ({
    page,
  }) => {
    expect(fiches).toHaveLength(12);
    await page.goto(url);

    for (const { title, source, blocks } of fiches) {
      const section = region(page, title);
      // Le rôle : le premier paragraphe de la fiche, avant ses tableaux.
      const [role] = blocks;
      if (role?.type !== 'paragraph') throw new Error(`${title} : sans rôle`);
      await expect(section.getByRole('paragraph').first()).toHaveText(
        role.text,
      );
      const [choices, alternatives] = blocks.filter(
        (block): block is Table => block.type === 'table',
      );
      if (!choices || !alternatives) throw new Error(`${title} : tableaux`);
      const prices = choices.rows
        .flat()
        .flatMap((cell) => (typeof cell === 'object' && cell.price) || []);
      expect(prices.map(({ date }) => date)).toContain('2026-11-20');
      expect(alternatives.rows.length).toBeGreaterThan(0);
      // Choix, raison et prix ; alternative et raison.
      await expectTable(section, choices);
      await expectTable(section, alternatives);
      await expect(section.getByTestId('source')).toContainText(
        `${source.path} au commit ${source.sha.slice(0, 7)}, relevé le ${source.date}`,
      );
    }
  });

  test('la matrice de compatibilité affiche ses 9 contraintes et leurs fiches', async ({
    page,
  }) => {
    await page.goto(url);

    expect(matrix.rows).toHaveLength(9);
    await expectTable(page, matrix);
  });

  test('la section Contrôleur de vol explique le choix du Pixhawk 6C et l’option disparue', async ({
    page,
  }) => {
    await page.goto(url);
    const section = region(page, 'Contrôleur de vol');

    await expect(section).toContainText('Pixhawk 6C');
    await expect(section).toContainText(
      'supporté officiellement par ArduPilot',
    );
    await expect(section).toContainText('L’option économique');
    await expect(section).toContainText('la carte est arrêtée');
  });

  test('aucun lien vers une boutique ni image tierce', async ({ page }) => {
    await page.goto(url);

    // Liens externes : les dépôts GitHub de HSSRD seulement (Dragon et ses fichiers à un commit,
    // Étendard), donc aucune boutique.
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    const origin = new URL(page.url()).origin;
    for (const href of hrefs) {
      const link = new URL(href ?? '', page.url());
      if (link.origin === origin) continue;
      expect(link.href).toMatch(
        /^https:\/\/github\.com\/HSSRD\/(?:Dragon|Etendard)(?:\/|$)/,
      );
    }
    // Images : uniquement celles du site.
    const sources = await page
      .locator('img')
      .evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).src),
      );
    for (const source of sources) expect(new URL(source).origin).toBe(origin);
  });
});

test('les tableaux de trois colonnes passent en liste à 375 px', async ({
  page,
}, testInfo) => {
  await page.goto(url);
  const head = page
    .getByRole('table', { name: 'Contrôleur de vol : choix retenu' })
    .getByTestId('table-head');
  if (testInfo.project.name === 'chromium-375') await expect(head).toBeHidden();
  else await expect(head).toBeVisible();
});

test('la page n’a ni style ni script en ligne', async ({ page }) => {
  await expectNoInlineCode(page, url);
});

for (const { name, ...media } of appearances) {
  test(`${url}, ${name} : accessibilité, sans défilement horizontal`, async ({
    page,
  }) => {
    await page.emulateMedia(media);
    await page.goto(url);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}
