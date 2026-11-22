import { expect, test } from '@playwright/test';
import { securite } from '../src/content/projets/dragon/accueil';
import architecture, {
  liaisons,
  schema,
} from '../src/content/projets/dragon/architecture';
import { pagePath } from '../src/lib/project-pages';
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

// Architecture du projet Dragon (ADR 0016, #102) : schéma, niveaux, dimensionnement, étapes,
// réglementation et sécurité.
const content: ProjectPage = architecture;
const url = pagePath(content.project, content.slug);

/** Tableaux d'une section du contenu, par son id. */
const tables = (id: string) =>
  (content.sections.find((section) => section.id === id)?.blocks ?? []).filter(
    (block): block is Table => block.type === 'table',
  );

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le HTML pré-rendu contient le titre, la navigation et chaque section', async ({
    page,
  }) => {
    await page.goto(url);

    await expect(page).toHaveTitle('Architecture — Dragon — Étendard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Architecture',
    );
    const nav = page.getByRole('navigation', {
      name: 'Pages du projet Dragon',
    });
    const link = nav.getByRole('link', { name: 'Architecture' });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('aria-current', 'page');
    // L'ADR-001 en détail : la page Décisions, dans la navigation.
    await expect(nav.getByRole('link', { name: 'Décisions' })).toHaveAttribute(
      'href',
      pagePath(content.project, 'decisions'),
    );
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      content.sections.map((section) => section.title),
    );
  });

  test('le schéma et sa liste couvrent chaque liaison, le BEC marqué plus tard', async ({
    page,
  }) => {
    await page.goto(url);
    const section = region(page, 'Schéma des liaisons');

    // Le contenu du schéma est vérifié par WiringDiagram.spec.ts.
    await expect(
      section.getByRole('img', { name: schema.label }),
    ).toBeVisible();
    await expect(section.getByRole('listitem')).toContainText(liaisons);
    // Chaque liaison du §2 a sa phrase.
    for (const part of [
      /radiocommande.*récepteur radio/,
      /récepteur radio.*contrôleur de vol/,
      /GPS.*contrôleur de vol/,
      /contrôleur de vol.*ESC/,
      /batterie 4S.*module de puissance/,
      /module de puissance.*ESC/,
      /module de puissance.*contrôleur de vol/,
      /moteurs/,
      /hélice/,
      /Plus tard.*BEC/,
    ]) {
      expect(liaisons.some((liaison) => part.test(liaison))).toBe(true);
    }
  });

  test('le dimensionnement donne ses 4 étapes, son bilan de poids révisé et le rapport poussée sur poids', async ({
    page,
  }) => {
    await page.goto(url);
    const section = region(page, 'Dimensionnement');

    await expect(section.getByRole('listitem')).toHaveCount(4);
    const [bilan] = tables('dimensionnement');
    if (!bilan) throw new Error('Dimensionnement : bilan de poids');
    expect(bilan.caption).toContain('révisé le 2026-11-20');
    await expectTable(page, bilan, section);
    await expect(section).toContainText('5,3 kg');
    await expect(section).toContainText(
      '3,1 à 3,4 en phase 1, et environ 2,7 en phases 3 et 4',
    );
  });

  test('les étapes de réalisation ont chacune leur validation', async ({
    page,
  }) => {
    await page.goto(url);
    const [etapes] = tables('etapes');
    if (!etapes) throw new Error('Étapes : tableau');
    expect(etapes.rows).toHaveLength(12);
    await expectTable(page, etapes, region(page, 'Étapes de réalisation'));
  });

  test('réglementation et sécurité : les règles générales, sans numéro, lieu, terrain ni assureur', async ({
    page,
  }) => {
    await page.goto(url);
    const rules = region(page, 'Réglementation');
    for (const rule of ['A1/A3', '800 g', 'A3 uniquement', '150 m', '120 m']) {
      await expect(rules).toContainText(rule);
    }
    const safety = region(page, 'Règles de sécurité');
    await expect(safety.getByRole('listitem')).toContainText(securite);
    const firstFlight = region(page, 'Avant le premier vol');
    await expect(firstFlight).toContainText('Cinq heures de simulateur');
    await expect(firstFlight).toContainText('Un assistant présent');
    await expect(firstFlight).toContainText('checklist pré-vol');

    for (const part of [rules, safety, firstFlight]) {
      await expect(part).not.toContainText(
        /terrain|club|FFAM|assur|N° d|numéro|FRA[-\d]/i,
      );
    }
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
  test(`${url}, ${name} : accessibilité, schéma lisible, sans défilement horizontal`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia(media);
    await page.goto(url);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    // Captures du vrai schéma en sombre et en couleurs forcées (critère 2), à la largeur la plus
    // étroite : le styleguide capture le composant à toutes les largeurs et apparences.
    if (testInfo.project.name !== 'chromium-375' || name === 'light') return;
    await expect(page.getByTestId('schema')).toHaveScreenshot(
      `architecture-schema-${name}.png`,
      { stylePath: 'tests/sans-header.css' },
    );
  });
}
