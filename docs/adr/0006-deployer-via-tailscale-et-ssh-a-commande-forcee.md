# 0006. Déployer par GitHub Actions, Tailscale et SSH à commande forcée, avec rollback automatique

- Statut : Proposé
- Date : 2026-11-07

## Contexte

Chaque merge sur `main` doit être déployé sur le Pi (0002) sans action humaine, sans ouvrir de port et sans donner à la CI d'accès au réseau des caméras. Le repo est public.

## Décision

Workflow `deploy.yml`, déclenché au push sur `main` et par `workflow_dispatch` (rollback manuel), `concurrency: production` :

1. Job `build` : `pnpm verify` (0005), écriture de `dist/version.txt` (SHA du commit), archive `.tar.gz` + `SHA256SUMS`, GitHub Release avec notes générées.
2. Job `deploy`, dans le GitHub Environment `production` (secrets accessibles seulement depuis `main`) :
   - `tailscale/github-action` : nœud éphémère `tag:ci` ;
   - téléchargement de l'archive et vérification SHA-256 ;
   - `ssh deploy@pi-etendard < archive` ;
   - test de fumée : `https://<domaine>/version.txt` doit valoir le SHA déployé ;
   - en cas d'échec : `ssh deploy@pi-etendard restore <sha servi avant l'envoi>` (#54) ;
   - notification dans tous les cas (canal à trancher).

Côté Pi :
- Clé SSH à commande forcée : `command="/usr/local/bin/etendard-receive",restrict`. Même volée, elle ne donne aucun shell.
- `etendard-receive` : extraction dans `/srv/etendard/releases/<sha>/`, bascule atomique du lien `current`, conservation des 5 dernières versions (et de celle remplacée), arguments `rollback` (manuel) et `restore <sha>` (automatique, #54).
- **ACL Tailscale** : `tag:ci` ne joint que le Pi, port 22.

## Alternatives écartées

- **Image Docker sur GHCR** : inutile pour du statique.
- **Runner GitHub auto-hébergé sur le Pi** : sur un repo public, une PR de fork peut exécuter du code sur le Pi.
- **Le Pi tire les releases (timer systemd)** : non visible dans GitHub, non immédiat.

## Conséquences

- Aucun port entrant ; la CI n'atteint que le port 22 du Pi.
- Chaque déploiement est une Release traçable et rejouable.
- Secrets Tailscale et clé SSH à créer et à faire tourner par Flo.

## Points de vigilance

- **Tailnet déjà utilisé par la CI, constaté sur le Pi** (`florasp`, Tailscale 1.102.2) : `tailscale status` liste de nombreux nœuds `github-runnervm…`, hors ligne depuis 6 à 116 jours. Ces runners ne sont donc pas éphémères, sinon ils auraient été retirés. Ils sont visibles depuis le Pi, ce qui suggère qu'une règle ACL les autorise à l'atteindre, peut-être la règle par défaut « tout autorisé ». Avant 0006 : supprimer ces nœuds, rendre `tag:ci` éphémère, et limiter l'ACL à `tag:ci` → Pi port 22. Sinon, un runner atteint aussi les ports 5000 et 8000 de Sentry (0002).
- **Mots de passe SSH acceptés, constaté** : le Pi propose `publickey,password`. La clé à commande forcée ne protège que si l'utilisateur `deploy` n'a pas de mot de passe et si `PasswordAuthentication no` est appliqué.
- **Test de fumée et cache Cloudflare** : `version.txt` est lu à travers Cloudflare. S'il est mis en cache, le test lit l'ancien SHA et déclenche un rollback à tort. Il faut servir `version.txt` avec `Cache-Control: no-store` et vérifier que Cloudflare le respecte.
- **Authentification Tailscale sans secret long** : `tailscale/github-action` (v4.4.0) accepte une entrée `audience` (fédération d'identité, à confirmer dans la doc Tailscale), qui éviterait de stocker un secret OAuth.
