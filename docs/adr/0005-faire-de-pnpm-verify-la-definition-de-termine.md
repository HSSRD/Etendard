# 0005. Faire de `pnpm verify` la définition unique de « terminé »

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Les agents travaillent seuls et doivent savoir sans ambiguïté quand leur travail est fini. Une seule commande, identique en local, dans les hooks et en CI, évite les écarts d'interprétation.

## Décision

- `pnpm verify:fast` : `astro check` + ESLint + Stylelint + Vitest. Lancée après chaque modification (hook Stop, 0012) et en pre-push (Lefthook).
- `pnpm verify` : `verify:fast` + Knip + dependency-cruiser + build + `html-validate` + Playwright. **Une tâche n'est terminée que si `pnpm verify` passe.** C'est la commande exécutée par la CI (0010) et avant déploiement (0006).
- Lint : ESLint 10 (+ plugins astro, vue, accessibilité), Prettier 3 (+ plugin astro), Stylelint (0004).
- **Knip** : code, exports et dépendances inutilisés (les agents laissent souvent l'ancien code).
- **dependency-cruiser** : règles d'architecture exécutables (un composant n'importe jamais une page, `ui/` n'importe jamais de contenu, pas de cycle).
- Git : Lefthook (pre-commit : format + lint des fichiers modifiés ; commit-msg : commitlint ; pre-push : `verify:fast`), Conventional Commits, merge en squash.

## Alternatives écartées

- **Biome** : prise en charge partielle d'Astro et Vue.
- **Oxlint** : à ajouter plus tard si la vitesse du lint devient un problème.
- **Husky** : Lefthook regroupe tous les hooks dans un seul fichier de configuration et les exécute en parallèle.
- **Changesets, release-please** : inutiles en déploiement continu ; notes de version générées depuis les titres de PR.

## Conséquences

- Une seule porte de qualité, lisible par un agent dans `AGENTS.md`.
- `pnpm verify` est long (build + Playwright) ; `verify:fast` couvre la boucle courte.

## Points de vigilance

- **Captures uniquement dans Docker (0003)** : `pnpm verify` inclut Playwright, donc les tests visuels. Hors de l'image Docker (poste de Flo sous Windows, `claude --worktree` en local), ils échoueront ou produiront des captures fausses. Il faut soit que `pnpm verify` lance Playwright dans le conteneur, soit que la définition de terminé locale exclue le visuel et laisse la CI trancher.
- **`lychee` et Lighthouse CI ne figurent pas dans `pnpm verify`** alors qu'ils sont dans la stratégie de test (0003). Pour les liens externes, c'est souhaitable (réseau instable) ; il faut décider s'ils tournent en CI séparément, et si un échec bloque le merge.
