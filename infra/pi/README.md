# Pi `florasp` : recevoir et servir Étendard

Prépare le Pi au déploiement décrit dans les ADR 0002 et 0006 (ticket #4). Le workflow `deploy.yml` viendra avec #5. Ces fichiers seront repris dans `HSSRD/infra` (Ansible).

Ce qui est en place et pourquoi : [FONCTIONNEMENT.md](FONCTIONNEMENT.md). Ce README ne donne que les étapes.

| Fichier | Rôle |
| --- | --- |
| `install.sh` | Installation root, idempotente : Caddy, utilisateur `deploy`, `/srv/etendard`, `etendard-receive`, clé à commande forcée |
| `Caddyfile` | Caddy sur `127.0.0.1:8080` uniquement, racine `/srv/etendard/current` |
| `etendard-receive` | Seule commande de la clé de déploiement : réception (stdin), `rollback`, `status` |
| `verify.sh` | Preuves des critères 1 à 5 |
| `tailscale-policy.hujson`, `tailscale-checklist.md` | Critères 6 et 7 |
| `test/etendard-receive.test.sh` | Tests locaux du script (archives saines et piégées) |

## Ordre des étapes

1. **Tailscale, étapes 1 à 3** de `tailscale-checklist.md` : trouver le workflow des nœuds `github-runnervm…`, les supprimer, vérifier que Tailscale SSH est coupé sur le Pi.
2. **Sur le PC**, créer la clé de déploiement (la clé privée ira dans les secrets GitHub avec #5) :
   ```bash
   ssh-keygen -t ed25519 -N '' -C github-deploy -f ~/.ssh/github-deploy
   ```
3. **Copier ce dossier et la clé publique sur le Pi**, puis installer :
   ```bash
   tar -czf - -C infra/pi . | ssh flo@192.168.1.41 "mkdir -p etendard-pi && tar -xzf - -C etendard-pi"
   scp ~/.ssh/github-deploy.pub flo@192.168.1.41:etendard-pi/
   ssh -t flo@192.168.1.41 'cd ~/etendard-pi && sudo bash install.sh github-deploy.pub'
   ```
4. **Preuves côté Pi** (critères 1 à 3, verrou, Sentry intact) :
   ```bash
   ssh -t flo@192.168.1.41 'cd ~/etendard-pi && sudo bash verify.sh pi'
   ```
5. **Preuves côté PC** (critères 1, 4 et 5), dans le bash de Git :
   ```bash
   bash infra/pi/verify.sh ssh
   ```
   Puis à la main : `ssh -L 8080:127.0.0.1:8080 flo@192.168.1.41` et http://localhost:8080 affiche « Page de test e7e7e7a ».
6. **Tailscale, étapes 4 à 6** : politique `tag:ci` (critère 7 vérifié par le bloc `tests` à l'enregistrement), client OAuth ou fédération d'identité.
7. Coller les sorties des étapes 4 à 6 dans le ticket.

## Tester `etendard-receive` sans le Pi

```bash
bash infra/pi/test/etendard-receive.test.sh
```

Le préfixe des chemins se change avec `ETENDARD_ROOT` (défaut `/srv/etendard`). Sous Windows, le test simule `flock`, absent du bash de Git ; le vrai verrou est vérifié par `verify.sh`.
