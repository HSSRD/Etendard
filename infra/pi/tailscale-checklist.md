# Checklist Tailscale (critères 6 et 7 du ticket #4)

À faire par Flo dans la console https://login.tailscale.com/admin. Note chaque résultat, ou fais une capture d'écran : ce sont les preuves à coller dans le ticket.

## 1. Avant de toucher à quoi que ce soit : d'où viennent les nœuds `github-runnervm…` ?

Aucun repo HSSRD ne mentionne Tailscale. Les nœuds viennent donc d'un autre repo. Ne resserre pas l'accès avant d'avoir trouvé lequel.

- [ ] **Machines** : filtre `github-runnervm`. Pour quelques nœuds, ouvre la fiche et note le **propriétaire**, les **tags** (sans doute aucun) et la date de création.
- [ ] **Settings > Keys** : repère la clé d'authentification réutilisable qui a servi (description, date de création, dernière utilisation).
- [ ] **Settings > OAuth clients** : repère un éventuel client existant.
- [ ] **Sur GitHub**, cherche le workflow qui utilise cette clé :
  ```bash
  gh search code "tailscale/github-action" --owner <ton-compte-ou-org>
  gh search code "TS_AUTHKEY" --owner <ton-compte-ou-org>
  ```
  Regarde aussi les secrets `TS_*` ou `TAILSCALE_*` des repos trouvés (Settings > Secrets and variables > Actions).
- [ ] **Policy actuelle** (Access controls) : copie-la de côté. Si elle contient autre chose que la politique par défaut « tout autorisé », reporte ces règles dans `tailscale-policy.hujson` avant de la coller.

Ce que change la nouvelle politique pour ce workflow : ses nœuds non étiquetés sont des appareils de ton compte (`autogroup:member`). La nouvelle politique leur laisse donc l'accès complet : elle ne casse rien, mais elle ne les bride pas non plus. Pour les brider, migre ce workflow vers `tag:ci` (étape 4), ou vers un tag à lui avec sa propre règle. Supprime sa clé réutilisable seulement après cette migration.

## 2. Supprimer les nœuds `github-runnervm…` périmés

- [ ] **Machines**, filtre `github-runnervm` : supprime chaque nœud hors ligne (menu `…` > **Remove**).
- [ ] Preuve : sur le Pi, `tailscale status | grep -c github-runnervm` affiche `0`.

## 3. Vérifier que Tailscale SSH n'intercepte pas le port 22 du Pi

La CI doit arriver sur le `sshd` du Pi, qui applique la commande forcée de `deploy`. Si Tailscale SSH est actif sur `florasp`, il intercepte le port 22 du tailnet et ignore `authorized_keys`.

- [ ] Sur le Pi : `tailscale debug prefs | grep RunSSH` affiche `"RunSSH": false`.
- [ ] Sinon, désactive-le sur le Pi avec `sudo tailscale set --ssh=false`, et vérifie que tu peux encore te connecter en SSH classique.

## 4. Politique : `tag:ci` et ACL

- [ ] Ouvre `infra/pi/tailscale-policy.hujson` et remplace :
  - `À_REMPLACER_IP_TAILSCALE_DE_FLORASP` par la sortie de `tailscale ip -4` sur le Pi ;
  - `À_REMPLACER_IDENTIFIANT_TAILSCALE_DE_FLO` par ton identifiant de connexion Tailscale (en haut à droite de la console, ex. `toi@github` ou ton e-mail).
- [ ] **Access controls > Edit file** : colle la politique, puis **Save**. La console exécute le bloc `tests` :
  - `tag:ci` joint `florasp:22` ;
  - `tag:ci` est refusé sur `florasp:5000` et `florasp:8000` (Sentry), ainsi que sur 8080, 80 et 443 ;
  - tes appareils joignent toujours `florasp:22`, `5000` et `8000`.

  Si un test échoue, la console refuse d'enregistrer. **L'enregistrement réussi est la preuve du critère 7.** Fais une capture de la politique enregistrée.
- [ ] Après l'enregistrement, vérifie depuis ton PC que tu joins encore le Pi : `ssh flo@florasp true`.

## 5. Accès de GitHub Actions avec des nœuds éphémères `tag:ci`

Deux options. Prends la **fédération d'identité** si ta console la propose : aucun secret long à stocker dans GitHub.

**Option A — fédération d'identité (recommandée)**
- [ ] **Settings > Trust credentials** (ou **OAuth clients**, selon la version de la console) : crée une identité de charge de travail pour l'émetteur GitHub Actions (`https://token.actions.githubusercontent.com`).
- [ ] Restreins le sujet au déploiement d'Étendard : `repo:HSSRD/Etendard:environment:production`.
- [ ] Portée : création de clés d'authentification (`auth_keys`, écriture), tag `tag:ci`.
- [ ] Note l'identifiant du client et l'audience : ils seront utilisés par `deploy.yml` (#5).

**Option B — client OAuth**
- [ ] **Settings > OAuth clients > Generate OAuth client** : portée `auth_keys` (écriture), tag `tag:ci`.
- [ ] Note l'identifiant et le secret dans ton gestionnaire de mots de passe. Ne les mets pas encore dans GitHub : c'est le rôle de #5 (secrets de l'environnement `production`).

Dans les deux cas, `tailscale/github-action` crée des nœuds **éphémères** : ils disparaissent du tailnet peu après la fin du job.

## 6. Preuves à coller dans le ticket

- Sortie de `tailscale status | grep -c github-runnervm` (attendu : `0`).
- Sortie de `tailscale debug prefs | grep RunSSH` (attendu : `false`).
- Capture de **Access controls** après un **Save** réussi, avec le bloc `tests` visible.
- Capture de la page du client OAuth ou de la fédération d'identité : tag `tag:ci`, portée `auth_keys`, sans le secret.
