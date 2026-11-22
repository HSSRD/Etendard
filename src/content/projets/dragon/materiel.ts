// Matériel du projet Dragon (/projets/dragon/materiel), copie rédigée des fiches d'achat de la
// phase 1 et de leur doc globale (ADR 0016). Sans les sections « Où acheter » ni les contraintes
// personnelles ; le détail des contrôles à réception est laissé au journal.
import type {
  Cell,
  ProjectPage,
  Section,
} from '../../../lib/validate-project-pages';

/** Commit de Dragon relevé. */
const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';
/** Date de lecture des sources. */
const read = '2026-11-22';
/** Date du relevé des prix dans Dragon. */
const priced = '2026-11-20';

const source = (path: string) => ({
  path: `docs/phase-1-construction/${path}`,
  sha,
  date: read,
});

const price = (min: number, max: number) => ({
  price: { min, max, date: priced },
});

interface Fiche {
  id: string;
  title: string;
  /** Fichier de la fiche dans docs/phase-1-construction/achats/. */
  file: string;
  /** Rôle de la pièce, avant ses tableaux. */
  intro: string[];
  /** Choix retenu : quoi, pourquoi, budget relevé. */
  choices: [string, string, Cell][];
  /** Alternative écartée et sa raison. */
  alternatives: [string, string][];
  /** Points de vigilance et ce qui ferait changer d’avis, après les tableaux. */
  notes?: string[];
}

/** Section d'une fiche d'achat : légendes et colonnes de ses tableaux déduites de son titre. */
const fiche = ({
  id,
  title,
  file,
  intro,
  choices,
  alternatives,
  notes = [],
}: Fiche): Section => ({
  id,
  title,
  source: source(`achats/${file}`),
  blocks: [
    ...intro.map((text) => ({ type: 'paragraph' as const, text })),
    {
      type: 'table',
      caption: `${title} : choix retenu`,
      columns: ['Choix retenu', 'Pourquoi', 'Budget relevé'],
      rows: choices,
    },
    {
      type: 'table',
      caption: `${title} : alternatives écartées`,
      columns: ['Alternative', 'Pourquoi elle est écartée'],
      rows: alternatives,
    },
    ...notes.map((text) => ({ type: 'paragraph' as const, text })),
  ],
});

/** Les 12 fiches d'achat, dans l'ordre de Dragon. */
export const fiches: Section[] = [
  fiche({
    id: 'chassis',
    title: 'Châssis',
    file: '01-chassis.md',
    intro: [
      'Le châssis porte tout. Son empattement, la distance en diagonale entre deux moteurs, fixe la taille maximale des hélices : donc la poussée possible, et la charge qu’on pourra embarquer plus tard.',
    ],
    choices: [
      [
        'Kit ARF Holybro X500 V2 : cadre, moteurs, ESC, hélices et carte de distribution',
        'Bras en carbone, rails et plateforme pour la charge utile, train haut, propulsion assortie et documentée par PX4. Le cadre pèse 610 g : c’est le prix des rails et du train, et le rapport poussée/poids reste supérieur à 3.',
        price(350, 400),
      ],
    ],
    alternatives: [
      [
        'Cadre X500 V2 seul',
        'Libre choix de la propulsion, mais plus cher au total une fois les moteurs et les ESC ajoutés.',
      ],
      [
        'S500 générique',
        'Bien moins cher et suffisant pour voler, mais de qualité variable et sans documentation PX4 dédiée. L’économie devient faible une fois des moteurs et des ESC de marque ajoutés.',
      ],
      [
        'F450 générique',
        'Très bon marché, mais souple, donc sujet aux vibrations, et à bricoler pour porter une charge utile.',
      ],
    ],
    notes: [
      'Point de vigilance : les pièces de rechange (tubes, raccords, plaques) étaient en rupture au 2026-11-20. Un crash qui casse un raccord immobilise le drone. Parade : commander des tubes et des raccords dès leur retour, sinon des tubes en carbone de 16 mm, un format standard.',
      'Ce qui ferait changer d’avis : un kit introuvable pendant plus de quatre semaines, ou un budget nettement revu à la baisse. Alors, un S500 avec des moteurs 2216 de marque.',
    ],
  }),
  fiche({
    id: 'helices',
    title: 'Hélices',
    file: '02-helices.md',
    intro: [
      'Les hélices produisent la poussée. « 1045 » se lit 10 pouces de diamètre et 4,5 pouces de pas.',
    ],
    choices: [
      [
        'Les 6 hélices 1045 du kit, et 4 paires de rechange Holybro',
        'Le seul modèle qui garantit l’ajustement sur le moteur du kit et qui correspond à la fiche de poussée du fabricant. En apprentissage, un atterrissage raté coûte une ou deux hélices.',
        price(20, 25),
      ],
    ],
    alternatives: [
      [
        'Hélices 1045 génériques en plastique',
        'Peu chères, mais leur alésage ou leur fixation est parfois incompatible avec le moteur du kit, et leur équilibrage varie.',
      ],
      [
        'Hélices 1045 en carbone',
        'Rigides et efficaces, mais coupantes, et elles transmettent les chocs au moteur.',
      ],
      [
        'Hélices 1045 tripales',
        'Plus de poussée, mais moins efficaces et plus gourmandes en courant : les ESC de 20 A du kit sont déjà justes.',
      ],
    ],
    notes: [
      'Ce qui ferait changer d’avis : une hélice générique dont l’ajustement est vérifié sur table, moteur à l’arrêt.',
    ],
  }),
  fiche({
    id: 'moteurs',
    title: 'Moteurs',
    file: '03-moteurs.md',
    intro: [
      'Les moteurs brushless font tourner les hélices. « 2216 » donne la taille du stator : 22 mm de diamètre, 16 mm de haut. Le KV donne les tours par minute par volt, à vide.',
    ],
    choices: [
      [
        'Les 4 moteurs 2216 KV920 du kit, et un moteur de rechange',
        'Inclus et assortis au cadre et aux ESC. Fiche du fabricant vérifiée : 1 332 g de poussée à plein gaz, soit un rapport poussée/poids de 3,1 à 3,4 en phase 1. Le rechange évite d’attendre deux à trois semaines après un crash.',
        price(0, 30),
      ],
    ],
    alternatives: [
      [
        'T-Motor AIR2216 II',
        'Le même moteur, sous sa marque d’origine : plus cher, sans rien de plus.',
      ],
      [
        'Moteurs génériques A2212 1000 KV',
        'Une poussée d’environ 800 g, souvent surévaluée, et des roulements à la fiabilité aléatoire.',
      ],
      [
        'Passer en 6S',
        'Avec des hélices 1045, le moteur dépasserait sa puissance maximale, et les ESC du kit s’arrêtent au 4S.',
      ],
    ],
    notes: [
      'À confirmer : une boutique annonce ce kit avec des moteurs KV880. La version livrée est à demander au vendeur. En KV880, le rapport poussée/poids resterait supérieur à 2,5.',
      'Ce qui ferait changer d’avis : une charge utile future au-delà d’environ 800 g. Il faudrait alors des moteurs 2814 de 700 KV, des hélices de 12 pouces et un autre cadre.',
    ],
  }),
  fiche({
    id: 'batteries',
    title: 'Batteries',
    file: '04-batteries.md',
    intro: [
      'La batterie est la source d’énergie et l’élément le plus lourd. Une LiPo 4S donne 14,8 V en nominal et 16,8 V chargée.',
    ],
    choices: [
      [
        'Deux ou trois LiPo 4S de 5 000 à 5 200 mAh, de marque, en XT60, sous 480 g (par exemple Tattu 5 200 mAh 35C)',
        'Le XT60 est la prise de la carte de distribution du kit : aucune soudure de puissance à refaire. À 25C au moins, un pack couvre largement les 65 A du plein gaz. Le poids est le premier levier sur l’autonomie. Deux packs donnent environ 30 minutes de vol par sortie : c’est juste, d’où un troisième.',
        price(110, 190),
      ],
    ],
    alternatives: [
      [
        'CNHL 4S 5 000 mAh',
        'Bien moins chère, mais environ 120 g de plus, soit une minute de vol en moins, et une prise XT90 ou EC5 à remplacer.',
      ],
      ['Gens Ace 4S 5 000 mAh', 'Environ 550 g, et une prise EC5.'],
      [
        'LiPo générique sans marque',
        'Capacité et courant annoncés souvent surévalués. Une LiPo peut mettre le feu : déconseillée.',
      ],
      ['LiPo d’occasion', 'Jamais : son historique est inconnu.'],
    ],
    notes: [
      'Sécurité : jamais sous 3,5 V par cellule en vol, stockage à 3,8 V par cellule, charge dans un sac ignifuge et sous surveillance. Un pack gonflé, percé ou accidenté est retiré du service.',
      'Ce qui ferait changer d’avis : les missions longues des phases 4 et 5. Un pack Li-ion 4S2P est plus léger à énergie égale.',
    ],
  }),
  fiche({
    id: 'esc',
    title: 'ESC',
    file: '05-esc.md',
    intro: [
      'L’ESC, le contrôleur électronique de vitesse, transforme la consigne numérique du contrôleur de vol en courant triphasé pour le moteur.',
    ],
    choices: [
      [
        'Les 4 ESC BLHeli_S de 20 A du kit, flashés ensuite sous Bluejay',
        'Déjà montés sur les bras. Bluejay ajoute le DShot bidirectionnel : chaque ESC renvoie la vitesse de son moteur, et le contrôleur de vol y cale son filtre anti-vibrations. Le drone vole d’abord avec le firmware d’origine.',
        'Inclus dans le kit',
      ],
      [
        'Plan B : un ESC 4-en-1 AM32 de 55 A',
        'Si le flash échoue, ou si les ESC dépassent 80 °C juste après un vol.',
        price(44, 80),
      ],
    ],
    alternatives: [
      [
        'ESC 4-en-1 AM32 dès le départ',
        'Il faut rallonger les fils des moteurs d’environ 20 cm et refaire le câblage des bras, et une panne coupe les 4 moteurs. Gros travail pour un gain incertain avant le premier vol : gardé en plan B.',
      ],
      [
        '4 ESC individuels AM32 (Holybro Tekko32 F4 45 A)',
        'Une marge énorme, mais chers et en rupture au 2026-11-20.',
      ],
    ],
    notes: [
      'Point de vigilance : la marge de courant est juste. 20 A pour un moteur qui tire 16,4 A à plein gaz, c’est 1,22 fois, sous la règle de 1,3. Accepté : en vol stationnaire, un moteur tire environ 3,6 A, et l’ESC tient 30 A pendant 10 secondes. La température est surveillée. Le flash Bluejay sur ces ESC reste à confirmer.',
      'Ce qui ferait changer d’avis : un flash qui échoue, ou des ESC au-delà de 80 °C. Alors, le 4-en-1 AM32.',
    ],
  }),
  fiche({
    id: 'puissance-bec',
    title: 'Puissance et BEC',
    file: '06-puissance-bec.md',
    intro: [
      'Trois fonctions : distribuer le courant vers les 4 ESC, mesurer la tension et le courant pour le failsafe batterie et le retour au point de départ, et fournir un 5 V propre au contrôleur de vol. En phase 3, un BEC fournira aussi le 5 V du Raspberry Pi et des caméras.',
    ],
    choices: [
      [
        'Module de puissance PM02 V3, vendu avec le Pixhawk 6C, et la carte de distribution du kit',
        'Connecteur dédié, déjà calibré. Le PM02 n’est pas dans la boîte de base du Pixhawk 6C : il faut la version « avec PM02 ».',
        'Compris dans le budget du contrôleur de vol',
      ],
      [
        'En phase 3 : un BEC 5 V 5 A',
        'L’achat attend la phase 3, quand la consommation réelle du Raspberry Pi et des caméras sera connue. Un emplacement est réservé sur la plateforme.',
        price(10, 25),
      ],
    ],
    alternatives: [
      [
        'PM06 V2, carte de distribution intégrée',
        'Ferait doublon avec la carte de distribution du kit.',
      ],
      [
        'BEC acheté tout de suite',
        'Le bon modèle dépend des besoins de la phase 3, et ces BEC sont toujours en stock.',
      ],
      [
        'Le 5 V du contrôleur de vol pour le Raspberry Pi',
        'Le PM02 fournit 3 A au contrôleur et à ses périphériques ; un Pi 5 peut tirer de 3 à 5 A. Une chute de tension redémarre le contrôleur, et le drone tombe.',
      ],
    ],
    notes: [
      'Point de vigilance : à plein gaz, les 4 moteurs tirent environ 65 A, alors que les fils fournis avec le PM02 tiennent 30 A en continu et 60 A en pointe. En pratique, le plein gaz ne dure que quelques secondes. Parade : limiter les gaz maximum, par exemple à 85 %, ou refaire les fils en 10 AWG. En phase 1, les fils d’origine restent, et leur température est contrôlée après les vols les plus durs.',
    ],
  }),
  fiche({
    id: 'controleur-de-vol',
    title: 'Contrôleur de vol',
    file: '07-controleur-de-vol.md',
    intro: [
      'Le contrôleur de vol lit les capteurs, stabilise le drone des milliers de fois par seconde, exécute les modes de vol et parle MAVLink avec la station sol, puis avec l’ordinateur compagnon de la phase 3. C’est aussi la cible du firmware maison de la phase 6.',
    ],
    choices: [
      [
        'Pixhawk 6C, boîtier plastique, version avec le module de puissance PM02 V3',
        'Processeur STM32H743, supporté officiellement par ArduPilot et par PX4. Cinq ports série utiles : GPS, récepteur, ordinateur compagnon, et de la marge. Deux centrales inertielles isolées, des connecteurs normalisés, aucune soudure fine, et le standard Pixhawk ouvert, utile pour la phase 6. Le prix livré en France reste à confirmer.',
        price(230, 260),
      ],
    ],
    alternatives: [
      [
        'Matek H743-SLIM',
        'L’option économique de la première version des fiches a disparu : la carte est arrêtée (V3 et V4), et Matek signale des contrefaçons.',
      ],
      [
        'Carte H743 de drone FPV supportée par ArduPilot',
        'L’alternative crédible, bien moins chère, mais avec des soudures fines et un support PX4 plus incertain.',
      ],
      [
        'Pixhawk 6C Mini',
        'Un peu moins cher, mais sans port TELEM3 : une fois le GPS, le récepteur et l’ordinateur compagnon branchés, il ne reste qu’un port libre.',
      ],
      [
        'PX4 Dev Kit',
        'Presque aucune économie, et une télémétrie en 915 MHz, illégale en France.',
      ],
      ['Cube Orange+', 'Surdimensionné pour ce drone.'],
    ],
    notes: [
      'Firmware : le Pixhawk 6C arrive sans firmware imposé. Le penchant va à ArduPilot : DShot sur toutes les sorties, simulation SITL simple, et des scripts Lua qui tournent sur le contrôleur, une première façon d’écrire le code de l’équipe dès la phase 1.',
      'Ce qui ferait changer d’avis : un budget nettement revu à la baisse. Alors, une carte H7 de drone FPV et un câblage soudé.',
    ],
  }),
  fiche({
    id: 'radiocommande',
    title: 'Radiocommande et récepteur',
    file: '08-radiocommande.md',
    intro: [
      'La radiocommande sert au pilotage manuel, et surtout à la sécurité : armement, arrêt d’urgence, changement de mode, reprise en main quand le code de l’équipe se trompe. Elle sert aussi de manette pour les simulateurs.',
    ],
    choices: [
      [
        'Radiomaster Pocket ELRS, ou Boxer ELRS, en version EU/LBT, et récepteur Radiomaster RP4TD',
        'Protocole ExpressLRS ouvert, lu nativement par ArduPilot et PX4, et firmware EdgeTX. Assez d’interrupteurs pour séparer armement, modes de vol, arrêt d’urgence et retour au point de départ. Le RP4TD a deux puces radio : une vraie diversité. Puissance réglée à 100 mW au plus, la limite légale à 2,4 GHz. Deux accus 18650 sont à prévoir en plus.',
        price(105, 215),
      ],
    ],
    alternatives: [
      [
        'Radiomaster TX16S Mk3',
        'Bi-bande, manches à effet Hall, grand écran : défendable à long terme, mais plus lourde et plus chère. Sa bande 900 MHz ne sert à rien en France.',
      ],
      [
        'Récepteur Radiomaster RP3',
        'Une seule puce radio : deux antennes, mais pas de vraie diversité.',
      ],
      [
        'Radios FrSky, Spektrum, Flysky ou DJI',
        'Protocoles fermés et récepteurs chers.',
      ],
      [
        'ExpressLRS à 1 W',
        'Illégal en France, et 100 mW suffisent largement en vol à vue.',
      ],
      [
        'Télémétrie SiK séparée',
        'Inutile avant l’ordinateur compagnon de la phase 3, et illégale en 915 MHz.',
      ],
    ],
    notes: [
      'Ce qui ferait changer d’avis : le budget. La Pocket a des manches plus petits, moins précis en vol stationnaire ; la Boxer est plus confortable. Une radio d’occasion est l’achat d’occasion le plus pertinent du projet, si elle est en ExpressLRS 2,4 GHz et repassée en domaine européen.',
    ],
  }),
  fiche({
    id: 'gps',
    title: 'GPS et compas',
    file: '09-gps.md',
    intro: [
      'Le GPS donne la position : maintien de position, retour au point de départ, missions par points de passage. Le compas donne le cap ; il est monté en hauteur, loin des câbles de puissance.',
    ],
    choices: [
      [
        'Holybro M10, compas IST8310, connecteur 10 broches, sur un mât',
        'Connecteur standard Pixhawk. L’IST8310 marche partout, alors que PX4 ne gère l’IST8308 sur le Pixhawk 6C qu’à partir de sa version 1.16. Pour voler, le GPS n’est pas nécessaire ; pour la sécurité d’un débutant, si : maintien de position et retour automatique. Le mât fourni avec le kit reste à confirmer.',
        price(45, 55),
      ],
    ],
    alternatives: [
      [
        'Holybro Micro M10',
        'Moins cher, mais une antenne plus petite, un fix plus lent, ni bouton de sécurité ni buzzer : une économie qui dégrade la sécurité.',
      ],
      ['Matek M10Q-5883', 'En fin de vie, sans stock ni remplaçant.'],
      [
        'GPS « M10 » générique',
        'Beaucoup sont des copies, au compas mal orienté ou absent : le drone tourne alors en spirale en maintien de position.',
      ],
      [
        'Deux GPS redondants',
        'Utile pour les missions lointaines des phases 4 et 5, pas en phase 1.',
      ],
    ],
  }),
  fiche({
    id: 'chargeur',
    title: 'Chargeur LiPo',
    file: '10-chargeur.md',
    intro: [
      'Le chargeur charge en équilibrant les cellules, met les packs en tension de stockage et mesure leur résistance interne. Charger un pack 4S de 5 000 mAh à 1C demande environ 84 W.',
    ],
    choices: [
      [
        'ToolkitRC M6AC, et un grand sac ignifuge',
        '100 W sur secteur : un pack chargé à 1C en une heure environ, et la mesure de la résistance interne. La puissance annoncée d’un chargeur est souvent celle sur alimentation externe, bien plus haute que sur secteur. Le sac contient deux ou trois packs : la taille S est trop petite.',
        price(85, 95),
      ],
    ],
    alternatives: [
      [
        'ToolkitRC M8AC',
        '200 W sur secteur, mais une seule sortie : plus cher, sans vrai gain en phase 1.',
      ],
      [
        'ISDT 608AC',
        '50 W seulement sur secteur, soit environ 1 h 40 par pack, sauf à ajouter une alimentation 24 V.',
      ],
      [
        'ISDT Q6 Nano, SkyRC B6 Neo',
        'Aucune charge sur secteur : il faut une alimentation externe.',
      ],
      [
        'Clone de B6 sans marque',
        'C’est l’appareil qui manipule l’énergie des packs à la maison : non.',
      ],
    ],
    notes: [
      'Règles de charge : 1C par défaut, toujours en mode équilibré, jamais sans surveillance, jamais une batterie encore chaude.',
    ],
  }),
  fiche({
    id: 'signalisation',
    title: 'Signalisation électronique',
    file: '11-signalisation-electronique.md',
    intro: [
      'Une obligation réglementaire : à partir de 800 g, le drone émet en Wi-Fi son identifiant, sa position, son point de décollage, sa vitesse et sa route. Le cadre seul pèse 610 g : rester sous 800 g est impossible.',
      'La balise est obligatoire hors terrain de club publié à l’AIP, le recueil officiel de l’aviation civile.',
    ],
    choices: [
      [
        'Une balise au format français : Dronavia Beacon AM, ou une balise maison sur ESP32',
        'La Beacon AM annonce le format de l’arrêté du 27 décembre 2019 ; la confirmation écrite du vendeur reste à obtenir. Une balise maison est légale pour un usage personnel, avec le code constructeur « 000 » (note DSAC 21-001) : un projet pédagogique, en secours.',
        price(10, 40),
      ],
    ],
    alternatives: [
      [
        'Module Remote ID européen piloté par le Pixhawk',
        'Il émet le format européen, pas le format français, et rien n’établit qu’il soit accepté à sa place.',
      ],
      [
        'Dronavia Fly ID Light, Holybro Remote ID',
        'Ils n’annoncent que le format européen : rien ne dit qu’ils couvrent le format français.',
      ],
      [
        'ArduRemoteID, modules OpenDroneID',
        'Formats américain ou européen par défaut : il faudrait un firmware au format français.',
      ],
    ],
    notes: [
      'Ce qui ferait changer d’avis : une fusion des formats européen et français. Les autorités y travaillent, mais rien n’est acté au 2026-11-20.',
    ],
  }),
  fiche({
    id: 'outillage',
    title: 'Outillage et consommables',
    file: '12-outillage.md',
    intro: [
      'Monter, souder, mesurer et réparer en sécurité. Le kit réduit les soudures sans les supprimer : le récepteur sur le câble du Pixhawk, peut-être les fils des moteurs, et les réparations après un crash.',
    ],
    choices: [
      [
        'Un fer de 65 W réels au moins (Pinecil V2 sur alimentation 24 V, ou station de 80 W), un smoke stopper XT60, un multimètre, de l’étain, du flux, des outils et des consommables',
        'Le smoke stopper est un fusible réarmable : il protège la première mise sous tension, pour presque rien. Un XT60 d’essai sur du fil 12 AWG précède les soudures du drone : c’est la soudure la plus difficile du projet, et une soudure froide se paie en vol.',
        price(120, 180),
      ],
    ],
    alternatives: [
      [
        'Pinecil V2 sur un chargeur de téléphone',
        'De 20 à 30 W : il chauffe mal, et la soudure est froide. Un chargeur USB-C PD de 65 W est juste ; une alimentation 24 V donne de 72 à 92 W.',
      ],
      [
        'Étain d’occasion',
        'Qualité inconnue. La station, le multimètre et la troisième main, eux, s’achètent bien d’occasion.',
      ],
    ],
  }),
];

export default {
  project: 'dragon',
  slug: 'materiel',
  title: 'Matériel',
  description:
    'Les douze achats de la phase 1 de Dragon : le rôle de chaque pièce, le choix retenu, les alternatives écartées et le budget relevé.',
  sections: [
    {
      id: 'achats',
      title: 'Les achats de la phase 1',
      source: source('README.md'),
      blocks: [
        {
          type: 'paragraph',
          text: 'La phase 1 doit faire voler le drone en manuel. Elle compte douze achats, choisis dans l’ordre : chacun dépend du précédent. Chaque achat réserve aussi la place, le poids, l’alimentation et les ports des phases suivantes.',
        },
        {
          type: 'paragraph',
          text: 'Les prix sont des relevés datés, à revérifier avant chaque commande. Chaque pièce est contrôlée à réception, et le contrôle est noté au journal de bord.',
        },
        {
          type: 'paragraph',
          text: 'Où ne pas économiser : les batteries (jamais d’occasion, jamais sans marque), le chargeur, le smoke stopper, le GPS (pas de copie) et le contrôleur de vol (pas de contrefaçon). La radio, le chargeur et l’outillage, eux, peuvent s’acheter d’occasion.',
        },
      ],
    },
    ...fiches,
    {
      id: 'compatibilite',
      title: 'Matrice de compatibilité',
      source: source('README.md'),
      blocks: [
        {
          type: 'paragraph',
          text: 'Ce qui doit concorder d’une fiche à l’autre avant de commander.',
        },
        {
          type: 'table',
          caption: 'Contraintes de compatibilité entre les achats',
          columns: ['Contrainte', 'Fiches concernées'],
          rows: [
            [
              'Diamètre des hélices inférieur ou égal au maximum du châssis',
              'Châssis, Hélices',
            ],
            [
              'KV des moteurs, tension de la batterie et hélices donnent la poussée et le courant, d’après la fiche du fabricant',
              'Hélices, Moteurs, Batteries',
            ],
            ['Entraxe de fixation des moteurs', 'Châssis, Moteurs'],
            [
              'Courant des ESC d’au moins 1,3 fois le courant maximum des moteurs, et ESC qui tiennent le 4S',
              'Moteurs, Batteries, ESC',
            ],
            [
              'Courant maximum du module de puissance au moins égal au courant total',
              'ESC, Puissance et BEC',
            ],
            [
              'Même connecteur de batterie partout : XT60',
              'Batteries, Puissance et BEC, Chargeur LiPo',
            ],
            [
              'Ports série du contrôleur de vol : GPS, récepteur, et un port libre pour la phase 3',
              'Contrôleur de vol, Radiocommande et récepteur, GPS et compas',
            ],
            [
              'Protocole du récepteur (CRSF) lu par le contrôleur de vol',
              'Contrôleur de vol, Radiocommande et récepteur',
            ],
            [
              'Connecteurs : JST-GH du Pixhawk, ou soudure',
              'Puissance et BEC, Contrôleur de vol, GPS et compas',
            ],
          ],
        },
      ],
    },
  ],
} satisfies ProjectPage;
