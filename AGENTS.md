# AGENTS.md

Site vitrine statique : Astro 7, TypeScript strict, CSS natif. Node 26, pnpm (versions figées).
Lis `docs/adr/` avant toute modification structurelle. Ne contredis jamais un ADR accepté : propose un nouvel ADR.

## Commandes

- `pnpm dev` : serveur de développement (styleguide compris, sur `/styleguide`).
- `pnpm verify:fast` : `astro check`, ESLint, Prettier, Stylelint, Vitest. Lance-la après chaque modification.
- `pnpm verify` : `verify:fast`, `pnpm test:infra`, Knip, dependency-cruiser, build, `html-validate`, Playwright.
- `pnpm test:infra` : tests de `infra/pi/etendard-receive` (sous Windows, le script prend lui-même le bash de Git).
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
2. `gh run list --branch <branche> --workflow ci.yml --status failure --limit 1` donne l'id du run.
3. `pnpm captures:ci <id>` télécharge l'artefact `playwright` (gardé 7 jours) et copie chaque image
   « actual » à la place de sa référence. Seules les captures manquantes ou en écart changent.
4. Relis chaque image modifiée (`git status`) : un écart non voulu est un bug à corriger, pas une capture à commiter.
5. Commite les captures (`test: mettre à jour les captures générées par la CI (#N)`) et pousse : le run doit passer.

`tests/accueil.spec.ts` capture la one page entière (`accueil-*`, `lien-evitement-*`) : tout changement
visuel d'un composant de la page change aussi ces captures. Une capture suivie d'autres étapes du test
s'écrit `expect.soft(…).toHaveScreenshot(…)` : le test va jusqu'au bout, le run produit toutes ses
captures en écart et échoue quand même.

## Composants

Chaque composant est un trio colocalisé :

- `src/components/X.astro` ;
- `src/components/X.spec.ts` : test Playwright de la page styleguide (DOM, axe, capture par état) ;
- `src/pages/styleguide/x.astro` : chaque état du composant, lien ajouté dans `src/pages/styleguide/index.astro`.

Les pages `/styleguide` ne sont publiées que si `STYLEGUIDE=1`. Un composant n'importe jamais une page.

## CSS

- Aucune valeur en dur : couleurs, espacements, positions, ombres, typographie (taille, famille, graisse, interligne),
  rayons, épaisseurs de bordure et d'outline, `outline-offset`, durées et délais, `z-index` passent par les tokens (`var(--…)`).
  Pas de `calc()`, de `clamp()`, de dégradé ni de valeur de repli `var(--x, …)` dans un composant : définis un token.
  `font`, `text-decoration`, `-webkit-text-stroke`, `border` (et ses côtés), `outline`, `transition` et `animation`
  sont interdits : utilise les propriétés détaillées.
- BEM : `MonBloc.astro` définit le bloc `.mon-bloc` (`HeroCTA.astro` → `.hero-cta`), ses éléments `.mon-bloc__x`, ses modificateurs `.mon-bloc--y`.
- Pas de globales Node (`process`, `Buffer`…) dans `src/` : utilise `import.meta.env`.
- Propriétés par ordre alphabétique, variables CSS en premier (`stylelint --fix` les range).

## Playwright

L'image Docker de `ci.yml`, de `deploy.yml` et de `pnpm captures:maj` suit la version de
`@playwright/test` : mets à jour les deux workflows (tag et empreinte `@sha256:`) en même temps que le paquet.
Renovate (`renovate.json`, ADR 0013) le fait dans sa PR « Playwright » :
régénère les captures dans sa branche (`pnpm captures:maj`) et commite-les ; le merge reste humain.
Si Renovate recrée ensuite la branche (rebase), ce commit disparaît : relance `pnpm captures:maj`.
Une version plus récente arrive dans une nouvelle PR : ferme l'ancienne et refais-y les captures.
