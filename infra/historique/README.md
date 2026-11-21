# Retirer le réseau privé de l'historique (ticket #31, critères 3 à 6)

Les fichiers de `main` ne contiennent plus aucune valeur du réseau privé de Flo (critères 1 et 2). Il reste à les retirer de l'historique Git, des branches, des tags, des Releases, des textes GitHub et des caches de GitHub. Ces opérations sont **irréversibles** et demandent les droits d'administrateur : elles sont **réservées à Flo**. Ce document les donne dans l'ordre ; [`reseau-prive.sh`](reseau-prive.sh) fait la réécriture et les contrôles, sans jamais rien pousser.

**Aucune valeur n'est écrite sur GitHub**, ni dans ce repo, ni dans un commit, un ticket ou un commentaire. Les valeurs sont dans un fichier local, hors de tout repo : `~/etendard-valeurs-31.txt`. Format `--replace-text` de `git filter-repo` : une ligne `valeur==>remplacement` par valeur, les formes longues (`login@adresse`) avant les courtes, et chaque variante de casse sur sa propre ligne (le remplacement distingue les majuscules, le contrôle non : une variante oubliée l'arrête). Enregistre-le en UTF-8 sans BOM. Le script refuse un fichier placé dans un repo Git, et ne désigne chaque valeur que par son numéro de ligne.

Toutes les commandes se lancent dans le **bash de Git**, depuis le clone principal du repo, à jour avec `main` :

```bash
git switch main && git pull
V=~/etendard-valeurs-31.txt
```

## 0. Installer git filter-repo (une fois)

`git filter-repo` est un script Python. Sous Windows, dans PowerShell :

```powershell
winget install --id Python.Python.3.13 -e
# Puis, dans un nouveau terminal :
py -3 -m pip install --user git-filter-repo
py -3 -m pip show git-filter-repo   # ligne Version : 2.47 ou plus
```

La ligne `Version` doit valoir 2.47 ou plus (`--sensitive-data-removal`) ; le script le vérifie aussi. Le script appelle `git filter-repo` s'il est dans le `PATH`, sinon `py -3 -m git_filter_repo`. Sous Linux aussi, préfère `pip install --user git-filter-repo` au paquet Debian, plus ancien.

## 1. Relire les valeurs et geler le repo

- [ ] Relis `~/etendard-valeurs-31.txt` : chaque valeur du réseau privé y est, et rien d'autre (un mot courant remplacé partout casserait l'historique).
- [ ] État de départ, pour comparer à la fin : `bash infra/historique/reseau-prive.sh verifier "$V"`. Il liste les textes GitHub qui contiennent encore une valeur (étape 7).
- [ ] **Aucune PR ouverte** : merge-les ou ferme-les (`gh pr list -R HSSRD/Etendard`). Préviens les agents et les worktrees en cours : tous les SHA vont changer.
- [ ] Le dernier déploiement de `main` a réussi (Actions > deploy).
- [ ] Suspends Renovate le temps de l'opération, sinon il peut recréer une branche sur l'ancien historique : Settings > GitHub Apps > Renovate > Configure, retire `HSSRD/Etendard` des repos autorisés.

## 2. Supprimer les branches distantes (critère 4)

Toutes les branches sauf `main` sont mergées ou abandonnées, et chacune contient l'ancien historique.

```bash
gh api "repos/HSSRD/Etendard/branches?per_page=100" --paginate -q '.[].name' | grep -vx main \
  | while read -r b; do gh api -X DELETE "repos/HSSRD/Etendard/git/refs/heads/$b" && echo "supprimée : $b"; done
```

## 3. Supprimer les Releases et les tags (critère 4)

Les tags `deploy-<sha>` pointent vers des commits de l'ancien historique. Le prochain déploiement publiera une Release sur le nouveau `main`.

```bash
gh release list -R HSSRD/Etendard --limit 500 --json tagName -q '.[].tagName' \
  | while read -r t; do gh release delete "$t" -R HSSRD/Etendard --cleanup-tag --yes; done
git ls-remote --tags https://github.com/HSSRD/Etendard.git \
  | sed 's|.*refs/tags/||; s|\^{}$||' | sort -u \
  | while read -r t; do gh api -X DELETE "repos/HSSRD/Etendard/git/refs/tags/$t"; done
```

Les journaux des anciennes exécutions de `deploy.yml` affichent aussi le nom du Pi (le script de chaque étape y est recopié). Ils expirent après 90 jours ; pour les supprimer tout de suite, **avant** le push de l'étape 5, dont le déploiement sert de preuve :

```bash
gh run list -R HSSRD/Etendard --workflow deploy.yml --limit 500 --json databaseId -q '.[].databaseId' \
  | while read -r r; do gh run delete "$r" -R HSSRD/Etendard; done
```

## 4. Réécrire l'historique (critère 3)

```bash
bash infra/historique/reseau-prive.sh reecrire "$V"
```

Le script vérifie qu'il ne reste ni PR ouverte, ni autre branche que `main`, ni tag, réécrit un clone neuf dans `~/etendard-reecriture`, recompte les valeurs (il s'arrête s'il en reste une) et affiche le **premier commit modifié**, à garder pour l'étape 8. Il finit par la commande de push de l'étape 5, avec le SHA de l'ancien `main`.

Avant de pousser, regarde un fichier réécrit, par exemple `git -C ~/etendard-reecriture log -p -1 -- infra/pi/verify.sh`.

## 5. Pousser le nouvel historique

Le ruleset « Bloque push main » refuse tout push direct sur `main` (PR obligatoire, checks, pas de force-push) : il est désactivé le temps du push, puis réactivé aussitôt.

```bash
cd ~/etendard-reecriture
id="$(gh api repos/HSSRD/Etendard/rulesets -q '.[] | select(.name == "Bloque push main") | .id')"
gh api -X PUT "repos/HSSRD/Etendard/rulesets/$id" -f enforcement=disabled > /dev/null
git push --force-with-lease=main:<ancien sha affiché à l'étape 4> origin main
gh api -X PUT "repos/HSSRD/Etendard/rulesets/$id" -f enforcement=active > /dev/null
gh api "repos/HSSRD/Etendard/rulesets/$id" -q .enforcement   # active
cd -
```

`--force-with-lease` refuse le push si `main` a bougé depuis l'étape 4 : réactive alors le ruleset et reprends à l'étape 1. Ne pousse que `main` : pas de `--mirror`, qui recréerait les refs supprimées et tenterait `refs/pull/*` (refusées par GitHub).

Ce push lance `deploy.yml` sur le nouveau `main` (approuve-le si l'Environment le demande). Il doit finir vert, et le Pi servir le nouveau SHA : c'est la preuve demandée par la Définition de terminé. Sur le Pi, `releases/` garde les dossiers des anciens SHA ; le prochain déploiement en crée un nouveau.

## 6. Vérifier (critères 3 et 4) et réaligner les clones

```bash
bash infra/historique/reseau-prive.sh verifier "$V"
```

Attendu : 0 partout pour les fichiers de `main` et l'historique d'un clone neuf, aucune autre branche, un seul tag : `deploy-<nouveau sha>`, publié par le déploiement de l'étape 5. Les lignes `refs/pull/*` restent non nulles jusqu'à l'étape 8.

Puis réaligne chaque copie sur le nouveau `main`. Un clone sans travail en cours : `git fetch origin && git switch main && git reset --hard origin/main` (efface les commits locaux de `main`). Le plus sûr pour les worktrees Orca : les supprimer et les recréer. Sur le Pi, même commande dans son clone du repo : un simple `git pull` y échouerait. Enfin, réautorise Renovate (étape 1).

## 7. Corriger les textes GitHub (critère 5)

`verifier` liste chaque texte qui contient encore une valeur, par son lien et le numéro de la valeur : corps et titres des tickets et des PR, commentaires, revues, Releases, et **leurs historiques de modification**. Un texte déjà corrigé garde en effet ses anciennes versions, visibles par tous dans le menu « edited ».

Pour chaque lien listé :

1. Ouvre-le, **Edit**, remplace chaque valeur par son remplacement du fichier des valeurs (`<hote-du-pi>`, `<ip-du-pi>`, `<login>`…), **Update comment**.
2. Ouvre le menu **edited** du même texte. Pour chaque ancienne version qui contient une valeur : **Delete revision from history**.

Relance `verifier` jusqu'à `Bilan : 0 occurrence(s) hors refs/pull/*`.
## 8. Demander la purge au support GitHub (critère 6)

GitHub garde les anciens commits dans les références `refs/pull/*` des PR et dans ses vues en cache : seul son support peut les purger. Formulaire : https://support.github.com/contact, catégorie « Remove sensitive data ». Message, **sans aucune valeur** :

> Repository: HSSRD/Etendard (public, no forks: checked by the script). We removed sensitive data from the history with `git filter-repo --sensitive-data-removal` and force-pushed `main`. All other branches, and the tags and releases of the old history, were deleted. Please purge the cached views and the `refs/pull/*` references of all pull requests, which still point to the old commits, and run a garbage collection. First changed commit(s): `<sortie de l'étape 4>`. Git LFS is not used.

Note le numéro de la demande en commentaire du ticket #31. Une fois la purge faite, `verifier` doit afficher 0 aussi pour `refs/pull/*`.

## 9. Preuves

Colle en commentaire du ticket #31 la sortie finale de `verifier` (elle ne contient que des numéros de valeur, des compteurs et des liens), le lien du déploiement vert de l'étape 5 et le numéro de la demande au support.

Une fois la purge confirmée, retire ce dossier `infra/historique/` par une PR : il ne sert qu'une fois.
