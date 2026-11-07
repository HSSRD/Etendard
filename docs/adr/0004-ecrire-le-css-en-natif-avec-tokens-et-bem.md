# 0004. Écrire le CSS en natif avec des design tokens, BEM et un Stylelint strict

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Les agents écrivent l'essentiel du CSS. Il faut une convention vérifiable automatiquement, sans valeur en dur. BEM est un **choix de Flo**. Le CSS natif offre désormais variables, imbrication et couches.

## Décision

- **CSS natif**, sans préprocesseur.
- **Design tokens** en variables CSS dans `src/styles/tokens.css` : seule source des couleurs, espacements, typographie, rayons, ombres, durées.
- **BEM** (choix de Flo) + styles `scoped` d'Astro : un composant = un bloc BEM.
- Couches : `@layer reset, tokens, base, components, utilities`.
- Thème sombre dès le départ (`prefers-color-scheme` + `[data-theme]`).
- Polices auto-hébergées, `font-display: swap`.
- **Stylelint** avec `stylelint-selector-bem-pattern` (BEM imposé), `stylelint-declaration-strict-value` (aucune couleur ni espacement en dur) et `stylelint-order`. Version de Stylelint : voir Points de vigilance.

## Alternatives écartées

- **SCSS** : n'apporte plus rien face au CSS natif, ajoute une compilation.
- **Tailwind** : probablement l'approche CSS la mieux maîtrisée par les agents, écartée au profit de BEM (choix de Flo).

## Conséquences

- Toute valeur visuelle passe par un token ; changer le thème revient à modifier `tokens.css`.
- Les agents doivent écrire du BEM correct, imposé par le lint.
- Si les agents peinent sur le CSS, cette décision est la première à réexaminer (Tailwind) par un nouvel ADR.

## Points de vigilance

- **Stylelint 18 incompatible avec deux plugins, vérifié** : Stylelint 18.0.0 est sorti le 2026-11-03. `stylelint-selector-bem-pattern` 5.0.0 déclare `stylelint: ^17.0.0` et `stylelint-declaration-strict-value` 1.12.1 déclare `stylelint: >=16 <=17`. Seul `stylelint-order` 8.1.3 accepte la 18. Il faut partir sur **Stylelint 17.x** (dernière : 17.16.0) jusqu'à ce que les deux plugins élargissent leurs `peerDependencies`.
- **BEM dans les fichiers `.astro` et `.vue`** : `stylelint-selector-bem-pattern` repose sur `postcss-bem-linter`, qui identifie le bloc par un commentaire `/** @define … */` ou par le nom du fichier. Le fonctionnement sur les `<style>` de `.astro`/`.vue` (via `postcss-html`) reste à valider au scaffolding.
