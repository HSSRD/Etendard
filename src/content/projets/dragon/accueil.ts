// Accueil du projet Dragon (/projets/dragon), copie rédigée de son README (ADR 0016).
import type { ProjectPage } from '../../../lib/validate-project-pages';

export default {
  project: 'dragon',
  slug: '',
  title: 'Dragon',
  description:
    'Un quadricoptère construit de A à Z, où chaque choix est documenté, justifié et challengé.',
  sections: [
    {
      id: 'presentation',
      title: 'Le projet',
      status: 'en-cours',
      source: {
        path: 'README.md',
        sha: '3afc561a33cdb9241e380040d74ab37cdd1d8f1f',
        date: '2026-11-21',
      },
      blocks: [
        {
          type: 'paragraph',
          text: 'Dragon construit un drone de A à Z : un châssis en kit, une électronique choisie pièce par pièce, puis un logiciel écrit par l’équipe pour les déplacements et les missions, enfin des caméras et des capteurs.',
        },
        {
          type: 'paragraph',
          text: 'Le projet est piloté avec l’IA : chaque choix est documenté, justifié et challengé avant d’être acté.',
        },
      ],
    },
  ],
} satisfies ProjectPage;
