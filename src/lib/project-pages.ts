// Pages de projet (ADR 0016) : libellés, prix et liens vers le repo source, sans Zod
// (validate-project-pages.ts le garde au build), pour le navigateur et les apps.

/** Statuts d'une section, d'un projet ou d'une cellule, et leur libellé affiché. */
export const statusLabels = {
  'a-venir': 'À venir',
  'en-cours': 'En cours',
  termine: 'Terminé',
  // Statuts d'une décision (ADR) : quand elle est validée, seul ce champ change dans le contenu.
  propose: 'Proposé (à valider)',
  accepte: 'Accepté',
} as const;

export type Status = keyof typeof statusLabels;

export interface Price {
  min: number;
  max: number;
  /** Date du relevé, AAAA-MM-JJ. */
  date: string;
}

/** « 349,9 », « 1 200 », « −5 » : milliers séparés par une espace insécable, signe moins typographique. */
const euros = (amount: number) => {
  const [whole = '', decimals] = String(Math.abs(amount)).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, '\u00a0');
  return `${amount < 0 ? '\u2212' : ''}${grouped}${decimals ? `,${decimals}` : ''}`;
};

/** « 5 à 10 €, relevé le 2026-11-20 » : un prix n'est jamais affiché sans sa date. */
const formatPrice = ({ min, max, date }: Price) =>
  `${euros(min)} à ${euros(max)}\u00a0€, relevé le ${date}`;

/** « 1 200 €, prévu le 2026-11-20 », « −5 à 155 €, prévu le … » : un budget est daté comme un prix. */
const formatBudget = ({ min, max, date }: Price) =>
  `${min === max ? euros(min) : `${euros(min)} à ${euros(max)}`}\u00a0€, prévu le ${date}`;

/** Texte affiché d'une cellule de tableau : le texte, le prix ou le budget daté, ou le libellé du statut. */
export const cellText = (
  cell:
    | string
    | {
        status?: Status | undefined;
        price?: Price | undefined;
        budget?: Price | undefined;
      },
) => {
  if (typeof cell === 'string') return cell;
  if (cell.status) return statusLabels[cell.status];
  if (cell.price) return formatPrice(cell.price);
  return cell.budget ? formatBudget(cell.budget) : '';
};

/** Fichiers du repo source qui contiennent des données jamais publiées : jamais liés (barre finale comprise). */
const unlinkable = [
  /(^|\/)bom\.md\/?$/,
  /(^|\/)ordre-achat\.md\/?$/,
  /(^|\/)commandes(\/|$)/,
];

export const isLinkable = (path: string) =>
  !unlinkable.some((pattern) => pattern.test(path));

/** Lien d'un fichier du repo source à un commit, ou undefined s'il ne doit pas être lié. */
export const sourceUrl = (repo: string, path: string, sha: string) =>
  isLinkable(path) ? `${repo}/blob/${sha}/${path}` : undefined;

/** `/projets/dragon` pour l'accueil (slug vide), `/projets/dragon/materiel` pour une sous-page. */
export const pagePath = (project: string, slug: string) =>
  `/projets/${project}${slug ? `/${slug}` : ''}`;

/** Colonnes d'un tableau au plus : la feuille web (web-css.ts) a une règle par nombre de colonnes. */
export const tableMaxColumns = 6;
