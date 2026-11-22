import { expect, test } from '@playwright/test';
import decisions, {
  choix,
  erreurs,
} from '../src/content/projets/dragon/decisions';
import { cellText, pagePath, statusLabels } from '../src/lib/project-pages';
import type { ProjectPage, Table } from '../src/lib/validate-project-pages';
import {
  appearances,
  dataRows,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoInlineCode,
  region,
} from './helpers';

// Décisions du projet Dragon (ADR 0016, #101) : une section par ADR, puis le challenge.
const content: ProjectPage = decisions;
const url = pagePath(content.project, content.slug);
const adrs = content.sections.filter(({ id }) => id.startsWith('adr-'));

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le HTML pré-rendu contient le titre, la navigation et chaque section', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(page).toHaveTitle('Décisions — Dragon — Étendard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Décisions',
    );
    const link = page
      .getByRole('navigation', { name: 'Pages du projet Dragon' })
      .getByRole('link', { name: 'Décisions' });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      content.sections.map((section) => section.title),
    );
  });

  test('chaque ADR donne son statut, sa date, sa décision, une option écartée et ses risques', async ({
    page,
  }) => {
    expect(adrs.map(({ title }) => title.slice(0, 7))).toEqual([
      'ADR-001',
      'ADR-002',
      'ADR-003',
    ]);
    await page.goto(url);

    for (const { title, status, blocks } of adrs) {
      const section = region(page, title);
      // Le badge vient du seul champ `status` (critère 3) : aucun texte ne répète le statut.
      if (!status) throw new Error(`${title} : sans statut`);
      await expect(section.getByTestId('status-badge')).toHaveText(
        statusLabels[status],
      );
      await expect(section).toContainText('Date : 2026-11-20.');
      await expect(section).toContainText('Décision proposée : ');
      const [options, risks] = blocks.filter(
        (block): block is Table => block.type === 'table',
      );
      if (!options || !risks) throw new Error(`${title} : tableaux`);
      for (const table of [options, risks]) {
        const rows = dataRows(page, table.caption, section);
        await expect(rows).toHaveCount(table.rows.length);
        for (const [index, row] of table.rows.entries()) {
          await expect(rows.nth(index).getByRole('cell')).toContainText(
            row.map(cellText),
          );
        }
      }
      expect(options.rows.length).toBeGreaterThan(0);
      expect(risks.rows.length).toBeGreaterThan(0);
    }
    // Les ADR de Dragon sont proposés : la page n'écrit jamais « accepté ».
    await expect(page.getByRole('main')).not.toContainText(/accepté/i);
  });

  test('le challenge montre les 14 erreurs et les choix remis en cause, sans le club', async ({
    page,
  }) => {
    await page.goto(url);

    for (const table of [erreurs, choix]) {
      const rows = dataRows(page, table.caption);
      await expect(rows).toHaveCount(table.rows.length);
      for (const [index, row] of table.rows.entries()) {
        await expect(rows.nth(index).getByRole('cell')).toContainText(
          row.map(cellText),
        );
      }
    }
    expect(erreurs.rows).toHaveLength(14);
    // §2.1 à §2.8 sans le §2.6.
    expect(choix.rows).toHaveLength(7);
    await expect(page.getByRole('main')).not.toContainText(/club|FFAM/i);
    // Scénario de démonstration : le cadre d'environ 400 g, corrigé en 610 g.
    await expect(
      dataRows(page, erreurs.caption).first().getByRole('cell'),
    ).toContainText(['Cadre X500 V2 : environ 400 g', '610 g']);
  });

  test('aucun lien hors des dépôts de HSSRD', async ({ page }) => {
    await page.goto(url);

    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    const origin = new URL(page.url()).origin;
    for (const href of hrefs) {
      const link = new URL(href ?? '', page.url());
      if (link.origin === origin) continue;
      expect(link.href).toMatch(
        /^https:\/\/github\.com\/HSSRD\/(?:Dragon|Etendard)(?:\/|$)/,
      );
    }
  });
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
