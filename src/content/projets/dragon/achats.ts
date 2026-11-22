// Achats et budget du projet Dragon (/projets/dragon/achats), copie rédigée de son ordre d'achat
// (ADR 0016). Sans les hypothèses personnelles, les boutiques, les liens marchands, le détail du
// terrain et de l'assurance, ni rien de bom.md et de commandes/ hormis la date de la première commande.
import type {
  Block,
  ProjectPage,
  Section,
} from '../../../lib/validate-project-pages';

/** Commit de Dragon relevé. */
const sha = '3afc561a33cdb9241e380040d74ab37cdd1d8f1f';
/** Date de lecture des sources. */
const read = '2026-11-22';
/** Date de la prévision de budget dans Dragon. */
const planned = '2026-11-20';

const source = (file: string) => ({
  path: `docs/phase-1-construction/${file}`,
  sha,
  date: read,
});

const budget = (min: number, max = min) => ({
  budget: { min, max, date: planned },
});

interface Vague {
  id: string;
  title: string;
  /** Contenu de la vague, avant la raison de son moment. */
  content: Block[];
  /** Pourquoi la vague vient à ce moment. */
  why: string[];
  /** Introduction de la liste des conditions. */
  next: string;
  conditions: string[];
}

/** Section d'une vague : son contenu, la raison de son moment, puis ses conditions en liste. */
const vague = ({
  content,
  why,
  next,
  conditions,
  ...heading
}: Vague): Section => ({
  ...heading,
  source: source('ordre-achat.md'),
  blocks: [
    ...content,
    { type: 'paragraph', text: 'Pourquoi à ce moment :' },
    { type: 'list', items: why },
    { type: 'paragraph', text: next },
    { type: 'list', items: conditions },
  ],
});

/** Les vagues 0 à 5, dans l'ordre de Dragon. */
export const vagues: Section[] = [
  vague({
    id: 'vague-0',
    title: 'Vague 0 : maintenant, sans dépense',
    content: [
      {
        type: 'table',
        caption: 'Vague 0 : actions',
        columns: ['Action', 'Pourquoi', 'Faite quand'],
        rows: [
          [
            'Passer l’examen en ligne de télépilote A1/A3',
            'Obligatoire au-dessus de 250 g, gratuit et valable cinq ans.',
            'Attestation téléchargée',
          ],
          [
            'S’inscrire comme exploitant sur AlphaTango',
            'Obligatoire : le numéro d’exploitant sera collé sur le drone.',
            'Numéro d’exploitant obtenu',
          ],
          [
            'Vérifier que le vol en drone est assuré',
            'Le télépilote est responsable des dommages causés par son drone.',
            'Réponse écrite reçue',
          ],
          [
            'Trouver un terrain autorisé en catégorie A3',
            'Sans terrain, pas de vol.',
            'Terrain et accord obtenus',
          ],
          [
            'Installer ArduPilot SITL, la simulation sur PC',
            'Écrire un premier code MAVLink sans matériel.',
            'Un drone simulé décolle et atterrit par un script',
          ],
          [
            'Demander au vendeur le stock réel du kit, du contrôleur de vol et du GPS, et la version des moteurs',
            'Les pages affichaient des stocks contradictoires et deux versions de moteur.',
            'Réponse reçue',
          ],
          [
            'Faire confirmer par écrit le format de la balise de signalisation et son délai de réassort',
            'Elle était en rupture au 2026-11-20, et son format français doit être confirmé par écrit.',
            'Réponse reçue',
          ],
        ],
      },
    ],
    why: [
      'Rien ne coûte : l’administratif et la simulation apprennent les règles et testent la motivation avant la première dépense.',
    ],
    next: 'Condition de passage à la vague 1 :',
    conditions: [
      'Attestation A1/A3 obtenue. Si l’examen ou les règles de la catégorie A3 rebutent, mieux vaut le savoir avant d’avoir engagé l’essentiel du budget.',
    ],
  }),
  vague({
    id: 'vague-1',
    title: 'Vague 1 : radio et outillage',
    content: [
      {
        type: 'table',
        caption: 'Vague 1 : articles',
        columns: ['Article', 'Pourquoi maintenant', 'Si on s’en passe'],
        rows: [
          [
            'Radiocommande Radiomaster Pocket ELRS, version européenne (LBT)',
            'Elle sert au simulateur pendant les livraisons : c’est la pièce qui demande le plus d’entraînement.',
            'Un premier vol sans entraînement, donc un crash probable.',
          ],
          [
            'Deux accus 18650',
            'Ils ne sont pas fournis avec la radio.',
            'La radio ne s’allume pas.',
          ],
          [
            'Récepteur RP4TD',
            'Commandé avec la radio, il partage ses frais de port, et on peut l’appairer et le tester tout de suite.',
            'Des frais de port en double.',
          ],
          [
            'Smoke stopper XT60',
            'Indispensable à la première mise sous tension.',
            'Un court-circuit peut détruire l’électronique.',
          ],
          [
            'Outillage manquant : fer d’au moins 65 W réels, multimètre, étain, flux, clés hexagonales, consommables',
            'S’entraîner à souder un XT60 et du fil 12 AWG avant l’arrivée de l’électronique.',
            'Des soudures froides, donc une coupure en vol.',
          ],
        ],
      },
    ],
    why: [
      'La radio est le seul achat utile dès sa réception, grâce au simulateur.',
      'Les outils conditionnent la qualité de tout le montage.',
      'Ensemble, ils font environ 20 % du budget : on avance sans s’engager sur le gros morceau.',
    ],
    next: 'Conditions de passage à la vague 2 :',
    conditions: [
      'Radio reconnue comme manette par le simulateur, deux heures de simulateur faites, un vol stationnaire de deux minutes sans crash.',
      'Un XT60 d’entraînement soudé : brillant, il tient à la traction.',
      'Réponse du vendeur reçue sur le stock et la version des moteurs.',
    ],
  }),
  vague({
    id: 'vague-2',
    title: 'Vague 2 : le drone',
    content: [
      {
        type: 'paragraph',
        text: 'Une seule commande groupée, chez un vendeur qui a tout en stock ; sinon, tout chez le fabricant.',
      },
      {
        type: 'table',
        caption: 'Vague 2 : articles',
        columns: ['Article', 'Pourquoi ce choix', 'Pourquoi groupé'],
        rows: [
          [
            'Kit ARF Holybro X500 V2, et non le cadre seul',
            'Moteurs, ESC, hélices et carte de distribution assortis par le fabricant, moins chers que pièce par pièce.',
            'C’est le socle physique de tout le reste.',
          ],
          [
            'Contrôleur de vol Pixhawk 6C, avec son module d’alimentation PM02 V3',
            'Pas de soudure fine, cinq ports série, un standard ouvert et une documentation écrite pour ce kit. L’option économique est arrêtée.',
            'Le module d’alimentation doit correspondre au contrôleur, et ses connecteurs sont communs avec le GPS.',
          ],
          [
            'GPS Holybro M10, compas IST8310, connecteur à 10 broches',
            'Branchement direct sur le Pixhawk, compas compatible avec PX4 et ArduPilot.',
            'Même famille de connecteurs.',
          ],
          [
            'Un lot d’hélices 1045 de rechange',
            'Les seules hélices garanties compatibles avec le moteur du kit.',
            'Pas de second envoi pour un petit article.',
          ],
        ],
      },
    ],
    why: [
      'C’est le plus gros engagement, environ 55 % du budget : il ne part qu’après la vague 1, qui a validé la motivation, l’entraînement et le stock.',
      'Grouper évite trois ports et trois délais.',
      'Surtout, une incompatibilité de connecteur entre le contrôleur, le module d’alimentation et le GPS se découvre d’un coup et se règle en un seul échange.',
      'Si le vendeur n’a qu’une partie du stock, ne pas mélanger les vendeurs pour gagner quelques jours : deux ports, et un risque de versions différentes. Attendre jusqu’à trois semaines, puis passer chez le fabricant après avoir vérifié le total TTC du panier, TVA, port et douane compris.',
    ],
    next: 'Conditions de passage à la vague 3 :',
    conditions: [
      'Toutes les pièces contrôlées à réception.',
      'Châssis assemblé, vis au frein-filet.',
      'Pixhawk reconnu en USB, ArduPilot flashé, horizon artificiel correct, alimenté par l’USB et sans batterie.',
    ],
  }),
  vague({
    id: 'vague-3',
    title: 'Vague 3 : énergie',
    content: [
      {
        type: 'paragraph',
        text: 'Le chargeur d’abord, les batteries ensuite : une semaine d’écart au plus, ou la même commande si le vendeur expédie les LiPo.',
      },
      {
        type: 'table',
        caption: 'Vague 3 : articles',
        columns: ['Article', 'Pourquoi ce choix', 'Pourquoi maintenant'],
        rows: [
          [
            'Chargeur ToolkitRC M6AC',
            '100 W sur secteur, soit une charge à 1C en une heure environ ; il mesure la résistance interne.',
            'Il doit être là à l’arrivée des LiPo pour les contrôler et les mettre en stockage.',
          ],
          [
            'Grand sac ignifuge et testeur de LiPo',
            'Une charge et un stockage sécurisés.',
            'Même raison que le chargeur.',
          ],
          [
            'Deux LiPo 4S de 5 000 à 5 200 mAh, prise XT60, moins de 480 g',
            'Prise XT60 déjà montée : pas de soudure sur une LiPo chargée.',
            'Le drone est monté : place aux tests sous tension.',
          ],
        ],
      },
    ],
    why: [
      'Une LiPo achetée trop tôt vieillit dans un placard, et ne sert à rien tant que le drone n’est pas monté.',
      'L’acheter après l’assemblage, c’est choisir sa taille en connaissant la vraie baie batterie et le vrai poids du drone : s’il est plus lourd que prévu, on peut prendre un pack plus léger.',
    ],
    next: 'Conditions de passage à la vague 4 :',
    conditions: [
      'Batteries contrôlées : cellules à ±0,02 V, pesées et numérotées.',
      'Première mise sous tension réussie, derrière le smoke stopper.',
      'Configuration complète sans hélices : moteurs, sens de rotation et failsafe radio testé.',
    ],
  }),
  vague({
    id: 'vague-4',
    title: 'Vague 4 : conformité',
    content: [
      {
        type: 'table',
        caption: 'Vague 4 : article',
        columns: ['Article', 'Pourquoi'],
        rows: [
          [
            'Balise de signalisation électronique au format français',
            'Obligatoire pour voler à partir de 800 g hors terrain de club.',
          ],
        ],
      },
      {
        type: 'paragraph',
        text: 'Ensuite, enregistrer le drone sur AlphaTango avec l’identifiant de la balise, puis coller les deux numéros sur le drone.',
      },
    ],
    why: [
      'La balise ne sert qu’à partir du premier vol, d’où sa place après les tests sous tension.',
      'Mais elle était en rupture au 2026-11-20 : elle se commande dès son retour en stock, même en vague 1.',
    ],
    next: 'Conditions du premier vol :',
    conditions: [
      'Balise enregistrée, et son signal vu avec une application de réception.',
      'Cinq heures de simulateur.',
      'Un terrain, une assurance et une personne pour assister le pilote.',
    ],
  }),
  vague({
    id: 'vague-5',
    title: 'Vague 5 : après les premiers vols',
    content: [
      {
        type: 'paragraph',
        text: 'Une réserve conditionnelle : hélices, bras ou ESC de rechange, troisième batterie, moteur de rechange, ESC 4-en-1 en plan B et thermomètre infrarouge.',
      },
    ],
    why: [
      'Ces achats dépendent de la casse et de la consommation réelles, connues seulement après les premiers vols.',
    ],
    next: 'Conditions d’achat, article par article :',
    conditions: [
      'Hélices, bras ou ESC de rechange : après une casse réelle.',
      'Troisième batterie : si les séances de réglage automatique (autotune) sont trop courtes avec deux packs.',
      'Moteur de rechange : si un moteur est abîmé ou bruyant.',
      'ESC 4-en-1 AM32 55 A, en plan B : si les ESC dépassent 80 °C ou si le flash Bluejay est impossible. Le recâblage est lourd : remplacer d’abord l’ESC en cause.',
      'Thermomètre infrarouge : en cas de doute sur la température des ESC ou des moteurs.',
    ],
  }),
];

export default {
  project: 'dragon',
  slug: 'achats',
  title: 'Achats et budget',
  description:
    'L’ordre d’achat de la phase 1 de Dragon en six vagues : pourquoi cet ordre, ce qui doit être validé entre deux vagues, et le budget prévu.',
  sections: [
    {
      id: 'principes',
      title: 'Principes de l’ordre d’achat',
      source: source('ordre-achat.md'),
      blocks: [
        {
          type: 'paragraph',
          text: 'L’ordre d’achat dit dans quel ordre acheter, pourquoi, et ce qui doit être validé avant la commande suivante. Le détail de chaque pièce est sur la page Matériel.',
        },
        {
          type: 'list',
          items: [
            'Le gratuit d’abord : l’examen, l’inscription et la simulation ne coûtent rien, et testent la motivation avant d’engager l’essentiel du budget.',
            'La radio avant le drone : elle sert de manette pour le simulateur pendant les deux à six semaines de livraison. Il faut cinq heures d’entraînement avant le premier vol.',
            'Les outils avant l’électronique : on s’entraîne à souder sur des chutes, pas sur le récepteur.',
            'Les pièces interdépendantes ensemble : le kit, le contrôleur de vol et le GPS doivent être compatibles, donc une seule commande, chez un seul vendeur si possible.',
            'Les batteries LiPo le plus tard possible : une LiPo n’aime pas attendre et ne sert qu’aux tests sous tension. Le chargeur arrive avant elle.',
            'Le confort après les premiers vols : la troisième batterie et les pièces de rechange attendent de connaître la consommation et la casse réelles.',
          ],
        },
      ],
    },
    ...vagues,
    {
      id: 'budget',
      title: 'Budget',
      source: source('ordre-achat.md'),
      blocks: [
        {
          type: 'table',
          caption: 'Budget de la phase 1',
          columns: ['Poste', 'Montant'],
          rows: [['Plafond de la phase 1', budget(1200)]],
        },
        {
          type: 'table',
          caption: 'Dépenses cumulées par vague',
          columns: [
            'Après la vague',
            'Budget de la vague',
            'Dépense cumulée',
            'Reste sur le plafond',
          ],
          rows: [
            ['0', budget(0), budget(0), budget(1200)],
            ['1', budget(210, 280), budget(210, 280), budget(920, 990)],
            ['2', budget(640, 700), budget(850, 980), budget(220, 350)],
            ['3', budget(195, 225), budget(1045, 1205), budget(-5, 155)],
            ['4', budget(40), budget(1085, 1245), budget(-45, 115)],
            [
              '5',
              budget(50, 80),
              'Selon la casse',
              'Garder une réserve, au moins le bas de la fourchette de la vague 5',
            ],
          ],
        },
        {
          type: 'paragraph',
          text: 'Prévision relevée le 2026-11-20, à partir des prix des fiches d’achat : chaque prix reste à confirmer le jour de la commande. Un reste négatif est un dépassement du plafond.',
        },
        {
          type: 'paragraph',
          text: 'Le point de contrôle est la fin de la vague 2. Si le reste ne couvre plus les vagues 3 et 4, appliquer avant la vague 3 les leviers d’économie :',
        },
        {
          type: 'list',
          items: [
            'outillage ou radio d’occasion ;',
            'balise faite maison ;',
            'au pire, une seule batterie au départ.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Hors budget de la phase 1 : l’alimentation 5 V (BEC) et le Raspberry Pi, pour la phase 3, et le vol en immersion (FPV), en option.',
        },
      ],
    },
    {
      id: 'avant-chaque-commande',
      title: 'Avant chaque commande',
      source: source('ordre-achat.md'),
      blocks: [
        { type: 'paragraph', text: 'Une règle du projet. Vérifier :' },
        {
          type: 'list',
          items: [
            'la référence exacte sur la page : le kit ARF et non le cadre seul, la version européenne (LBT) de la radio, le compas IST8310, la prise XT60 ;',
            'le stock réel : le bouton d’ajout au panier s’affiche parfois même en rupture ;',
            'le total TTC, port compris ;',
            'la trace écrite de la commande dans le journal du projet.',
          ],
        },
      ],
    },
    {
      id: 'etat-des-commandes',
      title: 'État des commandes',
      source: source('bom.md'),
      blocks: [
        {
          type: 'paragraph',
          text: 'Première commande passée le 2026-11-20.',
        },
      ],
    },
  ],
} satisfies ProjectPage;
