// Feuille de style globale du web, générée depuis les tokens (ADR 0015) et rendue par +html.tsx.
// Seulement ce que StyleSheet ne sait pas écrire : variables du thème, défilement vers les ancres,
// focus visible, survol, lien d'évitement. Les composants s'y accrochent par des attributs data-*.
import { cssVariable } from './theme';
import { tableMaxColumns } from '@/lib/project-pages';
import { colorNames, focus, layout, palettes, underlineOffset } from './tokens';

/** `--color-x: light-dark(clair, sombre)` : le thème suit `color-scheme`. */
const variables = colorNames
  .map(
    (name) =>
      `${cssVariable(name)}:light-dark(${palettes.light[name]},${palettes.dark[name]});`,
  )
  .join('');

export const webCss = [
  `:root{color-scheme:light dark;${variables}}`,
  // Un conteneur [data-theme] (ThemeScope) impose son thème à son contenu.
  `[data-theme="light"]{color-scheme:light}`,
  `[data-theme="dark"]{color-scheme:dark}`,
  `html{scroll-behavior:smooth}`,
  `@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`,
  `body{background-color:var(${cssVariable('background')});margin:0}`,
  // Toute cible d'ancre s'arrête sous le header collant.
  `[id]{scroll-margin-top:${layout.headerHeight}px}`,
  `:focus-visible{outline-color:var(${cssVariable('focus')});outline-offset:${focus.offset}px;outline-style:solid;outline-width:${focus.width}px}`,
  `a[href]{text-decoration-thickness:from-font;text-underline-offset:${underlineOffset}}`,
  // Pointeur principal seulement : pas de soulignement resté collé après un tap.
  `@media (hover:hover){[data-hover="underline"]:hover{text-decoration-line:underline}}`,
  `[data-skip-link]:not(:focus){opacity:0;pointer-events:none}`,
  // Tableau (DataTable) : liste par défaut, comme sur iOS et Android ; en tableau quand son conteneur
  // a la place de toutes ses colonnes. Deux sélecteurs d'attribut : l'emportent sur les classes de StyleSheet.
  `[data-columns]{container-type:inline-size}`,
  ...Array.from({ length: tableMaxColumns - 1 }, (_, index) => {
    const n = index + 2;
    const table = `[data-columns="${n}"]`;
    return (
      `@container (min-width:${n * layout.tableColumn}px){` +
      `${table} [data-table-head]{display:flex}` +
      `${table} [role="row"]{flex-direction:row}` +
      `${table} [data-cell]{flex:1 1 0}` +
      `${table} [data-cell-label]{display:none}}`
    );
  }),
].join('\n');
