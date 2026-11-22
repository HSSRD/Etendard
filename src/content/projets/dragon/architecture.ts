// Architecture du projet Dragon (/projets/dragon/architecture), copie rédigée du §2, du §3, du §5 et
// des règles générales du §1 de la doc de la phase 1, des niveaux de l'ADR-001, des règles de
// sécurité et de trois règles de bom.md (ADR 0016). Jamais le statut personnel des préalables
// (exploitant, lieu de vol, club, assurance) ni les mots « sans club ».
import type { WiringDiagramProps } from '../../../components/WiringDiagram';
import type { ProjectPage } from '../../../lib/validate-project-pages';
import { securite } from './accueil.ts';

/** Commit de Dragon relevé. */
const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';
/** Date de lecture des sources. */
const read = '2026-11-22';

const source = (path: string) => ({ path, sha, date: read });
const phase1 = source('docs/phase-1-construction/README.md');

const paragraph = (text: string) => ({ type: 'paragraph' as const, text });

/** Schéma du §2 : la chaîne de commande, puis la chaîne de puissance. */
export const schema: WiringDiagramProps = {
  label:
    'Schéma des liaisons entre les composants de Dragon, décrit par la liste qui le suit.',
  chains: [
    {
      title: 'Commande',
      steps: [
        { label: 'Radiocommande', detail: 'au sol' },
        { label: 'Récepteur radio', via: '2,4 GHz, ExpressLRS' },
        {
          label: 'Contrôleur de vol',
          detail: 'STM32H7, ArduPilot ou PX4',
          via: 'commandes',
          branches: [
            { direction: 'in', label: 'GPS et compas', via: 'position et cap' },
          ],
        },
        { label: 'ESC ×4', via: 'signaux DShot' },
      ],
    },
    {
      title: 'Puissance',
      steps: [
        { label: 'Batterie 4S' },
        {
          label: 'Module de puissance',
          via: 'alimentation',
          branches: [
            {
              direction: 'out',
              label: 'Contrôleur de vol',
              via: '5 V régulé, tension et courant mesurés',
            },
            {
              direction: 'out',
              label: 'BEC 5 V 5 A',
              detail: 'phase 3 : Raspberry Pi, caméras',
              via: 'alimentation',
              later: true,
            },
          ],
        },
        { label: 'ESC ×4', via: 'alimentation' },
        { label: 'Moteurs ×4' },
        { label: 'Hélices' },
      ],
    },
  ],
};

/** Alternative textuelle du schéma : une phrase par liaison du §2. */
export const liaisons = [
  'La radiocommande, au sol, envoie les commandes au récepteur radio en 2,4 GHz (ExpressLRS).',
  'Le récepteur radio transmet ces commandes au contrôleur de vol.',
  'Le GPS et son compas donnent la position et le cap au contrôleur de vol.',
  'Le contrôleur de vol pilote les 4 ESC par des signaux DShot.',
  'La batterie 4S alimente le module de puissance.',
  'Le module de puissance alimente les 4 ESC.',
  'Le module de puissance fournit un 5 V régulé au contrôleur de vol et lui transmet la tension et le courant mesurés.',
  'Chaque ESC fait tourner un des 4 moteurs.',
  'Chaque moteur entraîne son hélice.',
  'Plus tard, en phase 3 : le module de puissance alimentera un BEC 5 V 5 A, qui alimentera le Raspberry Pi et les caméras.',
];

export default {
  project: 'dragon',
  slug: 'architecture',
  title: 'Architecture',
  description:
    'Comment les composants de Dragon se parlent, comment il est dimensionné, et les règles qui encadrent ses vols.',
  sections: [
    {
      id: 'schema',
      title: 'Schéma des liaisons',
      source: phase1,
      blocks: [
        paragraph(
          'Le code de l’équipe n’arrive qu’en phase 3, mais chaque achat réserve dès la phase 1 la place, le poids, l’alimentation et les ports pour la suite.',
        ),
        paragraph('Les liaisons du schéma, une par une :'),
        { type: 'list', items: liaisons },
      ],
    },
    {
      id: 'niveaux',
      title: 'Deux niveaux de logiciel',
      source: source('docs/decisions/ADR-001-architecture-logicielle.md'),
      blocks: [
        paragraph(
          'Un quadricoptère n’est pas stable de lui-même : la poussée des 4 moteurs se recalcule des milliers de fois par seconde. L’architecture sépare donc deux niveaux.',
        ),
        {
          type: 'table',
          caption: 'Niveaux du logiciel de Dragon',
          columns: ['Niveau', 'Rôle', 'Fréquence', 'Matériel'],
          rows: [
            [
              'Bas niveau : stabilisation',
              'Garder le drone à plat, appliquer une consigne d’angle ou de vitesse.',
              '1 à 8 kHz, temps réel strict',
              'Contrôleur de vol (STM32)',
            ],
            [
              'Haut niveau : déplacements et missions',
              '« Monte à 5 m, avance de 10 m, suis cet objet. »',
              '1 à 50 Hz',
              'Ordinateur compagnon (Raspberry Pi) sous Linux',
            ],
          ],
        },
        paragraph(
          'Les options comparées et les risques de ce choix sont sur la page Décisions, à l’ADR-001.',
        ),
      ],
    },
    {
      id: 'dimensionnement',
      title: 'Dimensionnement',
      source: phase1,
      blocks: [
        paragraph(
          'Le drone se dimensionne de la charge vers la propulsion, en quatre étapes :',
        ),
        {
          type: 'list',
          items: [
            'Estimer le poids final, avec les capteurs et l’ordinateur compagnon des phases 3 et 4, plus 15 % de marge.',
            'Exiger une poussée totale d’au moins deux fois le poids, pour corriger le vent et manœuvrer. Un rapport de 2,5 à 3 est idéal.',
            'Choisir les hélices, les moteurs et la tension qui donnent cette poussée, d’après la fiche de poussée du fabricant.',
            'Choisir la batterie et les ESC d’après le courant que consomment ces moteurs.',
          ],
        },
        {
          type: 'table',
          caption: 'Bilan de poids prévisionnel, révisé le 2026-11-20',
          columns: ['Élément', 'Poids'],
          rows: [
            ['Cadre X500 V2 : train, rails, plateforme', '610 g, vérifié'],
            ['4 moteurs 2216 KV920', '256 g, vérifié'],
            ['4 ESC 20 A', '84 g, vérifié'],
            ['Hélices, carte de distribution, câbles', 'environ 70 g'],
            [
              'Contrôleur de vol Pixhawk 6C, module de puissance PM02, GPS, récepteur et balise',
              'environ 120 à 150 g',
            ],
            ['Batterie 4S 5 000 mAh', '430 à 550 g selon le modèle'],
            ['Sous-total de la phase 1', 'environ 1,57 à 1,72 kg'],
            [
              'Réserve des phases 3 et 4 : Raspberry Pi, BEC, caméra, capteurs',
              '150 à 300 g de plus',
            ],
            ['Poids visé au maximum', 'environ 2,0 kg'],
          ],
        },
        paragraph(
          'Avec un rapport de 2, il faut au moins 4 kg de poussée. Les 4 moteurs en donnent 4 × 1 332 g, soit 5,3 kg, d’après la fiche du fabricant vérifiée.',
        ),
        paragraph(
          'Le rapport poussée sur poids vaut donc 3,1 à 3,4 en phase 1, et environ 2,7 en phases 3 et 4 : même au poids maximal visé, la poussée reste supérieure au double du poids. C’est pourquoi 5,3 kg suffisent.',
        ),
      ],
    },
    {
      id: 'etapes',
      title: 'Étapes de réalisation',
      source: phase1,
      blocks: [
        paragraph(
          'Chaque étape se termine par une validation mesurable, avant de passer à la suivante.',
        ),
        {
          type: 'table',
          caption: 'Étapes de réalisation de la phase 1',
          columns: ['Étape', 'Action', 'Validation'],
          rows: [
            [
              '1',
              'Valider les ADR-001, 002 et 003, puis faire les démarches réglementaires.',
              'Les trois ADR sont acceptés.',
            ],
            [
              '1 bis',
              'Lancer dès maintenant la simulation ArduPilot SITL, gratuite et sans matériel : un premier script MAVLink de décollage et d’atterrissage.',
              'Le script fait décoller, avancer et poser le drone simulé.',
            ],
            [
              '2',
              'Arrêter la liste d’achat finale : disponibilité, compatibilité et fiche de poussée de chaque référence.',
              'Bilan de poids et rapport poussée sur poids d’au moins 2 recalculés avec les vraies valeurs.',
            ],
            [
              '3',
              'S’entraîner au simulateur avec la radio pendant la livraison.',
              '5 minutes de vol stationnaire sans crash en simulation.',
            ],
            [
              '4',
              'Contrôler chaque pièce à sa réception.',
              'Checklist cochée dans le journal.',
            ],
            ['5', 'Monter le châssis.', 'Vis au frein-filet, aucun jeu.'],
            [
              '6',
              'Souder la puissance : XT60, ESC, distribution.',
              'Continuité vérifiée, aucun court-circuit, passage au smoke stopper réussi.',
            ],
            [
              '7',
              'Monter le contrôleur de vol, le GPS et le récepteur.',
              'Câblage photographié et schéma dans le journal.',
            ],
            [
              '8',
              'Flasher le firmware et configurer, sans hélices.',
              'Orientation, calibrations, sens et ordre des moteurs vérifiés.',
            ],
            [
              '9',
              'Sécurité : armement, alarme batterie, failsafe radio, geofence.',
              'Failsafe déclenché en coupant la radio, sans hélices.',
            ],
            [
              '10',
              'Premier vol : 1 à 2 m de haut, mode stabilisé, espace dégagé.',
              'Le drone décolle droit, sans oscillation.',
            ],
            [
              '11',
              'Autotune et vols de validation.',
              'Critère de sortie de la phase 1 atteint, logs archivés.',
            ],
          ],
        },
      ],
    },
    {
      id: 'reglementation',
      title: 'Réglementation',
      source: phase1,
      blocks: [
        paragraph(
          'Règles relevées le 2026-11-20 dans le guide de la catégorie Ouverte de la DGAC, à relire avant le premier vol :',
        ),
        {
          type: 'list',
          items: [
            'Inscription comme exploitant sur AlphaTango, le portail de la DGAC : obligatoire pour un drone de 250 g ou plus, ou équipé d’une caméra.',
            'Examen en ligne de la catégorie Ouverte (A1/A3) : obligatoire au-dessus de 250 g. Il est gratuit, compte 40 questions, demande 75 % de bonnes réponses et vaut 5 ans. L’ancienne formation « Fox AlphaTango » ne compte plus.',
            'Enregistrement du drone et signalisation électronique : obligatoires à partir de 800 g. Dragon est concerné à coup sûr : son cadre seul pèse 610 g.',
            'Un drone construit soi-même de plus de 250 g vole en catégorie A3 uniquement : à 150 m au moins des zones habitées, commerciales, industrielles et récréatives, sans personne à proximité, à 120 m de hauteur au plus.',
            'Le télépilote est responsable de plein droit des dommages causés au sol.',
          ],
        },
      ],
    },
    {
      id: 'securite',
      title: 'Règles de sécurité',
      source: source('CLAUDE.md'),
      blocks: [
        paragraph('Elles ne se négocient pas :'),
        { type: 'list', items: securite },
      ],
    },
    {
      id: 'premier-vol',
      title: 'Avant le premier vol',
      source: source('docs/phase-1-construction/bom.md'),
      blocks: [
        {
          type: 'list',
          items: [
            'Cinq heures de simulateur, dont des atterrissages en mode stabilisé, sans GPS.',
            'Un assistant présent : il ne pilote pas, mais surveille les alentours et peut appeler les secours.',
            'Une checklist pré-vol écrite, cochée à chaque vol et gardée dans le journal.',
          ],
        },
      ],
    },
  ],
} satisfies ProjectPage;
