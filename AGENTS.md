# AGENTS.md

Vitrine web, iOS et Android dans une seule base : Expo SDK 58 (Expo Router, React Native, React Native Web),
TypeScript strict. Le web est exporté en statique (ADR 0015). Node 26, pnpm (versions figées).
Lis `docs/adr/` avant toute modification structurelle. Ne contredis jamais un ADR accepté : propose un nouvel ADR.

## Commandes

- `pnpm dev` : serveur de développement Expo (`w` : web, styleguide sur `/styleguide` ; Expo Go : iOS et Android).
- `pnpm build` : valide le contenu (Zod), exporte le web dans `dist/`, sort les styles et scripts en ligne en fichiers.
- `pnpm verify:fast` : `tsc`, ESLint, Prettier, Vitest. Lance-la après chaque modification.
- `pnpm verify` : `verify:fast`, `pnpm test:infra`, Knip, dependency-cruiser, build, `html-validate`, `pnpm build:natif`, Playwright,
  `html-validate` du styleguide.
- `pnpm build:natif` : exporte les bundles iOS et Android dans `dist-natif/` (jamais livré) ; échoue si Metro ou Hermes
  ne construit pas un bundle natif. Il n'attrape pas un import de `react-dom` ni `window` dans un composant commun.
  `pnpm dlx expo-doctor` (réseau) se lance à la main, hors de `pnpm verify`.
- `pnpm test:infra` : tests de `infra/pi/test/*.test.sh` (sous Windows, le script prend lui-même le bash de Git).
- `pnpm exec playwright test src/components/X.spec.ts` : boucle courte sur un composant.
- `pnpm captures:maj [fichiers]` : régénère les captures de référence dans Docker.
- `pnpm captures:ci <id du run>` : installe les captures produites par un run `ci.yml` en échec (sans Docker).

## Définition de terminé

Une tâche n'est terminée que si `pnpm verify` passe. Hors de l'image Docker de Playwright (Windows,
poste local), les captures `toHaveScreenshot` sont ignorées : la CI (`ci.yml`, Linux) fait foi.
Ne modifie jamais une capture de référence à la main ni hors Docker : sans Docker, installe celles de la CI.

## Captures sans Docker

Quand un changement visuel invalide des captures et que Docker manque :

1. Pousse la branche et ouvre la PR : le run `ci.yml` échoue sur `toHaveScreenshot`.
2. `gh run list --commit "$(git rev-parse HEAD)" --workflow ci.yml` donne l'id du run du dernier commit poussé
   (attends qu'il soit terminé : un run plus ancien contient des captures périmées).
3. `pnpm captures:ci <id>` télécharge l'artefact `playwright` (gardé 7 jours) et copie chaque image
   « actual » à la place de sa référence. Seules les captures manquantes ou en écart changent.
4. Relis chaque image modifiée (`git status`) : un écart non voulu est un bug à corriger, pas une capture à commiter.
5. Commite les captures (`test: mettre à jour les captures générées par la CI (#N)`) et pousse : le run doit passer.

`tests/accueil.spec.ts` capture la one page entière (`accueil-*`) et son haut d'écran (`lien-evitement-*`) :
tout changement visuel d'un composant de la page change aussi ces captures. Une capture suivie d'autres étapes du test
s'écrit `expect.soft(…).toHaveScreenshot(…)` : le test va jusqu'au bout, le run produit toutes ses
captures en écart et échoue quand même.

## Structure

- `src/app/` : routes d'Expo Router (`index.tsx` : la one page ; `projets/<projet>/` : pages de projet, ADR 0016 ;
  `+html.tsx` : gabarit HTML du web ; `styleguide/`).
- `src/components/`, `src/layouts/` (`BaseLayout`), `src/lib/` (ancres et liens, projets), `src/theme/` (tokens, thème),
  `src/content/projects.ts` (fiches validées au build par `src/lib/validate-projects.ts`), `src/content/projets/<projet>/`
  (`projet.ts` et une page par fichier, validés par `src/lib/validate-project-pages.ts` ; `scripts/jamais-publie.test.ts`
  y refuse les données jamais publiées).
- Variante d'une plateforme : `X.web.tsx` (web) à côté de `X.tsx` (iOS et Android), mêmes props.
- `docs/dependances.md` : raison de chaque dépendance et configuration. Une dépendance ajoutée ou retirée y met à jour
  sa ligne ; versions et classement suivent ADR 0013 (`scripts/dependances.test.ts` vérifie la liste des dépendances et leurs versions).

## Composants

Chaque composant est un trio colocalisé :

- `src/components/X.tsx` ;
- `src/components/X.spec.ts` : test Playwright de la page styleguide (DOM, axe, capture par état) ;
- `src/app/styleguide/x.tsx` : chaque état du composant, lien ajouté dans `src/app/styleguide/index.tsx`.

Une partie propre à un composant et à une plateforme (`HeroVideo.tsx` / `.web.tsx` pour `Hero`) n'a pas de trio :
elle est testée par la spec de son composant. Les pages `/styleguide` ne sont publiées que si `STYLEGUIDE=1`.
Un composant n'importe jamais une page.
Les tests visent les rôles, les textes et les `testID` (rendus en `data-testid`), pas les classes générées.

## Styles

- Aucune valeur en dur : couleurs, espacements, tailles, rayons, épaisseurs, ombres, `zIndex` viennent de
  `src/theme/tokens.ts` (ESLint le vérifie dans `StyleSheet.create` et `themedStyles`, seuls 0 et 1 sont admis).
- Tout style passe par `StyleSheet.create`, ou `themedStyles` s'il dépend des couleurs du thème : jamais d'objet
  `style` en ligne. Sur le web, il deviendrait un attribut `style`, refusé par la CSP du Caddyfile (`tests/csp.spec.ts`).
  Seule exception : une valeur calculée sur iOS et Android (taille de la fenêtre), jamais passée sur le web.
- Chaque `Text` reçoit sa police (`useTypography`) : React Native n'en hérite pas d'un `View`.
- Sémantique par `role` et `aria-*` (`role="heading"` + `aria-level`, `banner`, `main`, `contentinfo`, `region`,
  `article`, `list`, `listitem`, `paragraph` de `src/theme/typography.ts`) ; liens par `TextLink` (`src/lib/anchors.tsx`).
- Valeur propre au web (`calc()`, `clamp()`, `sticky`) : `css(web, natif)` de `tokens.ts`. Focus, survol, ancres :
  feuille générée `src/theme/web-css.ts`, accrochée par `dataSet` (`data-*`).
- Pas de globales Node (`process`, `Buffer`…) dans `src/`.

## Playwright

L'image Docker de `ci.yml`, de `deploy.yml` et de `pnpm captures:maj` suit la version de
`@playwright/test` : mets à jour les deux workflows (tag et empreinte `@sha256:`) en même temps que le paquet.
Renovate (`renovate.json`, ADR 0013) le fait dans sa PR « Playwright » :
régénère les captures dans sa branche (`pnpm captures:maj`) et commite-les ; le merge reste humain.
Ce commit empêche Renovate de rebaser seul la branche ; s'il la recrée (case de rebase cochée), le commit disparaît : relance `pnpm captures:maj`.
`main` n'accepte qu'une PR à jour : si elle est en retard, fusionne `origin/main` dans la branche (« Update branch »,
ou en local en cas de conflit : `pnpm install` pour `pnpm-lock.yaml`, `pnpm captures:maj` pour les captures, ou sans Docker
la version de la branche puis « Captures sans Docker »),
récupère le résultat et refais les captures si la CI échoue sur `toHaveScreenshot`.
Une version plus récente arrive dans une nouvelle PR : ferme l'ancienne et refais-y les captures.
