# 0003. Tester les composants sur les pages `/styleguide` avec Playwright, sans Storybook

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Exigence de Flo : zéro bug, zéro régression, chaque comportement des composants testé. Sur un site statique, les régressions sont surtout visuelles. Storybook ne prend pas en charge les composants `.astro` et délègue le test visuel à Chromatic (payant). Le remplacement de Storybook est accepté par Flo. La Container API d'Astro, qui permet de rendre un composant dans Vitest, est expérimentale et « sujette à des changements cassants, même dans des versions mineures ou de correctif » (doc Astro, 2026-11-07).

## Décision

| Niveau | Outil |
|---|---|
| Contenu | Schémas Zod (build) |
| Types | `astro check` |
| Logique TypeScript (utilitaires, schémas) | Vitest |
| Composants `.astro` | Playwright sur les pages `/styleguide` : assertions sur le DOM (rôles, textes, attributs) + capture `toHaveScreenshot`, 3 largeurs |
| Îles Vue (quand il y en aura, 0001) | Vitest + `@vue/test-utils` |
| Accessibilité | `@axe-core/playwright` (WCAG 2.2 AA) |
| Parcours | Playwright (navigation, liens, thème, 404) |
| HTML | `html-validate` sur `dist/` |
| Liens | `lychee` |
| Performance | Lighthouse CI (budgets : score ≥ 95, poids, JS max) |

- Chaque composant est un trio colocalisé : `X.astro`, `X.spec.ts` (Playwright), `src/pages/styleguide/x.astro`. La page styleguide affiche chaque état du composant ; le test vérifie le DOM puis capture chaque état.
- Les pages `/styleguide` ne sont construites que si `STYLEGUIDE=1`.
- Captures générées uniquement dans l'image Docker officielle de Playwright, animations désactivées.
- Pas d'objectif de couverture en pourcentage : chaque état visible a sa section dans le styleguide, une assertion et une capture.

## Alternatives écartées

- **Vitest + Container API** (`experimental_AstroContainer`) : tests plus rapides et sans build, mais API expérimentale qui peut casser à chaque version d'Astro.
- **Storybook** : pas de prise en charge officielle de `.astro` ; le module communautaire `storybook-astro` (0.2.1) ne déclare pas Astro 7. Redevient pertinent si une librairie de composants Vue est partagée avec Overwatch.
- **Histoire** : peu utilisé (~0,11 M téléchargements/sem. contre ~35 M pour Storybook), toujours en bêta.
- **Chromatic** : payant.

## Conséquences

- Aucune API expérimentale dans la chaîne de test ; ce qui est testé est exactement ce qui est publié.
- Les tests de composants exigent un build : ils sont dans `pnpm verify`, pas dans `verify:fast` (0005). La boucle courte d'un agent sur un composant passe par Playwright ciblé (`playwright test X.spec.ts`).
- Les captures de référence ne se régénèrent que dans Docker ; une mise à jour de Playwright ou des polices les invalide toutes.
- Le nombre de captures croît avec états × largeurs × thèmes.
