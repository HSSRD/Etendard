# 0007. Prévisualiser chaque PR sur Cloudflare Pages

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Flo valide les PR d'agents sans lancer le projet sur sa machine. Il lui faut une URL par PR. La production reste sur le Pi (0002), qui ne doit pas recevoir de code non mergé.

## Décision

- `ci.yml` publie le `dist/` de chaque PR sur **Cloudflare Pages** (prévisualisations uniquement), en `noindex`.
- L'URL est postée dans la PR.
- La production n'utilise jamais Cloudflare Pages.

## Alternatives écartées

- **Prévisualisation sur le Pi** : exposerait du code non relu sur la machine du réseau domestique.
- **Aucune prévisualisation** : Flo devrait lancer le site en local, contraire à l'objectif de minimiser les actions humaines.

## Conséquences

- Un compte Cloudflare et un jeton d'API (limité à Pages) dans les secrets de la CI.
- Les PR venant de forks n'ont pas accès aux secrets : pas de prévisualisation pour elles.

## Points de vigilance

- **Cloudflare oriente vers Workers, vérifié** : la page d'accueil de la doc Pages indique « Start new projects with Workers » et propose un guide de migration. Pages fonctionne toujours, mais un projet neuf aurait intérêt à évaluer les assets statiques de Workers et leurs URL de prévisualisation par version. À trancher avant d'écrire `ci.yml`.
- **Jeton Cloudflare et code d'agent** : publier depuis un job séparé qui ne fait que téléverser l'artefact construit, sans exécuter de script du repo ; sinon un agent pourrait lire le jeton en modifiant `package.json` (0011).
