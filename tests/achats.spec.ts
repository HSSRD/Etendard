import { expect, test } from '@playwright/test';
import achats, { vagues } from '../src/content/projets/dragon/achats';
import { pagePath } from '../src/lib/project-pages';
import type {
  ProjectPage,
  Section,
  Table,
} from '../src/lib/validate-project-pages';
import {
  appearances,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoInlineCode,
  expectNoShopLinkNorThirdPartyImage,
  expectTable,
  region,
} from './helpers';

// Achats et budget du projet Dragon (ADR 0016, #100) : principes, vagues 0 à 5, budget, état des commandes.
const content: ProjectPage = achats;
const url = pagePath(content.project, content.slug);

const section = (id: string): Section => {
  const found = content.sections.find((entry) => entry.id === id);
  if (!found) throw new Error(`section « ${id} » absente`);
  return found;
};

const tables = ({ blocks }: Section) =>
  blocks.filter((block): block is Table => block.type === 'table');

const lists = ({ blocks }: Section) =>
  blocks.flatMap((block) => (block.type === 'list' ? [block.items] : []));

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le HTML pré-rendu contient le titre, la navigation et chaque section', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(page).toHaveTitle('Achats et budget — Dragon — Étendard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Achats et budget',
    );
    const nav = page.getByRole('navigation', {
      name: 'Pages du projet Dragon',
    });
    const link = nav.getByRole('link', { name: 'Achats' });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Matériel' })).toHaveAttribute(
      'href',
      pagePath(content.project, 'materiel'),
    );
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      content.sections.map(({ title }) => title),
    );
  });

  test('chaque vague donne son contenu, la raison de son moment et ses conditions en liste', async ({
    page,
  }) => {
    expect(vagues.map(({ title }) => title.slice(0, 7))).toEqual(
      [0, 1, 2, 3, 4, 5].map((n) => `Vague ${n}`),
    );
    await page.goto(url);

    for (const vague of vagues) {
      const shown = region(page, vague.title);
      for (const table of tables(vague)) await expectTable(page, table, shown);
      // La raison de son moment, puis ses conditions, chacune annoncée et en liste.
      await expect(
        shown
          .getByRole('paragraph')
          .filter({ hasText: /^Pourquoi à ce moment :$/ }),
      ).toHaveCount(1);
      await expect(
        shown.getByRole('paragraph').filter({ hasText: /^Conditions? / }),
      ).toHaveCount(1);
      const [why, conditions] = lists(vague);
      const items = shown.getByRole('list');
      await expect(items).toHaveCount(2);
      // Chaque élément commence par sa puce.
      await expect(items.nth(0).getByRole('listitem')).toContainText(why ?? []);
      await expect(items.nth(1).getByRole('listitem')).toContainText(
        conditions ?? [],
      );
    }
  });

  test('la radio passe avant le drone, les batteries en dernier', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(region(page, 'Principes de l’ordre d’achat')).toContainText(
      'La radio avant le drone : elle sert de manette pour le simulateur',
    );
    await expect(region(page, 'Principes de l’ordre d’achat')).toContainText(
      'Les batteries LiPo le plus tard possible',
    );
  });

  test('le budget donne le plafond de 1 200 €, puis les dépenses cumulées et le reste, en fourchettes datées', async ({
    page,
  }) => {
    await page.goto(url);
    const budget = section('budget');
    const shown = region(page, budget.title);

    const [ceiling, cumulative] = tables(budget);
    if (!ceiling || !cumulative) throw new Error('budget : tableaux');
    await expectTable(page, ceiling, shown);
    await expect(shown).toContainText('1 200 €, prévu le 2026-11-20');
    await expectTable(page, cumulative, shown);
    // Le premier paragraphe suit les tableaux.
    await expect(shown.getByRole('paragraph').first()).toHaveText(
      /^Prévision relevée le 2026-11-20/,
    );
  });

  test('l’état des commandes tient en une phrase', async ({ page }) => {
    await page.goto(url);
    const shown = region(page, 'État des commandes');

    // Une phrase, puis la source de la section.
    await expect(shown.getByRole('paragraph')).toHaveText([
      'Première commande passée le 2026-11-20.',
      /^Source : docs\/phase-1-construction\/bom\.md au commit 3afc561/,
    ]);
    // bom.md contient des données jamais publiées : cité sans lien.
    await expect(shown.getByRole('link')).toHaveCount(0);
  });

  test('aucun nom de boutique, montant payé ni lien marchand', async ({
    page,
  }) => {
    await page.goto(url);

    const text = await page.locator('body').innerText();
    for (const banned of [
      /studiosport/i,
      /flashrc/i,
      /dronavia/i,
      /drone-fpv-racer/i,
      /unmanned tech/i,
      /pay[ée]/i,
    ]) {
      expect(text).not.toMatch(banned);
    }
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
