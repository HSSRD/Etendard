import { expect, test } from '@playwright/test';
import decisions, {
  adrs,
  choix,
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

    for (const { title, status, blocks } of adrs) {
      const section = region(page, title);
      // Le badge vient du seul champ `status` (critère 3).
      if (!status) throw new Error(`${title} : sans statut`);
      await expect(section.getByTestId('status-badge')).toHaveText(
        statusLabels[status],
      );
      await expect(section).toContainText(/Date : \d{4}-\d{2}-\d{2}\./);
      await expect(section).toContainText('Décision proposée : ');
      const [options, risks] = blocks.filter(
        (block): block is Table => block.type === 'table',
      );
      if (!options?.rows.length || !risks?.rows.length) {
        throw new Error(`${title} : sans option écartée ou sans risque`);
      }
      await expectTable(page, options, section);
      await expectTable(page, risks, section);
    }
    // Les ADR de Dragon sont proposés : la page n'écrit jamais « accepté ».
    await expect(page.getByRole('main')).not.toContainText(/accepté/i);
  });

  test('le challenge montre les 14 erreurs et les choix remis en cause, sans le club', async ({
    page,
  }) => {
    // Dont le scénario de démonstration : le cadre d'environ 400 g, corrigé en 610 g.
    expect(erreurs.rows).toHaveLength(14);
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
