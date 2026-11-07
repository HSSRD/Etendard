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
   - en cas d'échec : `ssh deploy@pi-etendard rollback` ;
   - notification dans tous les cas (canal à trancher).

Côté Pi :
- Clé SSH à commande forcée : `command="/usr/local/bin/etendard-receive",restrict`. Même volée, elle ne donne aucun shell.
- `etendard-receive` : extraction dans `/srv/etendard/releases/<sha>/`, bascule atomique du lien `current`, conservation des 5 dernières versions, argument `rollback`.
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

- **Test de fumée et cache Cloudflare** : `version.txt` est lu à travers Cloudflare. S'il est mis en cache, le test lit l'ancien SHA et déclenche un rollback à tort. Il faut servir `version.txt` avec `Cache-Control: no-store` et vérifier que Cloudflare le respecte.
- **Authentification Tailscale sans secret long** : `tailscale/github-action` (v4.4.0) accepte un `audience` en plus d'`oauth-client-id` / `oauth-secret`, ce qui suggère une fédération d'identité OIDC. Si elle couvre ce cas, elle évite de stocker un secret OAuth. À confirmer dans la doc Tailscale.
