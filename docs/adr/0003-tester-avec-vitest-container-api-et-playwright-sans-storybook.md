# 0003. Tester avec Vitest, la Container API et Playwright visuel, sans Storybook

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Exigence de Flo : zéro bug, zéro régression, chaque comportement des composants testé. Sur un site statique, les régressions sont surtout visuelles. Storybook ne prend pas en charge les composants `.astro` et délègue le test visuel à Chromatic (payant). Le remplacement de Storybook est accepté par Flo.

## Décision

| Niveau | Outil |
|---|---|
| Contenu | Schémas Zod (build) |
| Types | `astro check` |
| Composants `.astro` | Vitest 5 + Container API (`experimental_AstroContainer`) |
| Îles Vue | Vitest + `@vue/test-utils` |
| Visuel | Playwright `toHaveScreenshot` sur les pages `/styleguide`, 3 largeurs |
| Accessibilité | `@axe-core/playwright` (WCAG 2.2 AA) |
| Parcours | Playwright (navigation, liens, thème, 404) |
| HTML | `html-validate` sur `dist/` |
| Liens | `lychee` |
| Performance | Lighthouse CI (budgets : score ≥ 95, poids, JS max) |

- Chaque composant est un trio colocalisé : `X.astro`, `X.test.ts`, `src/pages/styleguide/x.astro`.
- Les pages `/styleguide` servent de catalogue ; elles ne sont construites que si `STYLEGUIDE=1`.
- Captures générées uniquement dans l'image Docker officielle de Playwright, animations désactivées.
- Pas d'objectif de couverture en pourcentage : chaque état visible a sa capture.

## Alternatives écartées

- **Storybook** : pas de prise en charge officielle de `.astro` ; le module communautaire `storybook-astro` (0.2.1) ne déclare pas Astro 7. Redevient pertinent si une librairie de composants Vue est partagée avec Overwatch.
- **Histoire** : peu utilisé (~0,11 M téléchargements/sem. contre ~35 M pour Storybook), toujours en bêta.
- **Chromatic** : payant.

## Conséquences

- Pas de catalogue interactif : le catalogue est un ensemble de pages statiques.
- Les captures de référence ne se régénèrent que dans Docker ; une mise à jour de Playwright ou des polices les invalide toutes.
- Le nombre de captures croît avec états × largeurs × thèmes.

## Points de vigilance

- **Container API expérimentale, vérifié** : la doc d'Astro indique qu'elle est « sujette à des changements cassants, même dans des versions mineures ou de correctif ». Toute montée de version d'Astro peut casser l'ensemble des tests de composants `.astro`. La rupture n'est pas silencieuse (la CI échoue), mais elle a un coût de maintenance ; voir 0013 pour l'exclure du merge automatique.
