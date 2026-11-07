# 0007. Prévisualiser chaque PR sur Cloudflare Workers

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Flo valide les PR d'agents sans lancer le projet sur sa machine. Il lui faut une URL par PR. La production reste sur le Pi (0002), qui ne doit jamais recevoir de code non mergé : il héberge aussi Sentry.

## Décision

- Un Worker Cloudflare `etendard-preview`, avec fichiers statiques (assets), sert **uniquement** aux prévisualisations. La production n'y passe jamais.
- Pour chaque PR, `ci.yml` téléverse le `dist/` construit par `wrangler versions upload --preview-alias pr-<numéro>`. Chaque PR obtient ainsi une URL stable, `pr-<numéro>-etendard-preview.<sous-domaine>.workers.dev`, mise à jour à chaque push. L'URL est postée dans la PR.
- Le job de publication est **séparé** : il reçoit l'artefact déjà construit et ne fait que le téléverser, sans exécuter de script du repo (0011). Le jeton Cloudflare est limité à ce Worker.
- Pages servies avec `X-Robots-Tag: noindex`.
- Les captures et GIF des scénarios de démonstration (0010) sont publiés avec la prévisualisation, plutôt que dans Git.

## Alternatives écartées

- **Cloudflare Pages** : fonctionne, mais la doc Cloudflare indique « Start new projects with Workers » (vérifié le 2026-11-07).
- **Prévisualisation sur le Pi** : exposerait du code non relu sur la machine qui héberge Sentry.
- **Aucune prévisualisation** (archive à télécharger) : une action humaine de plus à chaque PR.
- **Netlify, Vercel** : un fournisseur de plus alors que Cloudflare est déjà utilisé pour le tunnel (0002).

## Conséquences

- Un compte Cloudflare (le même que pour le tunnel) et un jeton d'API dans les secrets de la CI.
- Les PR venant de forks n'ont pas accès aux secrets : pas de prévisualisation pour elles.
- Les URL de version sont publiques par défaut (doc Cloudflare). Les restreindre (Cloudflare Access) est possible si une PR doit rester privée.

## Points de vigilance

- **Vérifié dans la doc Cloudflare** : `wrangler versions upload` renvoie une URL par version, et `--preview-alias` crée une URL stable `<alias>-<worker>.<sous-domaine>.workers.dev`. Reste à valider en écrivant `ci.yml` : comportement du Worker sans déploiement de production, et nettoyage des alias des PR fermées.
