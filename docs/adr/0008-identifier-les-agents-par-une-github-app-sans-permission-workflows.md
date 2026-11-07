# 0008. Identifier les agents par la GitHub App `hssrd-bot`, sans permission `workflows`

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Les agents ouvrent des PR, commentent et étiquettent des tickets (0010). Avec le compte de Flo, il ne pourrait pas approuver ses propres PR et l'historique ne distinguerait pas le travail humain de celui des agents. Avec le `GITHUB_TOKEN` d'Actions, les événements produits ne déclenchent pas d'autres workflows (comportement documenté par GitHub) : une PR ouverte par un agent ne lancerait pas `ci.yml`.

## Décision

- Créer une **GitHub App `hssrd-bot`** installée sur le repo, utilisée par tous les workflows d'agents via un jeton d'installation (`actions/create-github-app-token`, transmis à `claude-code-action` par son entrée `github_token`).
- Permissions : `contents: write`, `pull-requests: write`, `issues: write`, métadonnées en lecture. **Pas de permission `workflows`** : un push modifiant `.github/workflows/` est refusé par GitHub, l'agent ne peut pas s'accorder de droits.
- Les PR d'agents sont assignées à Flo, qui les relit et les merge.

## Alternatives écartées

- **Compte de Flo (jeton personnel)** : pas d'auto-approbation possible, historique mélangé, jeton aux droits trop larges.
- **`GITHUB_TOKEN` seul** : ne déclenche pas la CI sur les PR créées.
- **Compte machine GitHub** : un compte utilisateur de plus à gérer, permissions moins fines qu'une App.

## Conséquences

- La clé privée de l'App est un secret des workflows d'agents ; elle ne donne jamais accès à l'Environment `production` (0011).
- Toute modification de workflow passe par Flo.
- L'App n'a aucune exception dans la protection de `main`.
