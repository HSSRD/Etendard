# 0014. Modéliser le contenu en collections Astro validées par Zod

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Le cœur d'Étendard est la présentation des projets de HSSRD et de leurs sous-unités (Hussard → Overwatch, Sentry). Les fiches seront surtout écrites par des agents : une fiche incomplète ou mal liée doit être refusée au build, pas découverte en production.

## Décision

- **Collections de contenu** déclarées dans `src/content.config.ts`, schémas **Zod** (fourni par Astro) :
  - `projects` : projets et sous-unités, relation `units: reference('projects')` ;
  - `log` (journal de bord) et `hardware` (matériel référencé) : créées avec leur première entrée, pas avant.
- **Markdown** par défaut ; **MDX** (`@astrojs/mdx`) seulement quand une fiche a besoin d'un composant.
- Modèle de fiche dans `docs/templates/project.md`, utilisé par la skill `/nouveau-projet` (0012).
- Images via **`astro:assets`** (optimisées au build). Icônes SVG en ligne dans `src/icons/`.
- Générés au build : sitemap (`@astrojs/sitemap`), flux RSS (`@astrojs/rss`), images Open Graph (`satori` + `sharp`), **`/llms.txt`** (vitrine lisible par les IA).
- **Français seul** en v1. Routage i18n d'Astro configuré avec le français par défaut, sans préfixe : les URL actuelles restent valides si l'anglais arrive.
- Variables d'environnement typées avec `astro:env`.
- Recherche **Pagefind** (statique) ajoutée quand le nombre de projets le justifie.

## Alternatives écartées

- **CMS headless** : service à héberger ou à payer, contenu hors de Git, hors de portée des agents via PR.
- **JSON / YAML sans schéma** : erreurs découvertes à l'exécution.
- **Toutes les collections et Pagefind dès le départ** : code sans contenu, contraire à la règle « pas de surplus ».

## Conséquences

- Une fiche invalide ou une référence vers un projet inexistant fait échouer `pnpm verify` (0005).
- Ajouter un projet = un fichier Markdown + ses images, dans une PR.
- Changer un schéma impose de mettre à jour toutes les fiches existantes dans la même PR.
