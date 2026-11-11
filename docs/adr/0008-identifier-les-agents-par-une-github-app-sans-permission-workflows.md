# 0008. Identifier les agents par la GitHub App `hssrd-bot`, sans permission `workflows`

- Statut : Accepté
- Date : 2026-11-07, révisé le 2026-11-11 (#70 : agents locaux dans Orca)

## Contexte

Les agents ouvrent des PR, commentent et étiquettent des tickets (0010). Avec le compte de Flo, il ne pourrait pas approuver ses propres PR et l'historique ne distinguerait pas le travail humain de celui des agents. Avec le `GITHUB_TOKEN` d'Actions, les événements produits ne déclenchent pas d'autres workflows (comportement documenté par GitHub) : une PR ouverte par un agent ne lancerait pas `ci.yml`.

Les agents du skill `ticket` tournent aussi en local, dans Orca. Lancés sous le compte Windows de Flo, ils utilisaient son `gh` (jeton OAuth aux portées `repo` et `workflow`) : ils pouvaient merger une PR qui touche `infra/pi/` (appliquée en root sur le Pi, #69), modifier `.github/workflows/` ou les rulesets. Seules des consignes l'empêchaient, contournables par injection (0011). Tant qu'un agent tourne sous le compte de Flo, il peut lire son `gh`, ses clés SSH et la clé privée de l'App : une identité séparée n'y protège rien.

## Décision

- Créer une **GitHub App `hssrd-bot`** installée sur le seul repo `Etendard`, utilisée par tous les agents via un jeton d'installation, valable une heure.
- Permissions : `contents: write`, `pull-requests: write`, `issues: write`, en lecture `actions`, `checks`, `statuses` (suivi de la CI, `pnpm captures:ci`) et métadonnées. **Pas de permission `workflows`** : un push modifiant `.github/workflows/` est refusé par GitHub, l'agent ne peut pas s'accorder de droits. Ni `administration`, ni `environments`, ni `deployments` : un agent ne peut ni changer un ruleset ni approuver un déploiement.
- **Agents d'Actions** (0010) : jeton émis par `actions/create-github-app-token`, transmis à `claude-code-action` par son entrée `github_token`.
- **Agents locaux (Orca)** : ils tournent sous un compte Windows dédié, `etendard-agent`, sans droit d'administrateur, servi par un runtime `orca serve` de ce compte, lancé en tâche planifiée hors du bureau de Flo (ni son presse-papiers ni ses fenêtres) et appairé à son Orca. Ce compte n'a ni le `gh` de Flo, ni ses clés SSH, ni la clé de l'App, ni accès au profil de Flo ni à son dépôt principal, ni droit d'écriture dans les autres dossiers de Flo à la racine des disques. Une tâche planifiée du compte de Flo émet un jeton toutes les 10 minutes (`scripts/jeton-bot.js`, copie relue rangée dans son profil) et l'écrit dans la configuration `gh` des agents, qu'ils lisent sans pouvoir la modifier. Commits et PR sont au nom de `hssrd-bot[bot]`. Mise en place : `infra/agents/README.md`.
- **Relecture de Flo obligatoire** sur les chemins de `.github/CODEOWNERS` : tout ce qui s'exécute ou fait consigne avec des privilèges (en root sur le Pi, avec les secrets de production, avec la clé de l'App, ou dans la session de Flo : skill `ticket`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, ADR) ; ruleset « Relecture de Flo (CODEOWNERS) », sans exception pour l'App.
- Les PR d'agents sont assignées à Flo, qui les relit et les merge.

## Alternatives écartées

- **Compte de Flo (jeton personnel)** : pas d'auto-approbation possible, historique mélangé, jeton aux droits trop larges.
- **`GITHUB_TOKEN` seul** : ne déclenche pas la CI sur les PR créées.
- **Compte machine GitHub** : un compte utilisateur de plus à gérer, permissions moins fines qu'une App.
- **Jeton de l'App dans le compte de Flo (`GH_TOKEN`) sans compte Windows dédié** : l'agent garde l'accès au `gh` de Flo et à la clé de l'App.
- **WSL ou machine virtuelle** : isolation plus forte, mais Orca, Playwright et les captures sous Windows seraient à refaire ; le compte dédié suffit au risque visé (jetons et fichiers de Flo).

## Conséquences

- La clé privée de l'App est un secret des workflows d'agents et du seul profil Windows de Flo ; elle ne donne jamais accès à l'Environment `production` (0011).
- Toute modification de workflow passe par Flo : l'agent prépare la PR sans le fichier de workflow et joint le correctif, que Flo pousse.
- L'App n'a aucune exception dans la protection de `main`.
- Le skill `ticket` est suivi dans le repo, pour que le clone des agents l'ait.

## Risques résiduels

- **Code du repo exécuté par Flo** : une PR d'agent hors CODEOWNERS (config, scripts, tests), ou un commit du bot sur une branche que Flo récupère, s'exécute sous le compte de Flo dès qu'il lance `pnpm`, avec accès à son `gh` et à la clé de l'App (point de vigilance de 0011). Le compte dédié ne couvre pas ce cas.
- **Écriture hors de ces dossiers** : le compte agent peut encore créer des dossiers à la racine de `C:\` et dans `C:\ProgramData` (droits Windows par défaut) ; `C:\ProgramData\Git` est fermé d'avance.
- **Lecture et réseau** : `etendard-agent` lit encore les dossiers de Flo hors profil (sauf `C:\04-Projets` et `C:\ProgramData\floxf`) et garde l'accès réseau du PC (tailnet, LAN, Pi, services de Flo sur 127.0.0.1).
- **Phase A du skill** : elle lit tickets, commentaires et l'état Orca des agents (contenus non fiables, 0011) dans la session de Flo, avec son `gh`.
