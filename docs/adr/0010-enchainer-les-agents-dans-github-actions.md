# 0010. Enchaîner les agents dans GitHub Actions, du ticket au merge humain

- Statut : Proposé
- Date : 2026-11-07

## Contexte

**Choix de Flo** : le moins d'actions humaines possible. Les agents doivent tourner sans la machine de Flo. Chaque exécution Actions a sa propre machine virtuelle, ce qui rend les worktrees inutiles.

## Décision

Enchaînement : ticket d'une ligne (`idee`) → **agent rédacteur** (structure le ticket, pose ses questions, `a-preciser`) → Flo ajoute `pret` → **agent développeur** (un test Playwright par critère d'acceptation, puis le code, puis `pnpm verify`) → **agent relecteur neuf** → PR → CI → corrections via `@claude` → **merge par Flo** → déploiement (0006).

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `issue-label.yml` | `issues: opened` | Ajoute `idee` |
| `issue-refine.yml` | `issues: opened`, `issue_comment` sur `idee` / `a-preciser` | Rédacteur |
| `issue-implement.yml` | `issues: labeled` avec `pret` | Développeur + relecteur, ouvre la PR |
| `pr-feedback.yml` | commentaire contenant `@claude` | Corrections pendant la revue |
| `ci.yml` | `pull_request` | `pnpm verify`, captures, vidéos, prévisualisation (0007) |
| `deploy.yml` | `push` sur `main` | Déploiement (0006) |

- Outil : `anthropics/claude-code-action`, sous l'identité `hssrd-bot` (0008).
- `concurrency` par numéro de ticket ; `timeout-minutes` et nombre de tours maximum.
- Le **relecteur** ne reçoit que le ticket et le diff : chaque ligne doit se rattacher à un critère, le hors-périmètre est respecté, le surplus est retiré. S'il ajoute plus de 20 % de lignes, il s'arrête et le signale.
- La PR contient `Fixes #N`, les critères cochés avec leur test et une section « Ce que la relecture a retiré ».
- Échec de CI : l'agent lit les erreurs (`gh run view --log-failed`), corrige, puis pose `bloque` après N tentatives.
- Captures et vidéos produites **par la CI** (proposition de Claude, contraire à l'idée initiale de Flo : à confirmer), converties en GIF, affichées avant / après / différence dans un commentaire mis à jour.
- **Le merge reste toujours humain.** Jamais de merge automatique sur une PR d'agent.

## Alternatives écartées

- **Agents lancés en local uniquement** : dépend de la machine de Flo. Reste possible avec les mêmes skills (0012).
- **Merge automatique des PR d'agents** : supprime le seul contrôle avant production.

## Conséquences

- Actions humaines : écrire l'idée, ajouter `pret` (supprimable plus tard), merger.
- Chaque exécution consomme des minutes Actions (illimitées en repo public) et le quota Claude ou la clé API.

## Points de vigilance

- **Médias sur une branche orpheline `pr-media`** : sur un repo public, chaque GIF reste dans l'historique Git pour toujours et alourdit chaque clone complet. Les publier avec la prévisualisation de la PR (0007) éviterait d'écrire du binaire dans Git ; à évaluer.
- **Authentification de l'action, vérifié** : `claude-code-action` accepte `claude_code_oauth_token`, `anthropic_api_key` et des entrées de fédération d'identité (`anthropic_federation_rule_id`…). Avec l'abonnement, les agents en CI partagent le quota de Flo : un agent qui boucle peut bloquer son usage interactif.
