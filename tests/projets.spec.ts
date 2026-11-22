import { expect, test, type Page } from '@playwright/test';
import accueil from '../src/content/projets/dragon/accueil';
import type { ProjectPage, Table } from '../src/lib/validate-project-pages';
import {
  appearances,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectNoInlineCode,
} from './helpers';

// Accueil du projet Dragon (ADR 0016), route statique pré-rendue.
const url = '/projets/dragon';

/** Lignes du tableau de la feuille de route, telles qu'écrites dans accueil.ts. */
const content: ProjectPage = accueil;
const blocks = content.sections.flatMap((section) => section.blocks);
const phases =
  blocks.find((block): block is Table => block.type === 'table')?.rows ?? [];

const region = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true });

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le HTML pré-rendu contient le titre et la navigation du projet', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(page).toHaveTitle('Dragon — Étendard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragon');
    const nav = page.getByRole('navigation', {
      name: 'Pages du projet Dragon',
    });
    await expect(
      nav.getByRole('link', { name: 'Présentation' }),
    ).toHaveAttribute('href', url);
    await expect(
      nav.getByRole('link', { name: 'Présentation' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('link', { name: 'Dépôt Dragon sur GitHub' }),
    ).toHaveAttribute('href', 'https://github.com/HSSRD/Dragon');
    // Header et footer du site : retour à la one page, et haut de cette page.
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Projets' }),
    ).toHaveAttribute('href', '/#projets');
    await expect(
      page.getByRole('link', { name: 'Retour en haut' }),
    ).toHaveAttribute('href', '#haut');
    await expect(page.locator('#haut')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      content.sections.map((section) => section.title),
    );
  });

  test('le HTML pré-rendu contient le pitch et les 7 phases datées', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(region(page, 'Le projet')).toContainText(
      'Le projet est piloté avec l’IA',
    );
    const roadmap = region(page, 'Feuille de route');
    const rows = roadmap
      .getByRole('table', { name: 'Phases du projet Dragon' })
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });
    await expect(rows).toHaveCount(7);
    // Phase, objectif et critère de sortie de accueil.ts, ligne par ligne, puis le badge de statut.
    for (const column of [0, 1, 2]) {
      await expect(rows).toContainText(
        phases.map((row) => String(row[column])),
      );
    }
    await expect(roadmap.getByTestId('status-badge')).toHaveText([
      ...Array<string>(2).fill('En cours'),
      ...Array<string>(5).fill('À venir'),
    ]);
    await expect(roadmap.getByTestId('source')).toContainText(
      'relevé le 2026-11-22',
    );
  });

  test('la section Méthode reprend les 5 règles et la sécurité de principe', async ({
    page,
  }) => {
    await page.goto(url);
    const method = region(page, 'Méthode');
    const [rules, safety] = await method.getByRole('list').all();
    if (!rules || !safety) throw new Error('deux listes attendues');

    await expect(rules.getByRole('listitem')).toHaveCount(5);
    await expect(safety.getByRole('listitem')).toHaveCount(6);
    await expect(rules.getByRole('listitem')).toContainText([
      'sans trace écrite',
      'challengé',
      'Vérifier avant d’acheter',
      'journal de bord',
      'test mesurable',
    ]);
    await expect(safety.getByRole('listitem')).toContainText([
      'Hélices démontées',
      'smoke stopper',
      'LiPo chargées sous surveillance',
      'failsafe testé',
      'Premiers vols',
      'réglementation',
    ]);
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
