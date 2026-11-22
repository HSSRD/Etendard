import { expect, test } from '@playwright/test';
import decisions, {
  adrs,
  choix,
  decisionLabels,
  erreurs,
} from '../src/content/projets/dragon/decisions';
import { pagePath, statusLabels } from '../src/lib/project-pages';
import type { ProjectPage, Table } from '../src/lib/validate-project-pages';
import {
  appearances,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoInlineCode,
  expectNoShopLinkNorThirdPartyImage,
  expectTable,
  region,
} from './helpers';

// Décisions du projet Dragon (ADR 0016, #101) : une section par ADR, puis le challenge.
const content: ProjectPage = decisions;
const url = pagePath(content.project, content.slug);

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
    expect(adrs.map(({ id }) => id)).toEqual(['adr-001', 'adr-002', 'adr-003']);
    await page.goto(url);

    for (const { title, status, source, blocks } of adrs) {
      const section = region(page, title);
      // Le badge vient du seul champ `status` (critère 3).
      await expect(section.getByTestId('status-badge')).toHaveText(
        statusLabels[status],
      );
      await expect(section).toContainText(/Date : \d{4}-\d{2}-\d{2}\./);
      await expect(section).toContainText(`${decisionLabels[status]} : `);
      const [options, risks] = blocks.filter(
        (block): block is Table => block.type === 'table',
      );
      // Les deux tableaux de adr() ; le type Adr leur impose au moins une ligne.
      if (!options || !risks) throw new Error(`${title} : tableaux`);
      await expectTable(page, options, section);
      await expectTable(page, risks, section);
      await expect(section.getByTestId('source')).toContainText(
        `${source.path} au commit ${source.sha.slice(0, 7)}, relevé le ${source.date}`,
      );
    }
    // Seul le badge dit le statut : aucun texte n'écrit « accepté ».
    const texts = await page
      .getByRole('main')
      .getByRole('paragraph')
      .or(page.getByRole('main').getByRole('cell'))
      .allTextContents();
    expect(texts.join('\n')).not.toMatch(/accepté/i);
  });

  test('le challenge montre les 14 erreurs et les choix remis en cause, sans le club', async ({
    page,
  }) => {
    expect(erreurs.rows).toHaveLength(14);
    // Scénario de démonstration : le cadre d'environ 400 g, corrigé en 610 g.
    expect(erreurs.rows[0]?.slice(0, 2)).toEqual([
      'Cadre X500 V2 : environ 400 g',
      '610 g, d’après Holybro et un revendeur.',
    ]);
    // §2.1 à §2.8 sans le §2.6.
    expect(choix.rows).toHaveLength(7);
    await page.goto(url);

    await expectTable(page, erreurs);
    await expectTable(page, choix);
    await expect(page.getByRole('main')).not.toContainText(/club|FFAM/i);
  });

  test('aucun lien vers une boutique ni image tierce', async ({ page }) => {
    await page.goto(url);
    await expectNoShopLinkNorThirdPartyImage(page);
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
