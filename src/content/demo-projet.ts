// Projet de démonstration du styleguide (ADR 0016), jamais publié en page : chaque état des
// composants de projet, indépendant du vrai contenu (ses captures ne bougent pas quand il change).
// Extraits du repo Dragon au commit relevé ; validé par Vitest (scripts/project-content.test.ts).
import type { WiringDiagramProps } from '../components/WiringDiagram';
import type { ProjectMeta, ProjectPage } from '../lib/validate-project-pages';
import type { Project } from '../lib/validate-projects';

const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';
const repo = 'https://github.com/HSSRD/Dragon';

const projet: ProjectMeta = {
  id: 'demo',
  title: 'Démonstration',
  status: 'en-cours',
  repo,
  pages: [
    { slug: '', label: 'Présentation' },
    { slug: 'materiel', label: 'Matériel' },
  ],
};

const accueil: ProjectPage = {
  project: 'demo',
  slug: '',
  title: 'Démonstration',
  description: 'Un projet de démonstration des pages de projet.',
  sections: [
    {
      id: 'feuille-de-route',
      title: 'Feuille de route',
      status: 'en-cours',
      source: { path: 'README.md', sha, date: '2026-11-21' },
      blocks: [
        {
          type: 'paragraph',
          text: 'Chaque phase a un objectif et un critère de sortie.',
        },
        {
          type: 'table',
          caption: 'Phases du projet',
          columns: ['Phase', 'Objectif', 'Critère de sortie', 'Statut'],
          rows: [
            [
              '0. Cadrage',
              'Budget, réglementation, sécurité, architecture',
              'Décisions d’architecture validées',
              { status: 'en-cours' },
            ],
            [
              '1. Construction',
              'Un drone qui vole en manuel, stable',
              'Vol stationnaire stable 3 min, failsafe testé',
              { status: 'en-cours' },
            ],
            [
              '2. Simulation',
              'Environnement de développement en simulateur',
              'Décollage, carré et atterrissage rejoués en simulation',
              { status: 'a-venir' },
            ],
          ],
        },
      ],
    },
    {
      id: 'methode',
      title: 'Méthode',
      status: 'termine',
      source: { path: 'README.md', sha, date: '2026-11-21' },
      blocks: [
        {
          type: 'list',
          items: [
            'Chaque choix est documenté.',
            'Chaque choix est justifié.',
            'Chaque choix est challengé avant d’être acté.',
          ],
        },
        {
          type: 'links',
          items: [
            {
              label: 'ADR-001 : architecture logicielle',
              href: `${repo}/blob/${sha}/docs/decisions/ADR-001-architecture-logicielle.md`,
            },
          ],
        },
      ],
    },
  ],
};

const materiel: ProjectPage = {
  project: 'demo',
  slug: 'materiel',
  title: 'Matériel',
  description: 'Le matériel du projet de démonstration.',
  sections: [
    {
      id: 'helices',
      title: 'Hélices',
      source: {
        path: 'docs/phase-1-construction/achats/02-helices.md',
        sha,
        date: '2026-11-20',
      },
      blocks: [
        {
          type: 'table',
          caption: 'Options comparées',
          columns: ['Option', 'Avantage', 'Prix du jeu'],
          rows: [
            [
              '1045 plastique',
              'Pas chères, partout',
              { price: { min: 5, max: 10, date: '2026-11-20' } },
            ],
            [
              '1045 carbone',
              'Rigide, efficace',
              { price: { min: 20, max: 40, date: '2026-11-20' } },
            ],
          ],
        },
      ],
    },
    {
      id: 'budget',
      title: 'Budget',
      source: {
        path: 'docs/phase-1-construction/bom.md',
        sha,
        date: '2026-11-21',
      },
      blocks: [
        {
          type: 'paragraph',
          text: 'Une source aux données jamais publiées est citée sans lien.',
        },
      ],
    },
  ],
};

/** Carte d'un projet qui a sa page (ProjectCard). */
const carte: Project = {
  id: 'demo',
  title: 'Démonstration',
  summary: 'Un projet de démonstration des pages de projet.',
  order: 1,
  body: ['Sa carte porte un lien vers sa page.'],
  page: '/projets/demo',
};

/** Schéma (WiringDiagram) : liaison libellée ou non, latérale entrante, sortante et prévue pour plus tard. */
const schema: WiringDiagramProps = {
  label: 'Schéma de démonstration des liaisons.',
  chains: [
    {
      title: 'Commande',
      steps: [
        { label: 'Radiocommande', detail: 'au sol' },
        {
          label: 'Contrôleur de vol',
          via: 'commandes',
          branches: [{ direction: 'in', label: 'GPS', via: 'position' }],
        },
      ],
    },
    {
      title: 'Puissance',
      steps: [
        { label: 'Batterie' },
        {
          label: 'Module de puissance',
          via: 'alimentation',
          branches: [
            {
              direction: 'out',
              label: 'BEC',
              detail: 'phase 3',
              via: 'alimentation',
              later: true,
            },
          ],
        },
        { label: 'Moteurs' },
      ],
    },
  ],
};

export default { projet, pages: [accueil, materiel], carte, schema };
