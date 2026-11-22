# Pi : recevoir et servir Étendard

Prépare le Pi au déploiement décrit dans les ADR 0002 et 0006 (ticket #4) et le durcit (ADR 0017, ticket #113). Le workflow `deploy.yml` (#5) y dépose le site à chaque merge ; ses secrets se saisissent comme indiqué dans [FONCTIONNEMENT.md](FONCTIONNEMENT.md#les-secrets-de-lenvironment-production).

Ce qui est en place et pourquoi : [FONCTIONNEMENT.md](FONCTIONNEMENT.md). Ce README ne donne que les étapes.

| Fichier | Rôle |
| --- | --- |
| `install.sh` | Installation root, idempotente : Caddy, utilisateur `deploy`, `/srv/etendard`, `etendard-receive`, clé à commande forcée ; durcissement (#113) |
| `commun.sh` | Fonctions de `install.sh` et `verify.sh` : lecture du fichier local, garde-fou SSH, dépôts des mises à jour, logiciels exposés |
| `serveur.conf.exemple` | Format du fichier local `/etc/etendard/serveur.conf`, aux valeurs neutres |
| `sshd-etendard.conf`, `isolation.conf`, `etendard-pare-feu.service` | SSH par clé uniquement, isolation systemd de Caddy, pare-feu d'entrée |
| `Caddyfile` | Caddy sur `127.0.0.1:8080` uniquement, racine `/srv/etendard/current`, pages sans extension, page 404, en-têtes de sécurité, cache de `/_expo/static/`, des pages HTML et de `version.txt`, journal d'accès |
| `etendard-receive` | Seule commande de la clé de déploiement : réception (stdin), `rollback`, `restore <sha>`, `status` |
| `verify.sh` | Preuves des critères 1 à 5 du ticket #4, des en-têtes et du journal (#25), du cache de `/_expo/static/` (#36), des pages HTML et de `version.txt` (#52), de HSTS sur le domaine public (#41), des pages sans extension (#106), de la page 404 (#114), du durcissement (#113) |
| `tailscale-policy.hujson`, `tailscale-checklist.md` | Critères 6 et 7 |
| `test/etendard-receive.test.sh` | Tests locaux du script (archives saines et piégées) |
| `test/verify-hsts.test.sh` | Tests locaux de `verify.sh hsts`, avec un faux `curl` |
| `test/commun.test.sh`, `test/verify-pi.test.sh` | Tests locaux du fichier local, du garde-fou SSH et de la sortie de `verify.sh pi` (aucune valeur du serveur) |

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
   La première fois, suis plutôt [Durcir le serveur](#durcir-le-serveur-113) : fichier local à créer, vérifications et session de secours avant `install.sh`.
4. **Preuves côté Pi** (critères 1 à 3, verrou, en-têtes, journal et cache, durcissement), sortie à coller telle quelle :
   ```bash
   ssh -t <login>@<ip-du-pi> 'cd ~/etendard-pi && sudo bash verify.sh pi'
   ```
5. **Preuves côté PC** (critères 1, 4 et 5), dans le bash de Git :
   ```bash
   HOST=<hote-du-pi> FLO=<login>@<ip-du-pi> bash infra/pi/verify.sh ssh
   ```
   Puis à la main : `ssh -L 8080:127.0.0.1:8080 <login>@<ip-du-pi>` et http://localhost:8080 affiche « Page de test e7e7e7a ».
6. **Tailscale, étapes 4 à 6** : politique `tag:ci` (critère 7 vérifié par le bloc `tests` à l'enregistrement), client OAuth ou fédération d'identité.
7. Coller les sorties des étapes 4 à 6 dans le ticket ; pour celles des étapes 5 et 6, après avoir remplacé le nom du Pi, ses adresses, ton login et ton identifiant Tailscale par `<hote-du-pi>`, `<ip-du-pi>`, `<login>`… : le repo est public (#31).

## Durcir le serveur (#113)

Ce qui est appliqué et pourquoi : [FONCTIONNEMENT.md](FONCTIONNEMENT.md#le-durcissement-du-serveur-113). `install.sh` change SSH et le pare-feu en dernier, et s'arrête avant tout changement si le fichier local est absent ou invalide, si ton compte n'a aucune clé SSH autorisée, ou si un port est redirigé avant le pare-feu.

### Avant d'appliquer

1. **Ta clé SSH** : tu te connectes au Pi par clé, sans mot de passe (`ssh -o PasswordAuthentication=no <login>@<ip-du-pi> true` réussit). Sinon : `ssh-copy-id <login>@<ip-du-pi>`.
2. **Les noms en `.local`** : si tu désactives le service de découverte réseau, plus aucun appareil ne joindra le Pi ni un autre service par un nom en `.local`. Vérifie qu'aucun appareil ne s'en sert (signets, configurations, scripts) ; sinon, remplace ces noms par l'adresse ou par le nom du tailnet.
3. **Le fichier local**, sur le Pi :
   ```bash
   sudo install -d -m 755 /etc/etendard
   sudo install -m 600 serveur.conf.exemple /etc/etendard/serveur.conf
   sudo nano /etc/etendard/serveur.conf
   ```
   - `PORT=` : un port par service existant qui doit rester joignable du réseau local et du tailnet (SSH est ajouté seul). `sudo ss -Hltnup` liste les ports ouverts et leurs programmes.
   - `SERVICE=` : une unité systemd par service inutile (`systemctl list-unit-files --state=enabled` ; ajoute aussi son `.socket` s'il en a un).
   - `DEPOT_EXCLU=` : l'origine d'un dépôt à ne jamais mettre à jour seul (champ `o=` de `apt-cache policy`).
4. **Un port redirigé** : `install.sh` s'arrête, sans rien modifier, si une règle de NAT redirige un port (un conteneur qui publie un port en pose une) : ce port ne passerait pas par le pare-feu. Dans ce cas, signale-le dans le ticket : la façon de le filtrer est à décider (le service existant ne change pas dans ce ticket).
5. **Un accès de secours** : un clavier et un écran branchables sur le Pi, ou un lecteur de carte pour son support (voir « Retour arrière »).

### Appliquer

1. Ouvre **deux** sessions SSH sur le Pi et garde la seconde ouverte jusqu'à la fin : une session ouverte survit au nouveau pare-feu et au rechargement de SSH.
2. Dans la première, depuis ce dossier sur le Pi : `sudo bash install.sh <clé publique de déploiement>`. Note les scores `systemd-analyze security` de Caddy, avant et après, à coller dans le ticket.
3. **Sans fermer ces sessions**, depuis ton PC, ouvre une nouvelle session par le réseau local, puis par le tailnet (`ssh <login>@<hote-du-pi> true`), et vérifie qu'un mot de passe est refusé : `ssh -o PubkeyAuthentication=no <login>@<ip-du-pi>` répond `Permission denied (publickey)`. Vérifie aussi que les services existants répondent.
4. `sudo bash verify.sh pi` : le bilan doit être sans ❌. Colle la sortie telle quelle dans le ticket.
5. Redémarre le Pi (`sudo reboot`), puis relance `verify.sh pi` : il démarre sans environnement graphique et chaque service revient seul. Un déploiement (merge sur `main`) doit ensuite passer.

### Retour arrière

**Depuis une session encore ouverte** (ou si SSH répond encore) :

```bash
sudo systemctl disable --now etendard-pare-feu          # retire le pare-feu
sudo rm /etc/ssh/sshd_config.d/00-etendard.conf && sudo systemctl reload ssh   # mots de passe de nouveau acceptés
sudo systemctl set-default graphical.target              # environnement graphique au prochain démarrage
sudo systemctl unmask <service> && sudo systemctl enable --now <service>      # pour chaque SERVICE= du fichier local
sudo rm /etc/systemd/system/caddy.service.d/etendard-isolation.conf && sudo systemctl daemon-reload && sudo systemctl restart caddy   # isolation de Caddy
sudo rm /etc/apt/apt.conf.d/52etendard-maj-auto           # mises à jour automatiques ajoutées
```

**Sans réseau**, avec un clavier et un écran sur le Pi : connecte-toi sur la console (les mots de passe y restent acceptés : seul SSH les refuse) et lance les mêmes commandes.

**Sans réseau ni écran** : éteins le Pi, branche son support sur un autre ordinateur et, dans sa partition système (Linux, ou un outil qui lit ext4), supprime `etc/systemd/system/sysinit.target.wants/etendard-pare-feu.service` (le pare-feu ne se charge plus) et `etc/ssh/sshd_config.d/00-etendard.conf` (SSH accepte de nouveau les mots de passe). Remets le support et redémarre.

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
