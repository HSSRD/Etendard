# Pi : recevoir et servir Étendard

Prépare le Pi au déploiement décrit dans les ADR 0002 et 0006 (ticket #4). Le workflow `deploy.yml` (#5) y dépose le site à chaque merge ; ses secrets se saisissent comme indiqué dans [FONCTIONNEMENT.md](FONCTIONNEMENT.md#les-secrets-de-lenvironment-production). Ces fichiers seront repris dans `HSSRD/infra` (Ansible).

Ce qui est en place et pourquoi : [FONCTIONNEMENT.md](FONCTIONNEMENT.md). Ce README ne donne que les étapes.

| Fichier | Rôle |
| --- | --- |
| `install.sh` | Installation root, idempotente : Caddy, utilisateur `deploy`, `/srv/etendard`, `etendard-receive`, clé à commande forcée |
| `Caddyfile` | Caddy sur `127.0.0.1:8080` uniquement, racine `/srv/etendard/current`, pages sans extension, page 404, en-têtes de sécurité, cache de `/_expo/static/`, des pages HTML et de `version.txt`, journal d'accès |
| `etendard-receive` | Seule commande de la clé de déploiement : réception (stdin), `rollback`, `restore <sha>`, `status` |
| `verify.sh` | Preuves des critères 1 à 5 du ticket #4, des en-têtes et du journal (#25), du cache de `/_expo/static/` (#36), des pages HTML et de `version.txt` (#52), de HSTS sur le domaine public (#41), des pages sans extension (#106), de la page 404 (#114) |
| `tailscale-policy.hujson`, `tailscale-checklist.md` | Critères 6 et 7 |
| `test/etendard-receive.test.sh` | Tests locaux du script (archives saines et piégées) |
| `test/verify-hsts.test.sh` | Tests locaux de `verify.sh hsts`, avec un faux `curl` |

## Ordre des étapes

1. **Tailscale, étapes 1 à 3** de `tailscale-checklist.md` : trouver le workflow des nœuds `github-runnervm…`, les supprimer, vérifier que Tailscale SSH est coupé sur le Pi.
2. **Sur le PC**, créer la clé de déploiement (la clé privée va dans le secret `DEPLOY_SSH_KEY`) :
   ```bash
   ssh-keygen -t ed25519 -N '' -C github-deploy -f ~/.ssh/github-deploy
   ```
3. **Copier ce dossier et la clé publique sur le Pi**, puis installer (à refaire après chaque modification de ce dossier, `Caddyfile` compris, car `deploy.yml` ne livre que le site) :
   ```bash
   tar -czf - -C infra/pi . | ssh <login>@<ip-du-pi> "mkdir -p etendard-pi && tar -xzf - -C etendard-pi"
   scp ~/.ssh/github-deploy.pub <login>@<ip-du-pi>:etendard-pi/
   ssh -t <login>@<ip-du-pi> 'cd ~/etendard-pi && sudo bash install.sh github-deploy.pub'
   ```
4. **Preuves côté Pi** (critères 1 à 3, verrou, en-têtes, journal et cache, Sentry intact) :
   ```bash
   ssh -t <login>@<ip-du-pi> 'cd ~/etendard-pi && sudo bash verify.sh pi'
   ```
5. **Preuves côté PC** (critères 1, 4 et 5), dans le bash de Git :
   ```bash
   HOST=<hote-du-pi> FLO=<login>@<ip-du-pi> bash infra/pi/verify.sh ssh
   ```
   Puis à la main : `ssh -L 8080:127.0.0.1:8080 <login>@<ip-du-pi>` et http://localhost:8080 affiche « Page de test e7e7e7a ».
6. **Tailscale, étapes 4 à 6** : politique `tag:ci` (critère 7 vérifié par le bloc `tests` à l'enregistrement), client OAuth ou fédération d'identité.
7. Coller les sorties des étapes 4 à 6 dans le ticket, après avoir remplacé le nom du Pi, ses adresses, ton login et ton identifiant Tailscale par `<hote-du-pi>`, `<ip-du-pi>`, `<login>`… : le repo est public (#31).

## À la mise en ligne : HSTS chez Cloudflare

À faire par Flo une fois le domaine choisi et le site servi par Cloudflare (ticket #41). La valeur et ses raisons sont dans [FONCTIONNEMENT.md](FONCTIONNEMENT.md#les-en-têtes-de-sécurité-25).

1. **Vérifier d'abord** que le site répond en HTTPS sur le domaine, page et 404 comprises : HSTS interdit ensuite tout retour au HTTP pendant un an.
2. **Dans le tableau de bord Cloudflare**, sur le domaine : SSL/TLS > Edge Certificates > HTTP Strict Transport Security (HSTS) > Enable HSTS, puis :
   - Enable HSTS (Strict-Transport-Security) : activé ;
   - Max Age Header (max-age) : 12 months ;
   - Apply HSTS policy to subdomains (includeSubDomains) : désactivé ;
   - Preload : désactivé ;
   - No-Sniff Header : désactivé (Caddy envoie déjà `X-Content-Type-Options`, #25).
3. **Prouver**, dans le bash de Git, en remplaçant `<domaine>` par le nom qui sert le site, seul (sans `https://` ni `/`, et sous sa forme `xn--…` s'il a des accents) :
   ```bash
   bash infra/pi/verify.sh hsts <domaine>
   ```
   Le bilan doit être `4 ✅, 0 ❌` : `/` répond 200, une page absente 404, et les deux portent l'en-tête. Si l'en-tête manque, attendre une minute (propagation chez Cloudflare) et relancer. Sans `includeSubDomains`, HSTS vaut pour un seul nom : si un autre nom (`www` ou le domaine nu) redirige vers le site, vérifier aussi que sa redirection porte l'en-tête : `curl -sSI https://<autre nom>/`.
4. Coller la sortie dans le ticket #41, puis le fermer.

## Tester `etendard-receive` sans le Pi

```bash
bash infra/pi/test/etendard-receive.test.sh
```

Dans ce repo, `pnpm test:infra` le lance aussi, y compris depuis PowerShell : le script prend lui-même le bash de Git. `pnpm verify` l'exécute aussi, et donc la CI, qui utilise le vrai `flock` (Linux).

Le préfixe des chemins se change avec `ETENDARD_ROOT` (défaut `/srv/etendard`). Sous Windows, le test simule `flock`, absent du bash de Git ; sur le Pi, le vrai verrou est vérifié par `verify.sh`.
