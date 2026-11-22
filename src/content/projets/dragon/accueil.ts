// Accueil du projet Dragon (/projets/dragon), copie rédigée de son README et de son CLAUDE.md (ADR 0016).
import type { ProjectPage } from '../../../lib/validate-project-pages';

/** Commit de Dragon relevé. */
const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';

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
      source: { path: 'README.md', sha, date: '2026-11-21' },
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
    {
      id: 'feuille-de-route',
      title: 'Feuille de route',
      source: { path: 'README.md', sha, date: '2026-11-22' },
      blocks: [
        {
          type: 'paragraph',
          text: 'Sept phases, chacune avec un objectif et un critère de sortie. Le code de l’équipe ne pilote le vrai drone qu’en phase 3, une fois qu’il vole déjà en manuel.',
        },
        {
          type: 'table',
          caption: 'Phases du projet Dragon',
          columns: ['Phase', 'Objectif', 'Critère de sortie', 'Statut'],
          rows: [
            [
              '0. Cadrage',
              'Fixer le budget, la réglementation, la sécurité et l’architecture.',
              'Les trois premières décisions d’architecture sont validées, l’examen de télépilote A1/A3 est passé et l’inscription sur AlphaTango est faite.',
              { status: 'en-cours' },
            ],
            [
              '1. Construction',
              'Un drone qui vole en manuel, stable.',
              'Un vol stationnaire stable pendant 3 minutes, et un failsafe testé.',
              { status: 'en-cours' },
            ],
            [
              '2. Simulation',
              'Un environnement de développement sur simulateur (SITL et Gazebo).',
              'Décollage, carré et atterrissage codés, puis rejoués en simulation.',
              { status: 'a-venir' },
            ],
            [
              '3. Cerveau embarqué',
              'Un ordinateur compagnon (Raspberry Pi) sous un Linux minimal, relié au contrôleur de vol par MAVLink.',
              'Le code de l’équipe fait décoller, déplacer et atterrir le vrai drone.',
              { status: 'a-venir' },
            ],
            [
              '4. Capteurs',
              'Caméra, télémètre, flux optique.',
              'Le code de l’équipe exploite le flux vidéo et les données des capteurs.',
              { status: 'a-venir' },
            ],
            [
              '5. Autonomie',
              'Vision, suivi et évitement d’obstacles.',
              'À définir.',
              { status: 'a-venir' },
            ],
            [
              '6. Firmware maison (en option)',
              'Écrire un contrôleur de vol maison.',
              'Un vol stationnaire avec la stabilisation maison, sur banc puis en vol attaché.',
              { status: 'a-venir' },
            ],
          ],
        },
      ],
    },
    {
      id: 'methode',
      title: 'Méthode',
      source: { path: 'CLAUDE.md', sha, date: '2026-11-22' },
      blocks: [
        {
          type: 'paragraph',
          text: 'Tout est documenté, justifié et challengé. Cinq règles s’appliquent aux humains comme à l’IA :',
        },
        {
          type: 'list',
          items: [
            'Rien n’est acheté, câblé ou flashé sans trace écrite. Une décision structurante fait l’objet d’une fiche : contexte, options comparées, choix, risques et retour arrière.',
            'Tout choix est challengé : chaque recommandation donne l’alternative crédible, ce qui ferait changer d’avis et ce qui reste incertain. Les chiffres non vérifiés sont signalés comme à confirmer.',
            'Vérifier avant d’acheter : disponibilité, compatibilité des connecteurs et des tensions, fiche technique.',
            'Un journal de bord : chaque séance de montage ou de test a son entrée, avec ce qui a été fait, les mesures, les problèmes et l’étape suivante.',
            'Des critères de validation explicites : chaque étape se termine par un test mesurable, pas par « ça a l’air bon ».',
          ],
        },
        {
          type: 'paragraph',
          text: 'La sécurité ne se négocie pas :',
        },
        {
          type: 'list',
          items: [
            'Hélices démontées pour tout travail sur table : configuration, moteurs, firmware. Elles ne reviennent qu’au moment de voler.',
            'Première mise sous tension après une soudure derrière un smoke stopper, ou une alimentation de laboratoire limitée en courant.',
            'Batteries LiPo chargées sous surveillance, dans un sac ignifuge ; jamais de batterie gonflée ou abîmée.',
            'Un interrupteur d’armement et de coupure sur la radiocommande, et un failsafe testé avant le premier vol.',
            'Premiers vols dans un espace dégagé, sans personne autour, pilote derrière le drone.',
            'Respect de la réglementation de la DGAC.',
          ],
        },
      ],
    },
  ],
} satisfies ProjectPage;
