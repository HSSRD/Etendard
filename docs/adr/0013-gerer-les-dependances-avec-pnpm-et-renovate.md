# 0013. Gérer les dépendances avec pnpm et Renovate, avec merge automatique des mineures

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Les agents ajoutent facilement des dépendances et importent des paquets non déclarés. L'écosystème bouge vite (Astro, Vitest, Playwright, ESLint) et la mise à jour manuelle est une action humaine à éviter. Le merge humain est le contrôle avant la production (0010) ; Flo accepte une exception encadrée pour les mises à jour de dépendances.

## Décision

- **pnpm**, version figée par `packageManager` ; `engines` et `.nvmrc` pour Node (0001). Avec pnpm, un paquet non déclaré n'est pas importable.
- **Renovate**, mises à jour regroupées :
  - **merge automatique des mineures et correctifs si `pnpm verify` passe**. C'est la seule exception au merge humain de 0010, acceptée par Flo ;
  - **délai minimal de 3 jours** après la publication d'une version avant de la proposer (`minimumReleaseAge` dans Renovate, et le même réglage dans pnpm pour les ajouts manuels) : un paquet compromis est en général retiré dans ce délai ;
  - **jamais de merge automatique** pour les majeures, ni pour Playwright (une montée de version invalide les captures de référence, 0003), TypeScript (0001) et Stylelint (0004), dont les `peerDependencies` sont serrées.
- Actions GitHub figées par SHA, mises à jour par Renovate selon les mêmes règles.
- Cache pnpm et Playwright en CI.

## Alternatives écartées

- **Aucun merge automatique** : plus sûr, mais quelques PR à merger chaque semaine, contraire à l'objectif du moins d'actions humaines possible.
- **npm** : arbre de dépendances plat, un agent peut importer un paquet transitif non déclaré.
- **Bun, Deno** : moins éprouvés avec cet écosystème.
- **Dependabot** : regroupement et règles de merge automatique moins riches.

## Conséquences

- Dépendances à jour sans intervention pour les mineures et correctifs.
- Chaque mise à jour mergée automatiquement part en production (0006) sans relecture humaine. Seuls `pnpm verify` et le délai de 3 jours protègent contre une régression ou un paquet malveillant.
- La protection de `main` (0011) ne doit pas exiger de relecture humaine pour les PR de Renovate, sinon il ne peut pas merger seul.
- `main` n'accepte qu'une PR à jour (0011) : Renovate rebase seul ses PR en retard (`rebaseWhen: behind-base-branch`), puis attend que `pnpm verify` repasse avant de merger. Il ne touche plus à une branche qui porte un commit d'un autre auteur.
