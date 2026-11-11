# Pi `florasp` : ce qui est en place et pourquoi

Ce document explique la préparation du Pi faite au ticket #4 (PR #7). Pour l'installer ou la refaire, suis le [README](README.md). Les décisions de fond sont dans les ADR [0002](../../docs/adr/0002-heberger-sur-le-pi-avec-caddy-et-cloudflare-tunnel.md) (hébergement) et [0006](../../docs/adr/0006-deployer-via-tailscale-et-ssh-a-commande-forcee.md) (déploiement).

## Le but

À chaque merge sur `main`, GitHub Actions doit déposer la nouvelle version du site sur le Pi. Ce dépôt passe par le workflow `deploy.yml` de #5, décrit plus bas. Deux contraintes :

- **la CI ne doit jamais avoir de terminal sur le Pi.** Le repo est public : un workflow compromis ne doit rien pouvoir faire d'autre que livrer le site ;
- **le Pi héberge aussi Sentry** (caméra, ports 5000 et 8000). La CI ne doit pas pouvoir l'atteindre.

## Le trajet d'un déploiement

```
GitHub Actions (nœud éphémère tag:ci)
   │  Tailscale : tag:ci ne joint que florasp, port 22
   ▼
sshd du Pi ── clé github-deploy ──▶ commande forcée : /usr/local/bin/etendard-receive
                                       │  contrôle l'archive, l'extrait dans releases/<sha>/
                                       │  bascule le lien current
                                       ▼
                         /srv/etendard/current ──▶ Caddy (127.0.0.1:8080)
```

Pour l'instant, personne d'autre que le Pi ne voit le site. Flo le consulte par un tunnel SSH : `ssh -L 8080:127.0.0.1:8080 flo@192.168.1.41`, puis http://localhost:8080. La publication sur Internet viendra avec Cloudflare Tunnel, dans un autre ticket.

## Quatre protections, chacune utile si une autre lâche

| Protection | Ce qu'elle empêche | Où |
|---|---|---|
| **Tailscale** : `tag:ci` ne joint que `florasp:22` | une machine de CI qui atteindrait Sentry, tes autres appareils ou un autre port | `tailscale-policy.hujson` |
| **Clé à commande forcée** : `command="…etendard-receive",restrict` | un terminal, une autre commande, sftp, un tunnel | `~deploy/.ssh/authorized_keys` |
| **Utilisateur `deploy`** : sans mot de passe, sans sudo, sans groupe | toute action hors de `/srv/etendard` | `install.sh` |
| **`etendard-receive`** : contrôle de l'archive avant extraction | qu'une archive piégée écrive hors de son dossier ou fasse servir un fichier du système | `etendard-receive` |

## Les éléments, un par un

### Caddy, le serveur web

Caddy lit les fichiers de `/srv/etendard/current` et les renvoie au navigateur. Le site Astro est statique : ni Node ni base de données à faire tourner, juste des fichiers à servir.

- **Il écoute sur `127.0.0.1:8080` uniquement.** Ni le réseau local ni le tailnet ne le joignent. Plus tard, Cloudflare Tunnel se branchera sur cette même adresse, sans ouvrir de port sur la box.
- **`admin off` et `auto_https off`.** Par défaut, Caddy ouvre aussi une API d'administration (port 2019) et des écoutes sur les ports 80 et 443. Ces options les suppriment. En contrepartie, un changement de configuration s'applique par `systemctl restart caddy` : `reload` ne fonctionne plus.
- **Le paquet vient du dépôt apt officiel de Caddy.** Le `Caddyfile` est écrit *avant* l'installation, pour que Caddy ne démarre jamais avec la configuration par défaut du paquet (qui écoute sur le port 80 de toutes les interfaces).

#### Les en-têtes de sécurité (#25)

Caddy les ajoute à chaque réponse, pages d'erreur comprises :

| En-tête | Valeur | Ce qu'il empêche |
|---|---|---|
| `Content-Security-Policy` | voir ci-dessous | qu'un contenu injecté dans la page (script, style, formulaire) soit exécuté ou envoyé ailleurs |
| `X-Content-Type-Options` | `nosniff` | que le navigateur devine le type d'un fichier et exécute comme script ce qui n'en est pas un |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | qu'un site lié (GitHub) reçoive l'adresse complète de la page : il ne voit que le domaine |
| `Permissions-Policy` | chaque fonction listée, coupée : `camera=()`… | que la page, ou un contenu injecté, demande l'accès à la caméra, à la position, au micro, au paiement ou à l'USB |

La CSP, directive par directive :

- `default-src 'none'` : tout est interdit par défaut, scripts compris. Le site n'envoie aucun JavaScript ;
- `style-src 'self'` : seulement les feuilles de style du site. Astro les écrit dans des fichiers `/_astro/*.css` et non dans un `<style>` de la page (`astro.config.mjs`), ce qui évite `'unsafe-inline'` ;
- `img-src 'self'` : seulement les images du site ;
- `media-src 'self'` : seulement les vidéos, sons et sous-titres du site (aujourd'hui, la vidéo de bienvenue de la section d'accueil) ;
- `base-uri 'none'` et `form-action 'none'` : pas de `<base>` qui détournerait les liens, ni de formulaire qui enverrait des données ;
- `frame-ancestors 'none'` : aucun site ne peut afficher Étendard dans un cadre (protection contre le *clickjacking*).

La CSP n'est écrite que dans le `Caddyfile`. `tests/csp.spec.ts` l'y lit, sert la one page avec, et échoue si le navigateur bloque une ressource au chargement ou si les styles ne s'appliquent pas. Une nouvelle ressource (police, image externe, Cloudflare Web Analytics) se déclare donc d'abord dans le `Caddyfile`, et `pnpm verify` le rappelle. Le test ne voit que la page servie par le Pi : ce que Cloudflare injecterait en route (analytics, détection de bots) sera à autoriser avec la mise en ligne.

**Le `Caddyfile` ne part pas avec le site.** `deploy.yml` ne livre que les fichiers du site ; le `Caddyfile` s'applique en relançant `install.sh` sur le Pi (étape 3 du [README](README.md)). Une PR qui change la CSP pour une nouvelle ressource doit donc être appliquée sur le Pi au moment du merge, sinon le Pi bloque cette ressource. `verify.sh pi` compare le `Caddyfile` installé et les en-têtes servis à la copie du dossier copié sur le Pi : il ne voit l'écart avec le repo que si ce dossier a été recopié.

**HSTS est posé par Cloudflare, pas par Caddy.** HSTS engage tout le domaine en HTTPS ; c'est Cloudflare qui détient ce domaine et son certificat, et le HTTPS des visiteurs s'y termine (ADR 0002). Cloudflare répond aussi seul, par exemple avec sa page d'erreur quand le Pi est éteint : un HSTS posé par Caddy y manquerait. Il s'active dans le tableau de bord Cloudflare (SSL/TLS > Edge Certificates > HSTS), avec la mise en ligne et le domaine.

#### Le cache des fichiers `/_astro/` (#36)

Astro écrit les feuilles de style dans `/_astro/`, sous un nom qui contient une empreinte de leur contenu : `BaseLayout.CIdr1MYV.css`. Caddy les sert avec `Cache-Control: public, max-age=31536000, immutable`. Le navigateur et Cloudflare les gardent donc un an, sans jamais les redemander, et la feuille de style, qui bloque l'affichage, ne fait plus l'aller-retour Cloudflare, tunnel, Pi en Wi-Fi à chaque visite.

**Ce cache est sans risque.** Un fichier de `/_astro/` ne change jamais de contenu : si le CSS change, l'empreinte change, donc le nom aussi. La nouvelle page HTML pointe vers ce nouveau nom, que personne n'a encore en cache. L'ancien fichier reste en cache, mais plus aucune page ne le demande. Les autres fichiers (`/`, la vidéo, `favicon.svg`, `version.txt`) gardent un nom fixe : ils n'ont pas cet en-tête, sinon une nouvelle version mettrait jusqu'à un an à arriver.

**Seules les réponses 2xx et 304 le portent.** Une 404 sur `/_astro/` n'est pas gardée un an : sans cela, un fichier absent un instant, puis rendu par un rollback, resterait introuvable pour ce visiteur ou derrière Cloudflare.

`verify.sh pi` le contrôle sur un fichier réel de `/_astro/`.

#### Le journal d'accès

Caddy écrit chaque requête, en JSON, dans `/var/log/caddy/etendard-access.log`. À 10 Mio, le fichier est renommé et compressé ; Caddy garde les 4 derniers. Le journal occupe donc au plus 50 Mio sur la carte SD. Il appartient à l'utilisateur `caddy`, sous lequel tourne le service : `install.sh` lui rend le dossier après `caddy validate`, qui, lancé en root, crée le fichier s'il n'existe pas.

Le journal contient l'adresse IP des visiteurs et les en-têtes de leurs requêtes ; Caddy supprime un fichier archivé 90 jours après son archivage (sa valeur par défaut). L'archivage n'ayant lieu qu'à 10 Mio, une ligne peut rester bien plus longtemps sur un site peu visité. Derrière Cloudflare Tunnel, l'IP enregistrée sera `127.0.0.1` et la vraie dans l'en-tête `Cf-Connecting-Ip` : à régler avec la mise en ligne.

Pour le lire : `sudo tail -F /var/log/caddy/etendard-access.log`.

### L'utilisateur `deploy`

- **Mot de passe `*`** : aucun mot de passe ne peut correspondre, mais la connexion par clé reste possible. Avec `!`, `sshd` pourrait considérer le compte comme verrouillé, et la clé serait refusée.
- **Shell `/bin/sh`** : `sshd` lance la commande forcée par le shell de l'utilisateur. Avec `nologin`, elle ne s'exécuterait jamais.
- **Aucun groupe secondaire et aucun sudo** : il ne peut écrire que dans `/srv/etendard`, qui lui appartient.

### La clé de déploiement

Elle s'appelle `github-deploy`. La clé privée est sur le PC de Flo et dans le secret `DEPLOY_SSH_KEY` de l'environnement `production`. Côté Pi, `authorized_keys` contient une seule ligne :

```
command="/usr/local/bin/etendard-receive",restrict ssh-ed25519 AAAA… github-deploy
```

- `command=` : quoi que demande le client, c'est `etendard-receive` qui s'exécute. Ce que le client a demandé arrive dans la variable `SSH_ORIGINAL_COMMAND`.
- `restrict` : pas de terminal, pas de redirection de port, pas d'agent SSH, pas d'X11.
- Le fichier et le dossier `.ssh` **appartiennent à root** : `deploy` ne peut pas s'ajouter une autre clé.

### `etendard-receive`, la seule porte d'entrée

Le script n'accepte que trois demandes. Tout le reste est refusé.

| Demande | Effet |
|---|---|
| aucune, archive sur l'entrée standard : `ssh deploy@florasp < site.tar.gz` | publie une nouvelle version |
| `rollback` | revient à la version publiée juste avant celle servie |
| `status` | affiche le SHA servi |

Une publication se déroule ainsi :

1. **Verrou `flock`.** Si un déploiement est déjà en cours, la demande est refusée tout de suite, ce qui évite que deux merges rapprochés se mélangent. `status` reste possible pendant ce temps.
2. **Contrôle de l'archive, avant toute extraction.** Le script refuse :
   - un chemin absolu ;
   - un `..` ;
   - un lien symbolique, un lien physique ou un fichier spécial.

   Un lien pourrait faire servir `/etc/passwd` par Caddy. Un `..` permettrait d'écrire hors du dossier.
3. **Extraction**, avec des droits remis à plat : lecture pour tous, écriture pour `deploy` seul.
4. **Lecture de `version.txt`**, validé par `^[0-9a-f]{7,40}$`, c'est-à-dire un SHA git. Ce SHA devient le nom du dossier `releases/<sha>`, d'où cette rigueur.
5. **Bascule atomique** : le lien `current.tmp` est renommé en `current`. Caddy sert l'ancienne version ou la nouvelle, jamais un état intermédiaire.
6. **Ménage** : les 5 versions les plus récentes sont gardées, et celle qui est servie n'est jamais supprimée.

En cas d'erreur, rien ne change : le dossier temporaire est supprimé et `current` ne bouge pas.

L'ordre des versions repose sur leur date de publication, c'est-à-dire la date de modification du dossier, que le script met à jour. Ne modifie donc pas les dossiers de `releases/` à la main.

### Tailscale

**État constaté au départ :**
- la politique était celle par défaut, où tout le monde joint tout ;
- de nombreux nœuds `github-runnervm…` traînaient dans le tailnet. Ils venaient des workflows de **Sentry et d'Overwatch** et pouvaient joindre Sentry.

**Ce qui a été fait :**
- **Nœuds supprimés.**
- **Tailscale SSH coupé sur le Pi** (`RunSSH: false`). Sinon, il répondrait lui-même sur le port 22 du tailnet, sans lire `authorized_keys` : la commande forcée serait contournée.
- **Politique** :
  - tes appareils gardent l'accès complet, comme avant ;
  - `tag:ci` ne joint que `florasp`, et seulement en `tcp:22`.
- **Tests dans la politique.** La console refuse d'enregistrer si l'un d'eux échoue :
  - `tag:ci` est refusé sur 5000, 8000, 8080, 80 et 443 ;
  - `Florianrcht@github` garde 22, 5000 et 8000.
- **Client OAuth `GitHubAction`**, avec une seule portée, `auth_keys`, et le tag `tag:ci`. Même s'il fuit, il ne peut créer que des machines `tag:ci`, donc limitées au port 22 du Pi. `tailscale/github-action` crée avec lui des nœuds éphémères, retirés du tailnet après chaque job.

Le dépôt contient une version générique de la politique, avec des valeurs `À_REMPLACER`. La version complétée (IP du Pi, identifiant de Flo) n'existe que dans la console.

## Le workflow `deploy.yml` (#5)

[`deploy.yml`](../../.github/workflows/deploy.yml) se lance à chaque push sur `main`, donc à chaque merge, et à la main par `workflow_dispatch`. `concurrency: production` empêche deux déploiements simultanés : le suivant attend la fin du précédent.

| Job | Ce qu'il fait | Droits |
|---|---|---|
| `build` | construit le site et son archive, avec `version.txt` (SHA du commit) | lecture du code |
| `deploy` | Environment `production` : envoie l'archive au Pi par le tailnet et vérifie la version servie | aucun droit GitHub |
| `release` | publie la Release `deploy-<sha court>`, seulement si `deploy` a réussi | écriture du code (tags, Releases) |
| `rollback` | seulement avec l'entrée `rollback` : revient à la version précédente | aucun droit GitHub |
| `message` | dans tous les cas : compose l'e-mail de résultat (#32), sans aucun secret | lecture du code et des PR |
| `notify` | Environment `production` : envoie cet e-mail par Brevo, sans exécuter de code du repo | aucun droit GitHub |

La Release est publiée par un job séparé, après le déploiement : le job `build` exécute les scripts du repo et ne reçoit donc qu'un jeton en lecture.

**Rollback automatique.** Si une étape échoue après la lecture de `status`, le job relit `status`. Il ne lance `rollback` que si la version servie a changé depuis : `rollback` revient à la version publiée avant celle servie, et le lancer alors que rien n'a changé ferait reculer le site d'une version de trop. Le job finit en échec dans tous les cas.

**Rollback manuel.** Actions > deploy > Run workflow, sur `main`, case `rollback` cochée. Ou :

```bash
gh workflow run deploy.yml -R HSSRD/Etendard --ref main -f rollback=true
```

Pour revenir ensuite à la dernière version, relance le workflow sans cocher la case : le site est reconstruit depuis `main`, le Pi réactive la version qu'il a déjà, et la Release existante est gardée telle quelle.

**E-mail de résultat (#32).** Après chaque déploiement ou rollback, réussi ou non, le job `message` lance [`scripts/deploy-notify.js`](../../scripts/deploy-notify.js), qui compose l'objet et le texte. Le job `notify` y ajoute les adresses avec `jq`, puis `curl` l'envoie par l'API transactionnelle de Brevo. Les deux jobs sont séparés pour la même raison que `release` : le job qui exécute les scripts du repo n'a accès à aucun secret. Objets possibles :

- `✅ <branche de la PR> déployé — <sha court>` ;
- `❌ <branche> : déploiement en échec, rollback effectué` (ou `, version précédente toujours servie` ; `, nouvelle version servie` si l'échec suit la bascule sans rollback ; `, version servie inconnue` si le Pi n'a pas répondu) ;
- `↩️ Rollback manuel effectué — <sha servi>`, ou `❌ Rollback manuel en échec — <sha servi>` (`, version servie inconnue` si le Pi n'a pas répondu).

La branche est celle de la PR mergée ; sans PR (push direct), c'est le titre du commit. Le corps donne la PR, le SHA complet, la version servie par le Pi, le lien de l'exécution et celui de la Release (ou son échec). Si l'API GitHub ne répond pas, l'e-mail part avec le SHA court à la place de la branche et « PR : non lue ». Un envoi raté, ou des secrets absents, laisse un avertissement dans le journal sans changer le résultat du déploiement. Pour voir l'e-mail sans l'envoyer : `GITHUB_REPOSITORY=HSSRD/Etendard GITHUB_SHA=<sha> DEPLOY_RESULT=success node scripts/deploy-notify.js --a-blanc` (ajoute `GITHUB_RUN_ID` et `SERVI` pour des liens et une version servie réalistes).

**Vérification.** Tant que le site n'est pas public, elle passe par `status` et non par un test HTTPS de `version.txt` (écart temporaire à l'ADR 0006, levé à la mise en ligne).

### Les secrets de l'Environment `production`

L'Environment n'accepte que la branche `main` : un workflow lancé depuis une autre branche n'obtient pas ces secrets.

| Secret | Contenu |
|---|---|
| `TS_OAUTH_CLIENT_ID` | identifiant du client OAuth Tailscale `GitHubAction` |
| `TS_OAUTH_SECRET` | secret de ce client |
| `DEPLOY_SSH_KEY` | clé privée `github-deploy`, sur le PC de Flo |
| `DEPLOY_KNOWN_HOSTS` | clé d'hôte du Pi, au nom `florasp` utilisé par le workflow |
| `BREVO_API_KEY` | clé API Brevo, limitée si possible à l'envoi d'e-mails transactionnels |
| `NOTIFY_EMAIL_FROM` | adresse d'expéditeur, validée dans Brevo |
| `NOTIFY_EMAIL_TO` | adresse qui reçoit l'e-mail de résultat |

Pour les saisir ou les faire tourner, dans le bash de Git :

```bash
gh secret set TS_OAUTH_CLIENT_ID --env production -R HSSRD/Etendard   # colle la valeur
gh secret set TS_OAUTH_SECRET    --env production -R HSSRD/Etendard   # colle la valeur
gh secret set DEPLOY_SSH_KEY     --env production -R HSSRD/Etendard < ~/.ssh/github-deploy
ssh flo@192.168.1.41 cat /etc/ssh/ssh_host_ed25519_key.pub \
  | awk '{print "florasp", $1, $2}' \
  | gh secret set DEPLOY_KNOWN_HOSTS --env production -R HSSRD/Etendard
```

Les secrets Brevo se saisissent de la même façon, sans jamais écrire d'adresse dans le repo :

```bash
gh secret set BREVO_API_KEY     --env production -R HSSRD/Etendard   # colle la valeur
gh secret set NOTIFY_EMAIL_FROM --env production -R HSSRD/Etendard   # colle la valeur
gh secret set NOTIFY_EMAIL_TO   --env production -R HSSRD/Etendard   # colle la valeur
```

La clé d'hôte est lue sur le Pi lui-même, par le réseau local, plutôt que par `ssh-keyscan`, qui accepterait la réponse de n'importe quelle machine. Le workflow vérifie l'empreinte (`StrictHostKeyChecking yes`) : si le Pi est réinstallé, il faut refaire la dernière commande.

## Comment on sait que ça marche

- **`test/etendard-receive.test.sh`** : 38 tests locaux, sur des archives saines et piégées. Ils n'ont pas besoin du Pi.
- **`verify.sh pi`**, sur le Pi, et **`verify.sh ssh`**, depuis le PC : ils rejouent les critères du ticket et affichent ✅ ou ❌. Le 2026-11-07, le bilan était de 20/0 et 21/0. Les sorties complètes sont dans le ticket #4.
- **Tests Tailscale** : ils sont rejoués par la console à chaque modification de la politique.

Relance `verify.sh` après toute intervention sur le Pi : mise à jour système, réinstallation, changement de configuration SSH.

## Ce qui reste à faire, hors de ce ticket

- **Runners de Sentry et d'Overwatch** : s'ils rejoignent encore le tailnet avec une clé sans tag, Tailscale les traite comme tes appareils, avec un accès complet. Il faudra leur donner un tag dédié, avec ses propres règles.
- **Durcissement du Pi, avant toute publication** (ADR 0002) :
  - désactiver la connexion SSH par mot de passe ;
  - installer un pare-feu et les mises à jour automatiques ;
  - corriger Sentry, qui écoute sur toutes les interfaces ;
  - retirer CUPS, Avahi et le bureau ;
  - à terme, réinstaller un Pi dédié.
- **Ansible** : ces fichiers seront repris dans `HSSRD/infra`.
