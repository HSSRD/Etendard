# 0013. Gérer les dépendances avec pnpm et Renovate, avec merge automatique des mineures

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Les agents ajoutent facilement des dépendances et importent des paquets non déclarés. L'écosystème bouge vite (Astro, Vitest, Playwright, ESLint) et la mise à jour manuelle est une action humaine à éviter.

## Décision

- **pnpm**, version figée par `packageManager` ; `engines` et `.nvmrc` pour Node (0001). Avec pnpm, un paquet non déclaré n'est pas importable.
- **Renovate** : mises à jour regroupées, **merge automatique des mineures et correctifs si `pnpm verify` passe** (les tests visuels détectent les régressions). Majeures en PR à relire.
- Actions GitHub figées par SHA, mises à jour par Renovate.
- Cache pnpm et Playwright en CI.

## Alternatives écartées

- **npm** : arbre de dépendances plat, un agent peut importer un paquet transitif non déclaré.
- **Bun, Deno** : moins éprouvés avec cet écosystème.
- **Dependabot** : regroupement et règles de merge automatique moins riches.

## Conséquences

- Dépendances à jour sans intervention pour les mineures.
- Chaque mineure mergée part en production (0006).

## Points de vigilance

- **Contradiction avec le merge humain (0010)** : 0010 fait du merge humain « le seul contrôle avant la production ». Le merge automatique de Renovate en est une exception : du code tiers part en production sans relecture. Flo doit l'accepter explicitement comme exception, ou passer Renovate en PR simples.
- **Chaîne d'approvisionnement** : le site est public et le build exécute les scripts des dépendances. Un délai minimal avant adoption d'une version (`minimumReleaseAge` côté Renovate et côté pnpm) réduit le risque d'un paquet compromis puis retiré.
- **Paquets à exclure du merge automatique** : `astro` (Container API instable même en correctif, 0003), Playwright (invalide les captures de référence), et les paquets aux `peerDependencies` serrées (TypeScript, 0001 ; Stylelint, 0004).
- **Protection de `main`** : si une relecture est exigée, Renovate ne peut pas merger seul ; à concilier avec 0011.
