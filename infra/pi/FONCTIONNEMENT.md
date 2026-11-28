# Pi : ce qui est en place et pourquoi

Ce document explique la préparation du Pi faite au ticket #4 (PR #7), son durcissement (#113) et sa mise en ligne par Cloudflare Tunnel (#125). Pour l'installer ou la refaire, suis le [README](README.md). Les décisions de fond sont dans les ADR [0002](../../docs/adr/0002-heberger-sur-le-pi-avec-caddy-et-cloudflare-tunnel.md) (hébergement) et [0006](../../docs/adr/0006-deployer-via-tailscale-et-ssh-a-commande-forcee.md) (déploiement).

## Le but

À chaque merge sur `main`, GitHub Actions doit déposer la nouvelle version du site sur le Pi. Ce dépôt passe par le workflow `deploy.yml` de #5, décrit plus bas. Deux contraintes :

- **la CI ne doit jamais avoir de terminal sur le Pi.** Le repo est public : un workflow compromis ne doit rien pouvoir faire d'autre que livrer le site ;
- **le Pi héberge aussi d'autres services.** La CI ne doit pas pouvoir les atteindre.

## Le trajet d'un déploiement

```
GitHub Actions (nœud éphémère tag:ci)
   │  Tailscale : tag:ci ne joint que le Pi, port 22
   ▼
sshd du Pi ── clé github-deploy ──▶ commande forcée : /usr/local/bin/etendard-receive
                                       │  contrôle l'archive, l'extrait dans releases/<sha>/
                                       │  bascule le lien current
                                       ▼
                         /srv/etendard/current ──▶ Caddy (127.0.0.1:8080)
```

Le public, lui, passe par Cloudflare Tunnel (#125, [plus bas](#cloudflare-tunnel-125)) : `https://<domaine>` → Cloudflare → `cloudflared` sur le Pi → Caddy. Avant la mise en ligne, Flo consulte le site par un tunnel SSH : `ssh -L 8080:127.0.0.1:8080 <login>@<ip-du-pi>`, puis http://localhost:8080.

## Quatre protections, chacune utile si une autre lâche

| Protection | Ce qu'elle empêche | Où |
|---|---|---|
| **Tailscale** : `tag:ci` ne joint que le port 22 du Pi | une machine de CI qui atteindrait les autres services du Pi, tes autres appareils ou un autre port | `tailscale-policy.hujson` |
| **Clé à commande forcée** : `command="…etendard-receive",restrict` | un terminal, une autre commande, sftp, un tunnel | `~deploy/.ssh/authorized_keys` |
| **Utilisateur `deploy`** : sans mot de passe, sans sudo, sans groupe | toute action hors de `/srv/etendard` | `install.sh` |
| **`etendard-receive`** : contrôle de l'archive avant extraction | qu'une archive piégée écrive hors de son dossier ou fasse servir un fichier du système | `etendard-receive` |

## Les éléments, un par un

### Caddy, le serveur web

Caddy lit les fichiers de `/srv/etendard/current` et les renvoie au navigateur. Le site exporté par Expo est statique : ni Node ni base de données à faire tourner, juste des fichiers à servir.

- **Il écoute sur `127.0.0.1:8080` uniquement.** Ni le réseau local ni le tailnet ne le joignent. Cloudflare Tunnel s'y branche (#125), sans ouvrir de port sur la box.
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

- `default-src 'none'` : tout est interdit par défaut ;
- `script-src 'self'` : seulement les scripts du site, ceux d'Expo et de React Native Web (ADR 0015). Aucun script en ligne : `scripts/export-web.js` sort en fichiers ceux qu'Expo écrit dans la page ;
- `style-src 'self'` : seulement les feuilles de style du site. `scripts/export-web.js` sort aussi en fichiers les `<style>` de la page, et les composants n'écrivent aucun attribut `style` (tout passe par `StyleSheet.create`, compilé en classes), ce qui évite `'unsafe-inline'`. React Native Web ajoute ses règles par le CSSOM, que la CSP ne bloque pas ;
- `img-src 'self'` : seulement les images du site ;
- `media-src 'self'` : seulement les vidéos, sons et sous-titres du site (aujourd'hui, la vidéo de bienvenue de la section d'accueil) ;
- `base-uri 'none'` et `form-action 'none'` : pas de `<base>` qui détournerait les liens, ni de formulaire qui enverrait des données ;
- `frame-ancestors 'none'` : aucun site ne peut afficher Étendard dans un cadre (protection contre le *clickjacking*).

La CSP n'est écrite que dans le `Caddyfile`. `tests/csp.spec.ts` l'y lit, sert la one page avec, et échoue si le navigateur bloque une ressource au chargement ou si les styles ne s'appliquent pas. Une nouvelle ressource (police, image externe, Cloudflare Web Analytics) se déclare donc d'abord dans le `Caddyfile`, et `pnpm verify` le rappelle. Le test ne voit que la page servie par le Pi : ce que Cloudflare injecterait en route (analytics, détection de bots) sera à autoriser avec la mise en ligne.

**Le `Caddyfile` ne part pas avec le site.** Sans `script-src 'self'` (Caddyfile d'avant #76), le site Expo s'affiche quand même : son HTML est pré-rendu, ses styles sont en fichiers ; seul son JavaScript est bloqué. `deploy.yml` ne livre que les fichiers du site ; le `Caddyfile` s'applique en relançant `install.sh` sur le Pi (étape 3 du [README](README.md)). Une PR qui change la CSP pour une nouvelle ressource doit donc être appliquée sur le Pi au moment du merge, sinon le Pi bloque cette ressource. `verify.sh pi` compare le `Caddyfile` installé et les en-têtes servis à la copie du dossier copié sur le Pi : il ne voit l'écart avec le repo que si ce dossier a été recopié.

**HSTS est posé par Cloudflare, pas par Caddy.** HSTS engage le nom du site en HTTPS (et ses sous-domaines avec `includeSubDomains`) ; c'est Cloudflare qui détient ce domaine et son certificat, et le HTTPS des visiteurs s'y termine (ADR 0002). Cloudflare répond aussi seul, par exemple avec sa page d'erreur quand le Pi est éteint : un HSTS posé par Caddy y manquerait. Il s'active dans le tableau de bord Cloudflare (SSL/TLS > Edge Certificates > HSTS), avec la mise en ligne et le domaine (#41).

**Valeur retenue : `max-age=31536000`**, soit un an, **sans `includeSubDomains` ni `preload`**. Un an est la durée courante. `includeSubDomains` imposerait HTTPS à tous les sous-domaines, y compris ceux qui ne sont pas encore décidés. `preload` permet de demander l'inscription du domaine (sur hstspreload.org, qui exige aussi `includeSubDomains`) dans la liste intégrée aux navigateurs, dont on ne sort qu'en plusieurs mois. On pourra les ajouter plus tard ; les retirer serait lent.

`bash verify.sh hsts <domaine>`, lancé depuis n'importe quel poste, lit l'en-tête sur `/` (200) et sur une page absente (404) du domaine public, ce qui écarte une page d'erreur de Cloudflare, et n'accepte que cette valeur exacte, dans un seul en-tête. `test/verify-hsts.test.sh` (dans `pnpm test:infra`) teste cette vérification avec un faux `curl`, sans le site en ligne. La procédure est dans le [README](README.md#à-la-mise-en-ligne--hsts-chez-cloudflare).

#### Le cache des fichiers `/_expo/static/` (#36, #76)

Expo écrit les scripts et les feuilles de style dans `/_expo/static/`, sous un nom qui contient une empreinte de leur contenu : `entry-3e639b39dd27ef8428b3e8b1df27be02.js`, `inline-d4eb76fb9541e2f6.css` (`scripts/export-web.js`). Caddy les sert avec `Cache-Control: public, max-age=31536000, immutable`. Le navigateur et Cloudflare les gardent donc un an, sans jamais les redemander, et la feuille de style, qui bloque l'affichage, ne fait plus l'aller-retour Cloudflare, tunnel, Pi à chaque visite.

**Ce cache est sans risque.** Un fichier de `/_expo/static/` ne change jamais de contenu : si le CSS change, l'empreinte change, donc le nom aussi. La nouvelle page HTML pointe vers ce nouveau nom, que personne n'a encore en cache. L'ancien fichier reste en cache, mais plus aucune page ne le demande. Les autres fichiers (`/`, la vidéo, `favicon.svg`, `version.txt`) gardent un nom fixe : ils n'ont pas cet en-tête, sinon une nouvelle version mettrait jusqu'à un an à arriver.

**Seules les réponses 2xx et 304 le portent.** Une 404 sur `/_expo/static/` n'est pas gardée un an : sans cela, un fichier absent un instant, puis rendu par un rollback, resterait introuvable pour ce visiteur ou derrière Cloudflare.

`verify.sh pi` le contrôle sur un fichier réel de `/_expo/static/`.

#### Le cache des pages HTML et de `version.txt` (#52)

**Les pages HTML portent `Cache-Control: no-cache`.** Le navigateur (et Cloudflare) peut garder la page, mais doit la revalider à chaque visite : il renvoie son `ETag`, et Caddy répond `304 Not Modified`, sans corps, tant que la page n'a pas changé. Sans cet en-tête, un navigateur réutiliserait la page sans la redemander pendant une durée qu'il calcule lui-même (souvent 10 % de l'âge de `Last-Modified`, RFC 9111) : jusqu'à quelques jours après un déploiement. Cette ancienne page demanderait d'anciens fichiers de `/_expo/static/`, que le Pi ne sert plus dès le déploiement suivant (il ne sert que `current`) : sans eux en cache, la page s'afficherait sans style.

Le matcher `@html` vise les chemins en `/` et en `.html`, c'est-à-dire les pages exportées par Expo, et non le type de la réponse : une `304` n'a pas de `Content-Type`, elle perdrait l'en-tête.

**`version.txt` porte `Cache-Control: no-store`** : ni le navigateur ni Cloudflare ne le gardent, et le test de fumée lit toujours le SHA réellement servi (ADR 0006). `verify.sh public` vérifie que Cloudflare le respecte (#125).

`verify.sh pi` contrôle les deux en-têtes, et la `304` de `/`.

#### Les pages sans extension (#106)

Expo exporte la route `projets/dragon/materiel` en `projets/dragon/materiel.html`, et l'accueil d'un projet en `projets/dragon/index.html`. Les liens du site les visent sans extension ni barre oblique finale (`/projets/dragon/materiel`, `/projets/dragon`), comme `expo serve` les sert. Un `file_server` seul répondrait 404 à la première adresse et redirigerait la seconde (308 vers `/projets/dragon/`).

**`try_files {path} {path}.html {path}/index.html` réécrit le chemin** vers le premier fichier qui existe : le fichier demandé, puis la même adresse en `.html`, puis l'`index.html` du dossier. Les deux adresses répondent donc 200, sans redirection. Une adresse sans fichier répond toujours 404.

**`try_files` et le matcher `@html` sont dans un même `route`.** Hors d'un `route`, Caddy range lui-même ses directives et passe `header` avant `try_files` : `@html` verrait le chemin demandé, sans `.html`, et ces pages perdraient `Cache-Control: no-cache`. Dans `route`, les directives s'appliquent dans l'ordre écrit : `@html` voit le chemin réécrit.

`verify.sh pi` demande, sans extension, une page HTML du site servi autre qu'un `index.html`, la première que `find` rencontre (aujourd'hui `+not-found.html`, la seule), puis un sous-dossier sans barre oblique finale : 200 et `Cache-Control` conforme. Il lui faut une vraie version dans `current`, pas une version de test de `verify.sh ssh`.

#### La page 404 (#114)

Expo exporte `src/app/+not-found.tsx` en `+not-found.html`. Pour une adresse sans fichier, `file_server` lève une erreur 404 ; `handle_errors 404` sert alors cette page à la place d'un corps vide, **avec le statut 404** : ni redirection vers l'accueil, ni 200 qui ferait indexer une adresse fausse.

**La page charge le JavaScript du site.** Expo Router y affiche la route qui correspond à l'adresse s'il en connaît une, toujours sous le statut 404 : `/projets/dragon/materiel/` (barre oblique finale, que `try_files` ne sert pas) montre la page Matériel. `/styleguide` montre la page 404 : ses routes ne sont pas dans le JavaScript de production (#85).

**Ses en-têtes :**

- Les en-têtes de sécurité, posés par le bloc `header` du site avant l'erreur, restent sur la réponse : ils ne sont écrits qu'une fois dans le `Caddyfile`.
- `Cache-Control: no-cache`, comme les pages HTML, est posé dans `handle_errors` : `@html` a vu l'adresse demandée (`/absente`), pas `+not-found.html`. Une page 404 corrigée par un déploiement n'est donc pas réutilisée.
- Le cache d'un an de `/_expo/static/` ne s'applique pas : il ne vise que les 2xx et 304.

**`request_header` retire de la requête `If-None-Match`, `If-Modified-Since`, `Range`, `If-Match` et `If-Unmodified-Since`.** Dans `handle_errors`, `file_server` garde le statut 404 mais traite encore ces en-têtes : la revalidation d'une 404 déjà vue (touche F5, ou Cloudflare à cause de `no-cache`) répondrait une 404 vide, une plage une 404 tronquée, une précondition non remplie (412) une 404 vide. Sans eux, la page part entière.

Une autre erreur (405 d'un `POST`, par exemple) garde son corps vide.

`verify.sh pi` demande une adresse sans fichier à la racine, dans un dossier du site et sous `/_expo/static/` : 404, `Content-Type: text/html`, corps identique à `+not-found.html`, y compris avec chacun de ces cinq en-têtes, en-têtes de sécurité et `Cache-Control` conformes. Il lui faut une vraie version dans `current` : celles de test de `verify.sh ssh` n'ont pas de `+not-found.html`.

#### Le journal d'accès

Caddy écrit chaque requête, en JSON, dans `/var/log/caddy/etendard-access.log`. À 10 Mio, le fichier est renommé et compressé ; Caddy garde les 4 derniers. Le journal occupe donc au plus 50 Mio sur le disque. Il appartient à l'utilisateur `caddy`, sous lequel tourne le service : `install.sh` lui rend le dossier après `caddy validate`, qui, lancé en root, crée le fichier s'il n'existe pas.

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

Le script n'accepte que quatre demandes. Tout le reste est refusé.

| Demande | Effet |
|---|---|
| aucune, archive sur l'entrée standard : `ssh deploy@<hote-du-pi> < site.tar.gz` | publie une nouvelle version |
| `rollback` | revient à la version que le dernier envoi a remplacée (rollback manuel, #63) |
| `restore <sha>` | attend la fin d'un déploiement en cours, puis sert la version `<sha>` (rollback automatique, #54) |
| `status` | affiche le SHA servi |

`restore <sha>` :

- **attend le verrou** jusqu'à 2 minutes (`flock -w 120`) au lieu d'échouer : après l'annulation d'un job, l'envoi peut encore tourner sur le Pi. La version servie n'est lue qu'une fois cet envoi fini, jamais pendant. Au bout de 2 minutes, `restore` abandonne sans rien changer et le job finit en erreur. L'envoi encore en cours peut alors basculer plus tard : vérifie la version servie à la main ;
- **sert exactement `<sha>`**, que `deploy.yml` a lu avant l'envoi, et non la version précédente par date : après un rollback manuel, la version la plus récente n'est pas forcément celle d'avant ;
- **ne fait rien si `<sha>` est déjà servie** (`version <sha> déjà servie`) ; sinon, bascule et affiche `retour à la version <sha> (depuis <servie>)` ;
- refuse un SHA mal formé (même contrôle que `version.txt`) ou une version absente de `releases/`.

`rollback` défait le dernier envoi, et seulement lui :

- chaque envoi qui change la version servie écrit le lien `previous` vers la version qu'il remplace ; `rollback` sert cette version, quelle que soit sa date ;
- `rollback` est refusé (`aucun envoi à défaire`) quand `previous` est absent (juste après l'installation du script, jusqu'au prochain envoi qui change la version servie) ou déjà servie : après un `rollback`, après un `restore` qui a défait l'envoi, ou si la bascule de l'envoi a échoué. Le workflow ne recule donc jamais de plus d'un envoi.
- `rollback` est aussi refusé (`version <sha> absente`) si le dossier de `previous` a été supprimé à la main dans `releases/` : `current` ne désigne jamais un dossier absent.

Une publication se déroule ainsi :

1. **Verrou `flock`.** Si un déploiement est déjà en cours, la demande est refusée tout de suite, ce qui évite que deux merges rapprochés se mélangent (`rollback` aussi ; seul `restore` attend). `status` reste possible pendant ce temps.
2. **Contrôle de l'archive, avant toute extraction.** Le script refuse :
   - un chemin absolu ;
   - un `..` ;
   - un lien symbolique, un lien physique ou un fichier spécial.

   Un lien pourrait faire servir `/etc/passwd` par Caddy. Un `..` permettrait d'écrire hors du dossier.
3. **Extraction**, avec des droits remis à plat : lecture pour tous, écriture pour `deploy` seul.
4. **Lecture de `version.txt`**, validé par `^[0-9a-f]{7,40}$`, c'est-à-dire un SHA git. Ce SHA devient le nom du dossier `releases/<sha>`, d'où cette rigueur.
5. **Bascule atomique** : le lien `previous` désigne la version remplacée, puis le lien `current.tmp` est renommé en `current`. Caddy sert l'ancienne version ou la nouvelle, jamais un état intermédiaire.
6. **Ménage** : les 5 versions les plus récentes sont gardées. Ni la version publiée ni celle de `previous` ne sont supprimées, même plus anciennes (après un rollback) : `rollback` et `restore` doivent pouvoir y revenir. Il peut donc rester 6 versions.

En cas d'erreur, rien ne change : le dossier temporaire est supprimé et `current` ne bouge pas.

Le ménage repose sur la date de publication des versions, c'est-à-dire la date de modification du dossier, que le script met à jour. Ne modifie donc pas les dossiers de `releases/` à la main.

### Tailscale

**Ce qui a été fait :**
- **Nœuds `github-runnervm…` périmés supprimés** : non éphémères et sans tag, ils avaient l'accès des appareils de Flo.
- **Tailscale SSH coupé sur le Pi** (`RunSSH: false`). Sinon, il répondrait lui-même sur le port 22 du tailnet, sans lire `authorized_keys` : la commande forcée serait contournée.
- **Politique** :
  - tes appareils gardent l'accès complet, comme avant ;
  - `tag:ci` ne joint que le Pi, et seulement en `tcp:22`.
- **Tests dans la politique.** La console refuse d'enregistrer si l'un d'eux échoue :
  - `tag:ci` est refusé sur les ports des services existants, 8080, 80 et 443 ;
  - ton identifiant Tailscale garde 22 et les ports des services existants.
- **Client OAuth `GitHubAction`**, avec une seule portée, `auth_keys`, et le tag `tag:ci`. Même s'il fuit, il ne peut créer que des machines `tag:ci`, donc limitées au port 22 du Pi. `tailscale/github-action` crée avec lui des nœuds éphémères, retirés du tailnet après chaque job.

Le dépôt contient une version générique de la politique, avec des valeurs `À_REMPLACER`. La version complétée (IP du Pi, identifiant de Flo, ports des services existants) n'existe que dans la console.

## Le durcissement du serveur (#113)

Le site sera public alors que le Pi héberge encore d'autres services (ADR [0017](../../docs/adr/0017-durcir-le-serveur-avant-la-mise-en-ligne.md)). Cloudflare Tunnel n'ouvre aucun port vers Internet : le risque est une faille du serveur web ou du tunnel, puis une élévation de privilèges sur le Pi. `install.sh` applique les protections ci-dessous, par ordre d'effet, et `verify.sh pi` les contrôle. La procédure et le retour arrière sont dans le [README](README.md#durcir-le-serveur-113).

### Le fichier local

Le repo est public : il ne contient ni les ports des services existants, ni leurs noms, ni l'état du Pi. Ces valeurs sont dans `/etc/etendard/serveur.conf`, sur le Pi seulement, au format de [`serveur.conf.exemple`](serveur.conf.exemple) : une ligne `PORT=`, `SERVICE=` ou `DEPOT_EXCLU=` par valeur. Le fichier n'est jamais exécuté, seulement lu : une ligne inconnue ou une valeur invalide arrête `install.sh` avant tout changement, avec son numéro de ligne mais sans sa valeur. Sans ce fichier, `install.sh` et `verify.sh pi` s'arrêtent en le disant.

`verify.sh pi` désigne chaque valeur par son numéro (« port n°1 du fichier local ») et n'affiche ni les commandes ni leur sortie : elle se colle telle quelle dans un ticket. `test/verify-pi.test.sh` le vérifie avec de fausses commandes qui affichent des adresses, des noms et des ports.

### Les mises à jour automatiques

`unattended-upgrades` installe chaque jour les correctifs de sécurité du système (configuration du paquet) et, par `/etc/apt/apt.conf.d/52etendard-maj-auto`, ceux du dépôt du noyau en cours, qui fournit aussi son firmware (tout ce dépôt, avec ses autres paquets), et des dépôts de Caddy, de Tailscale et de `cloudflared`. Ces dépôts sont lus sur le Pi (`origines_maj` de `commun.sh`) : le repo ne nomme pas le système. Un dépôt listé en `DEPOT_EXCLU=` n'est pas ajouté.

**Pas de redémarrage automatique** : il couperait le site et les services existants à une heure non choisie. Un nouveau noyau ne sert qu'après un redémarrage : `verify.sh pi` affiche « ⚠️ redémarrage en attente » quand le système le demande.

**Pour ajouter un logiciel exposé** : son paquet dans `PAQUETS_MAJ_AUTO` de `commun.sh` (`cloudflared` y est depuis #125).

### L'isolation du serveur web

Caddy reçoit une surcharge systemd, `/etc/systemd/system/caddy.service.d/etendard-isolation.conf` : le contenu d'[`isolation.conf`](isolation.conf), plus `ReadWritePaths=` avec ses seuls dossiers d'écriture (`/var/lib/caddy`, `/var/log/caddy`). L'unité du paquet n'est jamais modifiée : une mise à jour la remplacerait. Une faille de Caddy ne donnerait ni nouveau privilège, ni écriture ailleurs, ni accès aux dossiers personnels, aux périphériques, au noyau ou à une capacité root. `install.sh` affiche le score `systemd-analyze security` avant et après (0 : isolé, 10 : aucune isolation). `verify.sh pi` lit la configuration chargée et l'état du processus en cours, ce qui prouve qu'il a redémarré avec elle.

`cloudflared` reçoit la même surcharge, avec un `ReadWritePaths=` vide : il n'écrit nulle part ([plus bas](#cloudflare-tunnel-125)).

**Pour isoler un autre service** : son unité et les dossiers où il écrit dans `SERVICES_ISOLES` de `commun.sh`.

### Le pare-feu d'entrée

La table nftables `inet etendard` refuse toute entrée, sauf :

- le trafic local (`lo`) et les réponses aux connexions établies : une session SSH ouverte survit à l'application ;
- en IPv6, la découverte des voisins et du routeur et les réponses DHCPv6, sans quoi le Pi perd son adresse, et les requêtes MLD, sans quoi un commutateur qui filtre le multicast cesse de lui transmettre les voisins ;
- SSH (port lu dans `sshd -T`) et les ports `PORT=` du fichier local, depuis l'interface Tailscale et depuis le réseau local : les préfixes directement joignables par l'interface de la route par défaut, détectés à chaque `install.sh`.

Le Pi ne répond donc plus au ping. Après un changement de réseau local (box, plage d'adresses), relance `install.sh`.

**Pourquoi une table à part, chargée par son propre service** (`etendard-pare-feu.service`, avant le réseau). Tailscale, comme tout logiciel qui gère des conteneurs, réécrit ses propres règles et en accepte certaines. Dans nftables, un paquet doit passer **chaque** chaîne accrochée à l'entrée : le refus de cette table l'emporte sur l'acceptation d'une autre, et ces réécritures ne la touchent pas. Le service `nftables` du système commence au contraire par vider toutes les règles : il effacerait celles de Tailscale. Un port redirigé (NAT) avant la chaîne d'entrée, comme celui d'un conteneur publié, ne la traverserait pas : `install.sh` s'arrête s'il en trouve un, quel que soit le port, et `verify.sh pi` le contrôle aussi.

### SSH par clé uniquement

`/etc/ssh/sshd_config.d/00-etendard.conf` (copie de [`sshd-etendard.conf`](sshd-etendard.conf)) refuse les mots de passe, le clavier interactif et la connexion root. Son nom commence par `00` : sshd garde la première valeur lue, et ce dossier est lu en tête de `sshd_config`. La clé de déploiement est une clé : elle fonctionne toujours. `install.sh` s'arrête avant tout changement si le compte qui l'a lancé par `sudo` n'a aucune clé autorisée (`cle_admin_autorisee` de `commun.sh`, testée par `test/commun.test.sh`), puis vérifie avec `sshd -T` qu'aucune autre configuration ne l'emporte.

### Rien d'inutile

Le Pi démarre sans environnement graphique (`multi-user.target`, au prochain redémarrage : la session graphique en cours n'est pas coupée). Chaque `SERVICE=` du fichier local est masqué et arrêté : masqué plutôt que désactivé, pour qu'aucun autre service ni socket ne le relance. La lecture du fichier refuse les services nécessaires à l'accès ou au site (SSH, Tailscale, Caddy, le tunnel, le pare-feu).

## Cloudflare Tunnel (#125)

```
visiteur ── HTTPS ──▶ Cloudflare (<domaine>, certificat, « Always Use HTTPS »)
                         ▲
                         │  connexions ouvertes depuis le Pi, vers Cloudflare (aucun port entrant)
                         │
              cloudflared (Pi) ──▶ Caddy (127.0.0.1:8080)
```

`cloudflared` ouvre lui-même ses connexions vers Cloudflare et y reçoit les requêtes des visiteurs : la box et le pare-feu d'entrée n'ont aucun port à ouvrir, les réponses passent par la règle des connexions établies. Le HTTPS des visiteurs se termine chez Cloudflare (ADR 0002).

**Le tunnel est géré depuis le tableau de bord Cloudflare.** Sa seule règle, `<domaine>` → `http://127.0.0.1:8080`, y est écrite ; le Pi n'a ni fichier de configuration du tunnel ni certificat de compte (`cloudflared tunnel login`). Il n'a que le **jeton** du tunnel, son seul secret : il permet de se faire passer pour le tunnel, donc de servir un autre site sur le domaine, mais ni de modifier la règle ni d'accéder au compte. Un jeton qui fuit se remplace dans le tableau de bord (« Refresh token »), puis dans le fichier du Pi.

**Le jeton** est dans `/etc/etendard/tunnel.jeton`, à côté du fichier local, lisible par root seul. `install.sh` s'arrête avant tout changement s'il manque, s'il est lisible par un autre compte ou s'il contient autre chose que le jeton (`controler_jeton` de `commun.sh`), sans jamais l'afficher. Le service le reçoit par `LoadCredential=` : systemd le lit en root et le copie dans un dossier visible du seul service ; `cloudflared` le lit par `--token-file`. Il n'apparaît ni dans la ligne de commande (visible par `ps`), ni dans l'environnement du processus, ni dans le repo.

**Le service** [`etendard-tunnel.service`](etendard-tunnel.service) est installé par `install.sh` dans `/etc/systemd/system/` (le paquet n'en fournit pas). Son nom n'est pas `cloudflared.service`, celui que crée `cloudflared service install` : un autre tunnel du Pi n'est jamais remplacé.

- `DynamicUser=yes` : un utilisateur sans privilèges, créé par systemd à chaque démarrage, sans dossier ni mot de passe. S'y ajoute la surcharge d'[`isolation.conf`](isolation.conf), comme pour Caddy, sans dossier d'écriture : `cloudflared` n'écrit rien (son journal va dans celui de systemd). `install.sh` affiche son score `systemd-analyze security` ;
- `--protocol http2` : des connexions TCP sortantes. Avec QUIC (UDP), le choix par défaut, `cloudflared` ouvrirait un port UDP sur toutes les interfaces ; il n'écoute ainsi que sur la boucle locale ;
- `--metrics 127.0.0.1:0` : son seul port d'écoute, sur la boucle locale, au numéro choisi par le système (aucun conflit avec un service existant) ;
- `Type=notify` : `systemctl start` ne réussit qu'une fois le tunnel connecté, ce qui fait échouer `install.sh` sur un jeton révoqué.

**Démarré en dernier.** `install.sh` installe le service avec le reste, mais ne le démarre qu'après le pare-feu : s'il s'arrête en route, le site reste hors ligne plutôt que public sur un serveur à moitié durci (ADR 0017).

**Mises à jour.** Installé par apt, `cloudflared` ne se met pas à jour lui-même : `unattended-upgrades` s'en charge. Mais son paquet, qui ne fournit pas de service, ne relance rien : le tunnel garderait l'ancien binaire, avec sa faille, jusqu'au prochain redémarrage. `install.sh` ajoute donc à `52etendard-maj-auto` une commande lancée par apt après chaque passage de dpkg (`DPkg::Post-Invoke`, `RELANCE_APRES_MAJ` de `commun.sh`) : elle relance chaque service isolé (Caddy, le tunnel) dont le processus tourne encore sur un binaire remplacé, après dpkg, quand le nouveau est en place (`try-restart` : un tunnel coupé exprès le reste). `verify.sh pi` contrôle la commande et que chaque service tourne sur le binaire installé.

**Le paquet** vient du dépôt apt officiel de Cloudflare (`pkg.cloudflare.com`). `install.sh` n'ajoute sa clé de signature que si son empreinte est celle écrite dans `commun.sh` (`EMPREINTE_CLOUDFLARE`) : un serveur qui se ferait passer pour Cloudflare ne pourrait pas faire installer ses paquets. Si Cloudflare change de clé, `install.sh` s'arrête ; la nouvelle empreinte se relève sur sa page d'installation, se vérifie (`gpg --show-keys`) puis se reporte dans `commun.sh`.

### Réglages dans Cloudflare

Faits par Flo dans le tableau de bord, sans jeton d'API sur le Pi, tous avant le premier démarrage du tunnel : le site est public dès qu'il démarre. Les noms des menus changent parfois : le réglage, lui, reste.

- [ ] **Domaine ajouté** au compte Cloudflare, serveurs de noms remplacés chez le registraire par ceux de Cloudflare, domaine « Active ».
- [ ] **Tunnel créé** : Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared, nom neutre. À l'étape d'installation, **ne lance pas la commande proposée** : copie seulement le jeton (la longue chaîne après `service install`) dans `/etc/etendard/tunnel.jeton` ([README](README.md#mettre-en-ligne-125)).
- [ ] **Règle du tunnel** (Public Hostname) : `<domaine>`, chemin vide, type `HTTP`, URL `127.0.0.1:8080`. Aucune autre règle : le tunnel ne sert que le site.
- [ ] **Always Use HTTPS** activé (SSL/TLS > Edge Certificates) : une visite en `http://` est redirigée.
- [ ] **Rien qui injecte un script ou modifie le HTML** : la CSP (`script-src 'self'`) le bloquerait et `verify.sh public` échouerait.
  - [ ] Rocket Loader désactivé (Speed > Optimization) ;
  - [ ] Email Address Obfuscation désactivé (Scrape Shield, ou Security > Settings) ;
  - [ ] Web Analytics : pas d'installation automatique sur ce domaine (Analytics & Logs > Web Analytics). Les statistiques sont un autre ticket (ADR 0002) ;
  - [ ] Bot Fight Mode et ses « JavaScript detections » désactivés, mode « Under Attack » désactivé (Security > Bots, Security > Settings) : ils ajoutent un script aux pages, et leurs défis bloqueraient `curl`, donc le test de fumée lancé depuis GitHub.
- [ ] **Aucune règle de cache qui ignore les en-têtes du site** (Caching > Cache Rules, « Cache Everything », « Edge TTL » forcé) : `version.txt` doit rester `no-store`, sinon le test de fumée lit un ancien SHA et revient en arrière à tort.

HSTS s'active ensuite, une fois le site vérifié ([README](README.md#à-la-mise-en-ligne--hsts-chez-cloudflare), #41).

### Couper la mise en ligne

`sudo systemctl disable --now etendard-tunnel` arrête le tunnel et l'empêche de repartir au démarrage : Cloudflare répond par sa page d'erreur, Caddy, le déploiement et les services existants continuent. `sudo systemctl enable --now etendard-tunnel` remet le site en ligne. Le [README](README.md#couper-et-relancer-la-mise-en-ligne) précise ce qui change pendant la coupure.

## Le workflow `deploy.yml` (#5)

[`deploy.yml`](../../.github/workflows/deploy.yml) se lance à chaque push sur `main`, donc à chaque merge, et à la main par `workflow_dispatch`. `concurrency: production` empêche deux déploiements simultanés : le suivant attend la fin du précédent.

| Job | Ce qu'il fait | Droits |
|---|---|---|
| `build` | construit le site et son archive, avec `version.txt` (SHA du commit) | lecture du code |
| `deploy` | Environment `production` : envoie l'archive au Pi par le tailnet et vérifie la version servie, par SSH puis à travers Cloudflare | aucun droit GitHub |
| `release` | publie la Release `deploy-<sha court>`, seulement si `deploy` a réussi | écriture du code (tags, Releases) |
| `rollback` | seulement avec l'entrée `rollback` : revient à la version que le dernier envoi a remplacée | aucun droit GitHub |
| `message` | dans tous les cas : compose l'e-mail de résultat (#32), sans aucun secret | lecture du code et des PR |
| `notify` | Environment `production` : envoie cet e-mail par Brevo, sans exécuter de code du repo | aucun droit GitHub |

La Release est publiée par un job séparé, après le déploiement : le job `build` exécute les scripts du repo et ne reçoit donc qu'un jeton en lecture.

**Rollback automatique (#54).** Si une étape échoue après la lecture de `status`, ou si le job est annulé (à la main ou par son délai), le job lance `ssh pi restore <version lue avant l'envoi>`, en un seul appel. Le Pi attend la fin d'un envoi encore en cours, puis sert cette version si elle ne l'est plus : le site revient exactement à la version d'avant l'envoi, et rien ne bouge si l'envoi n'a rien changé. Si `status` échoue avant l'envoi, le job s'arrête sans rien envoyer : il ne saurait pas où revenir. Seule exception, aucune version encore servie (premier déploiement) : l'envoi a lieu, mais aucun rollback n'est possible. Le job finit en échec (ou annulé) dans tous les cas. L'étape « Vérifier la version servie » a son propre délai, plus court que celui du job : si `ssh pi status` y reste bloqué, elle échoue, et le rollback tourne sans attendre le délai du job.

**Rollback manuel.** Actions > deploy > Run workflow, sur `main`, case `rollback` cochée. Ou :

```bash
gh workflow run deploy.yml -R HSSRD/Etendard --ref main -f rollback=true
```

Après l'annulation d'un déploiement, vérifie d'abord la version servie dans l'e-mail de résultat. Si le rollback automatique a défait l'envoi, un rollback manuel est refusé (`aucun envoi à défaire`). Si l'envoi n'avait pas encore basculé, `previous` n'a pas changé : un rollback manuel défait l'envoi d'avant, comme s'il avait été lancé avant ce déploiement.

Pour revenir ensuite à la dernière version, relance le workflow sans cocher la case : le site est reconstruit depuis `main`, le Pi réactive la version qu'il a déjà, et la Release existante est gardée telle quelle.

**E-mail de résultat (#32).** Après chaque déploiement ou rollback, réussi ou non, le job `message` lance [`scripts/deploy-notify.js`](../../scripts/deploy-notify.js), qui compose l'objet et le texte. Le job `notify` y ajoute les adresses avec `jq`, puis `curl` l'envoie par l'API transactionnelle de Brevo. Les deux jobs sont séparés pour la même raison que `release` : le job qui exécute les scripts du repo n'a accès à aucun secret. Objets possibles :

- `✅ <branche de la PR> déployé — <sha court>` ;
- `❌ <branche> : déploiement en échec, rollback effectué` (ou `, version précédente toujours servie` ; `, nouvelle version servie` si l'échec suit la bascule sans rollback ; `, version servie inconnue` si le Pi n'a pas répondu) ;
- `↩️ Rollback manuel effectué — <sha servi>`, ou `❌ Rollback manuel en échec — <sha servi>` (`, version servie inconnue` si le Pi n'a pas répondu).

La branche est celle de la PR mergée ; sans PR (push direct), c'est le titre du commit. Le corps donne la PR, le SHA complet, la version servie par le Pi, le lien de l'exécution et celui de la Release (ou son échec). Si l'API GitHub ne répond pas, l'e-mail part avec le SHA court à la place de la branche et « PR : non lue ». Un envoi raté, ou des secrets absents, laisse un avertissement dans le journal sans changer le résultat du déploiement. Pour voir l'e-mail sans l'envoyer : `GITHUB_REPOSITORY=HSSRD/Etendard GITHUB_SHA=<sha> DEPLOY_RESULT=success node scripts/deploy-notify.js --a-blanc` (ajoute `GITHUB_RUN_ID` et `SERVI` pour des liens et une version servie réalistes).

**Vérification.** Après l'envoi, `ssh pi status` doit donner le SHA du commit, puis le test de fumée public (ADR 0006, #125) lit `${SITE_URL}/version.txt` à travers Cloudflare : six essais espacés de 10 s, 3 minutes au plus. S'il ne lit pas ce SHA, l'étape échoue et le rollback automatique ramène la version d'avant. `SITE_URL` (`https://<domaine>`) est une variable de l'Environment `production`, pas un secret : le domaine est public, mais le repo ne l'écrit pas. Sans elle, le test est sauté avec un avertissement dans le journal ; une valeur invalide arrête le job avant l'envoi, sans rien changer au site.

### Les secrets de l'Environment `production`

L'Environment n'accepte que la branche `main` : un workflow lancé depuis une autre branche n'obtient pas ces secrets.

| Secret | Contenu |
|---|---|
| `TS_OAUTH_CLIENT_ID` | identifiant du client OAuth Tailscale `GitHubAction` |
| `TS_OAUTH_SECRET` | secret de ce client |
| `DEPLOY_SSH_KEY` | clé privée `github-deploy`, sur le PC de Flo |
| `DEPLOY_HOST` | nom court du Pi dans le tailnet (MagicDNS), hôte SSH du workflow (#31 : il n'apparaît pas dans le repo, public) |
| `DEPLOY_KNOWN_HOSTS` | clé d'hôte du Pi, sous exactement le même nom que `DEPLOY_HOST` (sinon : « Host key verification failed ») |
| `BREVO_API_KEY` | clé API Brevo, limitée si possible à l'envoi d'e-mails transactionnels |
| `NOTIFY_EMAIL_FROM` | adresse d'expéditeur, validée dans Brevo |
| `NOTIFY_EMAIL_TO` | adresse qui reçoit l'e-mail de résultat |

Pour les saisir ou les faire tourner, dans le bash de Git :

```bash
gh secret set TS_OAUTH_CLIENT_ID --env production -R HSSRD/Etendard   # colle la valeur
gh secret set TS_OAUTH_SECRET    --env production -R HSSRD/Etendard   # colle la valeur
gh secret set DEPLOY_SSH_KEY     --env production -R HSSRD/Etendard < ~/.ssh/github-deploy
gh secret set DEPLOY_HOST        --env production -R HSSRD/Etendard   # colle le nom du Pi dans le tailnet
ssh <login>@<ip-du-pi> cat /etc/ssh/ssh_host_ed25519_key.pub \
  | awk -v hote='<hote-du-pi>' '{print hote, $1, $2}' \
  | gh secret set DEPLOY_KNOWN_HOSTS --env production -R HSSRD/Etendard
```

Les secrets Brevo se saisissent de la même façon, sans jamais écrire d'adresse dans le repo :

```bash
gh secret set BREVO_API_KEY     --env production -R HSSRD/Etendard   # colle la valeur
gh secret set NOTIFY_EMAIL_FROM --env production -R HSSRD/Etendard   # colle la valeur
gh secret set NOTIFY_EMAIL_TO   --env production -R HSSRD/Etendard   # colle la valeur
```

La clé d'hôte est lue sur le Pi lui-même, par le réseau local, plutôt que par `ssh-keyscan`, qui accepterait la réponse de n'importe quelle machine. Le workflow vérifie l'empreinte (`StrictHostKeyChecking yes`) : si le Pi est réinstallé, il faut refaire la dernière commande.

La variable du test de fumée public, une fois le site en ligne ([README](README.md#mettre-en-ligne-125)) :

```bash
gh variable set SITE_URL --env production -R HSSRD/Etendard --body 'https://<domaine>'
```

## Comment on sait que ça marche

- **`test/etendard-receive.test.sh`** : tests locaux sur des archives saines et piégées, le verrou, `rollback` et `restore`. Ils n'ont pas besoin du Pi.
- **`verify.sh pi`**, sur le Pi, et **`verify.sh ssh`**, depuis le PC : ils rejouent les critères des tickets et affichent ✅ ou ❌ ; `verify.sh pi` contrôle aussi le durcissement (#113) et le tunnel (#125). Le 2026-11-07, le bilan était de 20/0 et 21/0. Les sorties complètes sont dans le ticket #4.
- **État laissé par `verify.sh ssh` (#135)** : il publie les versions de test `e7e7e7a` et `e7e7e7b` sur le serveur de production, puis finit sur la version servie au départ, qu'il lit par `status` : chaque envoi qui change la version servie la remplace, elle, et le rollback final la rétablit. Ensuite, elle est servie et `previous` la désigne : un rollback manuel est refusé (`aucun envoi à défaire`), et le déploiement suivant, s'il est défait (rollback ou `restore`), revient à elle. Sans vraie version servie (serveur neuf, ou version de test laissée par un `verify.sh` d'avant #135), il s'arrête avant tout envoi : déploie d'abord le site. `test/verify-ssh.test.sh` le rejoue avec un faux `ssh` et le vrai `etendard-receive`, sans le Pi.
- **`verify.sh hsts <domaine>`**, depuis n'importe quel poste une fois le site en ligne : HSTS posé par Cloudflare (#41). `test/verify-hsts.test.sh` le teste sans le site.
- **`verify.sh public <domaine>`**, depuis n'importe quel poste : le site à travers Cloudflare (#125). `/` répond 200 ; une page absente répond 404 avec la page 404 du site ; chaque en-tête de sécurité est identique à celui du `Caddyfile` (une valeur modifiée ou ajoutée par Cloudflare le fait échouer) ; aucun `<script>` hors de `/_expo/static/` (Rocket Loader, obfuscation des e-mails ou Web Analytics en ajoutent un) ; `version.txt` jamais lu depuis le cache de Cloudflare (`cf-cache-status`, sur deux lectures). Sa sortie ne contient que des chemins, pas le domaine. `test/verify-public.test.sh` le teste avec un faux `curl`, et `test/commun.test.sh` la lecture du jeton.
- **Tests Tailscale** : ils sont rejoués par la console à chaque modification de la politique.

Relance `verify.sh` après toute intervention sur le Pi : mise à jour système, réinstallation, changement de configuration SSH.

## Ce qui reste à faire, hors de ce ticket

- **Runners des autres projets** : s'ils rejoignent encore le tailnet avec une clé sans tag, Tailscale les traite comme tes appareils, avec un accès complet. Il faudra leur donner un tag dédié, avec ses propres règles.
- **Départ des autres services, puis réinstallation d'un Pi dédié** (ADR 0002 et 0017).
