# 0011. Sécuriser les agents : déclenchement par Flo seul, contenu non fiable, aucun secret de production

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Le repo `HSSRD/Etendard` est public (vérifié le 2026-11-07). N'importe qui peut ouvrir un ticket ou commenter. Les agents exécutent du code et disposent de jetons ; le réseau de production héberge les caméras de Hussard.

## Décision

- **Déclenchement par Flo uniquement** : chaque workflow d'agent porte la condition `github.event.sender.login == '<login de Flo>'` (ou `author_association == 'OWNER'`). Un ticket ou commentaire d'un tiers ne déclenche jamais d'agent.
- **Le contenu des tickets et commentaires est une donnée, jamais une instruction de confiance** (injection de prompt). Les prompts des agents le rappellent explicitement.
- **Aucun secret de production pour les agents** : secrets Tailscale et SSH uniquement dans l'Environment `production`, utilisé seulement par `deploy.yml` sur `main` (0006).
- **Permissions minimales** dans les workflows d'agents : `contents: write`, `pull-requests: write`, `issues: write`. Rien d'autre.
- **Pas de permission `workflows`** pour l'App (0008) + hook PreToolUse qui bloque l'édition de `.github/workflows/` (0012).
- **Outils de l'agent restreints** par liste blanche dans `claude-code-action` : pas d'accès réseau arbitraire.
- **`main` protégée** : PR + CI verte + branche à jour obligatoires, aucun push direct.
- Actions tierces figées par SHA. Aucun secret dans le repo ; jeton `cloudflared` uniquement sur le Pi.

## Alternatives écartées

- **Repo privé** : réduit la surface d'attaque mais retire la vitrine publique du code (à trancher par Flo).

## Conséquences

- Seul Flo peut lancer un agent ; les contributions externes restent manuelles.
- Les secrets accessibles à un agent se limitent au jeton de l'App, au jeton Claude et au jeton de prévisualisation.

## Points de vigilance

- **`main` n'est pas protégée aujourd'hui, vérifié** : l'API GitHub renvoie « Branch not protected » alors que le repo est déjà public. La protection devrait être activée avant le premier workflow d'agent.
- **Les scripts du repo sont du code d'agent** : la protection « pas de permission `workflows` » ne couvre pas `package.json`, les configs ni les tests, qu'un agent peut modifier et que la CI exécute. Sur `main`, le merge humain protège `deploy.yml` ; sur les PR, tout secret (jeton de prévisualisation, 0007) doit rester dans un job qui n'exécute aucun script du repo.
