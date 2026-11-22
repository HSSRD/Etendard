// Fiches des projets et de leurs sous-unités (ADR 0015), validées par Zod au build
// (scripts/check-content.ts, src/lib/validate-projects.ts) : une fiche invalide fait échouer `pnpm build`.
// Ajouter un projet : une entrée ici, reliée par les `units` de son projet, ou autonome avec sa `page`.
import type { Project } from '../lib/validate-projects';

export default [
  {
    id: 'hussard',
    title: 'Hussard',
    summary:
      'Un système de surveillance qui réunit une caméra motorisée et l’application qui la pilote.',
    order: 1,
    units: ['overwatch', 'sentry'],
    body: [
      'Hussard fait travailler ensemble deux sous-projets : Sentry filme et repère les mouvements, Overwatch affiche l’image et oriente la caméra.',
    ],
  },
  {
    id: 'overwatch',
    title: 'Overwatch',
    summary:
      'Une application Unity qui affiche le flux vidéo de Sentry et dirige la caméra.',
    order: 1,
    body: [
      'Overwatch reçoit le flux vidéo diffusé par Sentry et l’affiche. Depuis l’application, on envoie à la caméra les ordres de mouvement qui l’orientent.',
    ],
  },
  {
    id: 'sentry',
    title: 'Sentry',
    summary:
      'Une caméra motorisée qui diffuse son flux vidéo et détecte les mouvements.',
    order: 2,
    body: [
      'Sentry est une caméra montée sur deux servomoteurs, qui lui permettent de pivoter. Elle diffuse son flux vidéo et repère les mouvements dans son champ de vision.',
    ],
  },
  {
    id: 'dragon',
    title: 'Dragon',
    summary:
      'Un quadricoptère construit de A à Z, où chaque choix est documenté, justifié et challengé.',
    order: 2,
    body: [
      'Dragon en est à la construction de son premier drone : première commande passée le 2026-11-20 ; au 2026-11-22, aucun vol.',
    ],
    page: '/projets/dragon',
  },
] satisfies Project[];
