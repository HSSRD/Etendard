// Décisions du projet Dragon (/projets/dragon/decisions), copie rédigée de ses ADR et du challenge
// de la phase 1 (ADR 0016). Sans le §2.6 du challenge (club), ni l'encadré écrit après les
// réponses (contraintes personnelles), ni aucun prix ou lien marchand.
import type { ProjectPage, Table } from '../../../lib/validate-project-pages';

/** Commit de Dragon relevé. */
const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';
/** Date de lecture des sources. */
const read = '2026-11-22';

const source = (path: string) => ({ path: `docs/${path}`, sha, date: read });

/** Tableau des options écartées d'un ADR. */
const rejected = (adr: string, rows: [string, string][]): Table => ({
  type: 'table',
  caption: `${adr} : options écartées`,
  columns: ['Option écartée', 'Pourquoi'],
  rows,
});

/** Tableau des risques d'un ADR. */
const risks = (adr: string, rows: [string, string][]): Table => ({
  type: 'table',
  caption: `${adr} : risques`,
  columns: ['Risque', 'Réponse'],
  rows,
});

/** Les 14 erreurs factuelles de la première version des fiches (§1 du challenge). */
export const erreurs: Table = {
  type: 'table',
  caption: 'Les 14 erreurs corrigées',
  columns: ['La première version disait', 'La réalité vérifiée', 'Impact'],
  rows: [
    [
      'Cadre X500 V2 : environ 400 g',
      '610 g, d’après Holybro et un revendeur.',
      'Le drone pèse environ 200 g de plus que prévu : le bilan de poids est refait.',
    ],
    [
      'Moteur 2216 KV920 : environ 1 000 g de poussée maximale',
      '1 332 g à 16,4 A, d’après la fiche du fabricant. Les 1 000 g correspondent à 80 % des gaz.',
      'Bonne nouvelle : le rapport poussée/poids est meilleur.',
    ],
    [
      'Acheter le cadre, les moteurs et les ESC séparément',
      'Le kit ARF contient exactement ces pièces, pour moins cher.',
      'Voir l’ADR-003.',
    ],
    [
      'ESC AM32 individuels de 30 à 40 A, faciles à trouver',
      'Quasi introuvables : les modèles de 45 A sont chers et en rupture.',
      'Les ESC de 20 A du kit sont gardés.',
    ],
    [
      'Pixhawk 6C livré avec son module de puissance PM02 et ses câbles',
      'Le PM02 n’est pas dans la boîte de base : il existe une version vendue avec.',
      'Prendre la version avec PM02.',
    ],
    [
      'Option économique : le contrôleur de vol Matek H743-SLIM',
      'Arrêté, en version 3 comme en version 4. Matek met en garde contre les contrefaçons.',
      'L’option économique disparaît.',
    ],
    [
      'GPS économique : le Matek M10Q-5883',
      'En fin de vie, plus de stock.',
      'Le Holybro M10 est le seul choix retenu.',
    ],
    [
      'Chargeur ToolkitRC de 100 à 150 W sur secteur',
      'Le M6AC donne 100 W sur secteur et 300 W en courant continu. L’ISDT 608AC, seulement 50 W sur secteur.',
      'M6AC confirmé, 608AC écarté.',
    ],
    [
      'Récepteur « diversity » RP3',
      'Le RP3 a une seule puce radio pour deux antennes : pas de vraie diversité (à confirmer). La vraie diversité, c’est le RP4TD.',
      'RP4TD retenu.',
    ],
    [
      'Batterie 4S 5 000 mAh en XT60, facile à trouver',
      'Beaucoup de packs sont vendus en XT90 ou en EC5 (à confirmer).',
      'Vérifier la prise, ou prévoir de la changer.',
    ],
    [
      'Signalement électronique : le Remote ID d’ArduPilot suffit, et une balise faite maison est à éviter',
      'Un module Remote ID européen n’émet pas forcément le format français. La balise faite maison est autorisée, avec le code constructeur prévu pour ce cas (note DSAC 21-001).',
      'Fiche de la balise réécrite.',
    ],
    [
      'Formation « A1/A3 »',
      'Correct, mais l’ancienne formation en ligne n’est plus valable, et un drone fait maison de plus de 250 g vole uniquement en catégorie A3.',
      'Doc globale précisée.',
    ],
    [
      'Radio ELRS, sans mention de puissance',
      'En France, la limite est de 100 mW PIRE à 2,4 GHz. Le mode ELRS « EU_CE_2400 » ajoute l’écoute avant émission (LBT), mais ne plafonne pas la puissance.',
      'Régler la puissance à 100 mW au plus, et ne pas flasher de firmware FCC.',
    ],
    [
      'Télémétrie SiK possible (implicite)',
      'La version 915 MHz, celle en stock chez Holybro, est illégale en France.',
      'Ne pas acheter le PX4 Development Kit en 915 MHz.',
    ],
  ],
};

/** Les choix remis en cause et leur verdict (§2 du challenge, sans le §2.6). */
export const choix: Table = {
  type: 'table',
  caption: 'Les choix remis en cause et leur verdict',
  columns: ['Choix remis en cause', 'L’attaque', 'Le verdict'],
  rows: [
    [
      'Un drone de 1,7 kg comme premier drone ?',
      'Dangereux, car une hélice de 10 pouces à pleine vitesse coupe la chair, et cher à crasher. Les pilotes FPV conseillent de commencer par un tiny whoop d’environ 30 g.',
      'Le 500 mm est gardé : le but n’est pas la voltige, le maintien de position par GPS le rend plus facile à piloter, et les phases 3 à 5 imposent sa taille. Deux conditions durcies : 5 heures de simulateur au moins, dont des atterrissages en mode stabilisé, sans GPS ; les premiers vols en maintien de position (Loiter), à 15 m de soi au moins. Un tiny whoop reste l’alternative si le simulateur révèle des difficultés.',
    ],
    [
      'Pourquoi ne pas commencer par la simulation (phase 2) ?',
      'Le simulateur ArduPilot SITL est gratuit et ne demande aucun achat : le code de déplacement peut s’écrire tout de suite, pendant les semaines de livraison.',
      'Retenu : la simulation (SITL et MAVLink) démarre en parallèle de la phase 1. C’est aussi un test de motivation avant d’engager l’essentiel du budget.',
    ],
    [
      'Le Pixhawk 6C est-il vraiment nécessaire ?',
      'Des cartes H7 FPV, bien moins chères, font aussi tourner ArduPilot.',
      'Pixhawk 6C maintenu : pas de soudure fine, capteurs isolés des vibrations, connecteurs normalisés, cinq ports série, documentation PX4 et ArduPilot écrite pour lui, et l’alternative économique de Matek est arrêtée. Alternative crédible : une carte H743 FPV supportée officiellement par ArduPilot, si le budget prime et que la soudure ne fait pas peur. Le 6C Mini, qui perd un port série, est déconseillé.',
    ],
    [
      'Radio : Boxer ou Pocket ?',
      'Pas de voltige : il faut quatre interrupteurs (armement, modes de vol à trois positions, arrêt d’urgence, retour au point de départ). La Pocket en a moins ; combien exactement reste à confirmer.',
      'La Boxer si le budget le permet, sinon la Pocket : ses manches sont petits, et une radio se garde dix ans pour tous les drones suivants. L’occasion est pertinente pour une radio, qui s’use peu, à condition qu’elle soit en ELRS 2,4 GHz.',
    ],
    [
      'Deux batteries suffisent-elles ?',
      'Environ 14 minutes de vol et une heure de recharge par pack : deux batteries donnent environ 30 minutes de vol par sortie. C’est peu pour un réglage automatique (autotune) et des essais.',
      'Trois batteries recommandées, ou deux au début et une troisième après les premiers vols, quand la consommation réelle sera connue.',
    ],
    [
      'Holybro en direct ou revendeur français ?',
      'Les prix de Holybro sont en dollars hors taxes, sans la TVA, le port ni la douane. Un revendeur français affiche parfois des stocks contradictoires.',
      'Appeler ou écrire au revendeur avant d’acheter, et comparer avec d’autres revendeurs, y compris au Royaume-Uni en comptant la douane.',
    ],
    [
      'Que ne jamais acheter d’occasion ni sur une place de marché anonyme ?',
      'Certaines pièces sont des organes de sécurité, d’autres sont contrefaites.',
      'Jamais d’occasion ni sans marque : les batteries LiPo (historique inconnu, risque d’incendie), le smoke stopper et le chargeur, le contrôleur de vol Matek vendu sur une place de marché (contrefaçons signalées), une balise sans mention explicite du format français. Bien d’occasion : la radio, un chargeur de marque, l’outillage et le fer à souder.',
    ],
  ],
};

export default {
  project: 'dragon',
  slug: 'decisions',
  title: 'Décisions',
  description:
    'Les trois décisions d’architecture de Dragon, encore proposées, et le challenge du 2026-11-20 : les erreurs corrigées et les choix remis en cause.',
  sections: [
    {
      id: 'adr-001',
      title: 'ADR-001 : architecture logicielle',
      status: 'propose',
      source: source('decisions/ADR-001-architecture-logicielle.md'),
      blocks: [
        { type: 'paragraph', text: 'Date : 2026-11-20.' },
        {
          type: 'paragraph',
          text: 'La question : où vit le code écrit pour Dragon ? Un quadricoptère n’est pas stable de lui-même. Il faut recalculer la poussée des quatre moteurs 1 000 à 8 000 fois par seconde, à partir du gyroscope. Ce travail en temps réel revient au contrôleur de vol, un microcontrôleur STM32 sans système d’exploitation. Les déplacements et les missions, eux, tournent 1 à 50 fois par seconde sur un ordinateur compagnon sous Linux.',
        },
        {
          type: 'paragraph',
          text: 'Décision proposée : un firmware ouvert et éprouvé, ArduPilot ou PX4, sur le contrôleur de vol, et le code de Dragon sur un ordinateur compagnon sous un Linux minimal, qui pilote les déplacements par MAVLink. Un firmware de vol maison reste possible en phase 6, sur le même matériel : le contrôleur de vol de la phase 1 doit donc pouvoir être reflashé (STM32H7 documenté, flash par USB).',
        },
        rejected('ADR-001', [
          [
            'Coder tout le firmware de vol soi-même dès le départ',
            'L’apprentissage est maximal, mais il faut des mois avant le premier vol, le risque de casse est élevé, et le débogage est très difficile sans référence qui marche.',
          ],
          [
            'Firmware FPV (Betaflight)',
            'Pensé pour le pilotage manuel acrobatique : pas de GPS sérieux, pas de mode autonome.',
          ],
        ]),
        risks('ADR-001', [
          [
            'La stabilisation n’est pas codée au début.',
            'Assumé : elle reste possible en phase 6, une fois le drone en vol, avec un simulateur et un banc de test.',
          ],
          [
            'Le code de Dragon n’arriverait qu’en phase 3 : trop tard.',
            'Évitable : le simulateur ArduPilot SITL pilote un drone simulé en MAVLink dès maintenant, et les scripts Lua tournent sur le contrôleur de vol dès la phase 1. La simulation (phase 2) démarre en parallèle de la phase 1.',
          ],
          [
            'Un firmware maison demande des mois de travail, et un drone de 2 kg aux hélices de 10 pouces est le pire banc d’essai pour un code de stabilisation encore bogué.',
            'Faire la phase 6 sur un petit drone dédié (Crazyflie, ESP-Drone), pas sur Dragon, sauf si un banc de test sécurisé devient disponible : drone attaché sur un cardan.',
          ],
        ]),
        {
          type: 'paragraph',
          text: 'Point ouvert : ArduPilot ou PX4, à trancher en phase 2. Le penchant va à ArduPilot : DShot sur toutes les sorties du Pixhawk 6C, scripts Lua, simulateur plus simple, outils sol plus complets. Le matériel est le même : un reflash de dix minutes suffit à changer d’avis.',
        },
        {
          type: 'paragraph',
          text: 'Ce qui ferait changer d’avis : si le but premier devenait d’apprendre l’automatique et l’embarqué plutôt que d’avoir un drone utile, commencer en parallèle par un petit drone de développement au code de vol entièrement lisible.',
        },
      ],
    },
    {
      id: 'adr-002',
      title: 'ADR-002 : format du châssis',
      status: 'propose',
      source: source('decisions/ADR-002-format-chassis.md'),
      blocks: [
        { type: 'paragraph', text: 'Date : 2026-11-20.' },
        {
          type: 'paragraph',
          text: 'Le drone doit d’abord voler, puis embarquer un ordinateur compagnon, des caméras et des capteurs (phases 3 à 5). La taille du châssis conditionne le reste : moteurs, hélices, batterie, poids et réglementation.',
        },
        {
          type: 'paragraph',
          text: 'Décision proposée : un châssis d’environ 500 mm, de type Holybro X500 V2. C’est une plateforme de développement standard : beaucoup de documentation, de la place pour la suite, et des tutoriels qui correspondent à cet usage. L’ADR-002 prévoyait le cadre seul ; l’ADR-003 le remplace par le kit ARF du même châssis.',
        },
        rejected('ADR-002', [
          [
            '5 pouces FPV (environ 220 mm)',
            'Très serré pour un Raspberry Pi, des caméras et des capteurs, nerveux en vol stationnaire, 4 à 6 minutes d’autonomie, et un écosystème marginal pour le vol autonome.',
          ],
          [
            '7 pouces longue portée (environ 300 mm)',
            'Plus robuste et plus léger, environ 1 kg, mais sans plateforme de charge utile, avec peu de documentation ArduPilot pour l’autonomie et une électronique FPV moins standard. Écarté pour l’instant.',
          ],
          [
            'Micro-drone de moins de 250 g',
            'Une réglementation plus simple, mais l’emport de capteurs devient quasi impossible.',
          ],
        ]),
        risks('ADR-002', [
          [
            'Poids sous-estimé : le cadre pèse 610 g, pas environ 400 g. Le drone pèse 1,6 à 1,7 kg en phase 1, environ 2 kg avec la charge des phases 3 et 4.',
            'Compensé par une poussée réelle plus forte que prévu, 1 332 g par moteur : le rapport poussée/poids reste supérieur à 3.',
          ],
          [
            'Au-delà de 800 g, la réglementation française impose l’enregistrement du drone et un signalement électronique.',
            'Assumé : les capteurs des phases suivantes l’imposeraient de toute façon.',
          ],
          [
            'Un premier drone de 1,7 kg : une hélice de 10 pouces à plein régime blesse gravement, et un crash coûte des hélices, un bras, parfois un moteur.',
            'Maintenu : le maintien de position par GPS et un objectif non acrobatique le rendent pilotable. Conditions : 5 heures de simulateur, premiers vols sur un terrain dégagé, jamais à moins de 15 m de soi pendant les essais.',
          ],
          [
            'Casse en apprentissage, alors que les bras, raccords et plaques de rechange étaient en rupture au 2026-11-20.',
            'Prévoir des hélices et un ou deux bras de rechange, à prendre dès leur retour en stock.',
          ],
        ]),
        {
          type: 'paragraph',
          text: 'Ce qui ferait changer d’avis : un budget serré ou l’envie de piloter en FPV mèneraient au 7 pouces, en compromis.',
        },
      ],
    },
    {
      id: 'adr-003',
      title: 'ADR-003 : kit ARF plutôt que pièce par pièce',
      status: 'propose',
      source: source('decisions/ADR-003-kit-arf-vs-piece-par-piece.md'),
      blocks: [
        { type: 'paragraph', text: 'Date : 2026-11-20.' },
        {
          type: 'paragraph',
          text: 'La première version des fiches recommandait le cadre X500 V2 seul, puis des moteurs 2216 KV920 et des ESC AM32 individuels de 35 à 40 A achetés à part.',
        },
        {
          type: 'paragraph',
          text: 'La vérification du 2026-11-20 a montré trois choses. Holybro vend un kit ARF (Almost Ready to Fly, presque prêt à voler) qui contient exactement ces moteurs, des ESC de 20 A déjà montés sur les bras, six hélices 1045 et une carte de distribution. Pièce par pièce, c’est plus cher. Et les ESC AM32 individuels de 30 à 45 A sont rares en 2026 : BLHeli_32 n’est plus développé depuis juin 2024, et les bons modèles AM32 sont chers et souvent en rupture.',
        },
        {
          type: 'paragraph',
          text: 'Décision proposée : le kit ARF X500 V2. Ses quatre moteurs 2216 KV920 sont des T-Motor AIR2216 II sous la marque Holybro, ses quatre ESC BLHeli_S de 20 A sont montés, avec six hélices 1045 et une carte de distribution en XT60. La propulsion est déjà dimensionnée et testée par le fabricant, il y a moins de soudures, et les pièces de rechange sont au catalogue. Le contrôleur de vol Pixhawk 6C et son module de puissance PM02, le GPS M10 et le récepteur ELRS s’achètent à part.',
        },
        rejected('ADR-003', [
          [
            'Cadre seul, puis moteurs, ESC, hélices et carte de distribution achetés à part',
            'Le libre choix de chaque pièce, mais plus cher, avec plus de soudures et un risque d’incompatibilité.',
          ],
          [
            'PX4 Development Kit X500 V2 : kit ARF, Pixhawk 6C, PM02, GPS M10 et télémétrie',
            'Tout-en-un et livré flashé PX4, mais l’économie est faible face au kit ARF et aux mêmes pièces achetées à part. Et sa télémétrie en 915 MHz est illégale en France ; la version 433 MHz était en rupture.',
          ],
        ]),
        risks('ADR-003', [
          [
            'Des ESC de 20 A pour des moteurs qui tirent 16,4 A à plein gaz : une marge de 1,22 au lieu du 1,3 de la règle du projet.',
            'Assumé : le pic de 30 A pendant 10 secondes couvre les à-coups, et le vol stationnaire tire environ 4 A par moteur. La température des ESC est vérifiée après les premiers vols ; au-delà de 80 °C, passage à un ESC 4-en-1 AM32 de 55 A.',
          ],
          [
            'Filtrage RPM : les ESC ne sont pas livrés sous Bluejay, et leur flash n’est confirmé par aucune source.',
            'À confirmer. Sans ce flash, le drone vole quand même, avec un filtrage des vibrations moins bon.',
          ],
          [
            'Stock : le kit et ses pièces de rechange (tubes de bras, raccords, plaques) étaient en rupture chez certains vendeurs au 2026-11-20.',
            'Prendre un ou deux bras de rechange dès qu’ils sont disponibles.',
          ],
          [
            'Achat direct chez Holybro, hors de l’Union européenne : les prix sont en dollars hors taxes.',
            'Ajouter le port, la TVA de 20 % et parfois des frais de dédouanement avant de comparer.',
          ],
        ]),
        {
          type: 'paragraph',
          text: 'Ce qui ferait changer d’avis : un kit introuvable en Europe pendant plus de quatre semaines (alors, le cadre seul ou un châssis équivalent), ou une charge utile de plus de 800 g en phase 3 (alors, des moteurs 2814 de 700 KV et des hélices de 12 pouces).',
        },
        {
          type: 'paragraph',
          text: 'Retour en arrière : les moteurs et les ESC du kit se démontent, et le cadre accepte n’importe quelle propulsion en fixation de 16 × 16 ou 19 × 19 mm.',
        },
      ],
    },
    {
      id: 'erreurs',
      title: 'Challenge : les erreurs corrigées',
      source: source('phase-1-construction/challenge-2026-11-20.md'),
      blocks: [
        {
          type: 'paragraph',
          text: 'Le 2026-11-20, une revue a attaqué la première version des fiches d’achat. Elle a vérifié chaque affirmation sur les pages des fabricants, les guides de la DGAC et les documents de l’Arcep.',
        },
        erreurs,
      ],
    },
    {
      id: 'choix',
      title: 'Challenge : les choix remis en cause',
      source: source('phase-1-construction/challenge-2026-11-20.md'),
      blocks: [
        {
          type: 'paragraph',
          text: 'La même revue a remis en cause les grands choix de la phase 1 : pour chacun, l’attaque, puis le verdict.',
        },
        choix,
      ],
    },
  ],
} satisfies ProjectPage;
