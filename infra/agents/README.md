# Isoler les agents Orca (ADR 0008, #70)

Les agents Orca tournent sous un compte Windows dédié, `etendard-agent`, sans droit d'administrateur.
Ils agissent sur GitHub avec un jeton d'installation de la GitHub App `hssrd-bot`, valable une heure.
Le compte de Flo garde seul la clé privée de l'App, son `gh` et ses clés SSH.

```text
Compte floxf                                  Compte etendard-agent
  %USERPROFILE%\.etendard\hssrd-bot.pem         (ni profil de Flo ni C:\04-Projets ; dossiers de Flo non modifiables)
  tâche « Etendard - jeton hssrd-bot »          C:\EtendardAgent\gh\hosts.yml  (lecture seule)
    toutes les 10 min : jeton-bot.js  ──écrit──►  gh, git (gh auth setup-git)
  Orca (bureau) ──appairé (127.0.0.1)──────────► orca serve (tâche planifiée, hors du bureau de Flo)
                                                  → worktrees, terminaux, agents claude
```

Toutes les étapes sont à faire par Flo. Aucune ne demande de montrer la clé, un jeton ou le code d'appairage à un agent.
Les commandes PowerShell marquées **(admin)** se lancent dans un PowerShell « Exécuter en tant qu'administrateur ».

## 0. Avant de commencer

Le skill `ticket` est désormais suivi dans le repo (`.claude/skills/ticket/SKILL.md`), pour que le clone des agents l'ait.
La copie non suivie du dépôt principal empêcherait `git switch` ou `git pull` de l'apporter : retire-la d'abord.
La branche est déjà ouverte dans le worktree Orca du ticket : le dépôt principal en prend la tête, détachée.

```powershell
cd C:\04-Projets\HSSRD\Etendard
Remove-Item .claude\skills\ticket\SKILL.md
git fetch origin; git switch --detach origin/issue-70-identite-agents   # tête relue de la PR, utilisée aux étapes 4, 6 et 9
```

## 1. Créer la GitHub App `hssrd-bot`

1. https://github.com/organizations/HSSRD/settings/apps/new
   - Nom : `hssrd-bot` ; URL : `https://github.com/HSSRD/Etendard` ; Webhook : décocher « Active ».
   - **Repository permissions** : Actions `Read-only`, Checks `Read-only`, Commit statuses `Read-only`,
     Contents `Read and write`, Issues `Read and write`, Metadata `Read-only`, Pull requests `Read and write`.
     Tout le reste à `No access`, en particulier **Workflows**, Administration, Environments, Deployments, Secrets.
   - **Organization permissions** : aucune. « Where can this GitHub App be installed? » : Only on this account.
2. Note le **Client ID** de la page de l'App.
3. « Generate a private key » : le fichier `.pem` se télécharge (étape 2).
4. « Install App » → HSSRD → **Only select repositories** → `Etendard` (pas « All repositories » : la clé
   donnerait accès à tous les repos de l'organisation).
   L'URL de la page obtenue se termine par l'**installation ID** (`.../installations/<nombre>`) ;
   on la retrouve dans HSSRD → Settings → GitHub Apps → hssrd-bot → Configure.

Une permission changée après l'installation n'y est appliquée qu'une fois acceptée : page de l'installation →
bandeau de revue → « Accept new permissions ». Sinon le script de l'étape 6 échoue en 422 (« The level of access for
permissions requested are not granted to this installation »).

## 2. Ranger la clé privée dans le profil de Flo

PowerShell de Flo (sans admin), en remplaçant le nom du fichier téléchargé :

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.etendard" | Out-Null
Move-Item "$env:USERPROFILE\Downloads\hssrd-bot.<date>.private-key.pem" "$env:USERPROFILE\.etendard\hssrd-bot.pem"
icacls "$env:USERPROFILE\.etendard" /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F"
```

La clé ne quitte plus ce dossier. Ne la copie ni dans un repo, ni dans `C:\EtendardAgent`.

## 3. Créer le compte Windows `etendard-agent` **(admin)**

```powershell
$mdp = Read-Host -AsSecureString "Mot de passe de etendard-agent"
New-LocalUser -Name etendard-agent -Password $mdp -FullName "Agents Etendard" -Description "Agents Orca de HSSRD/Etendard" -PasswordNeverExpires -UserMayNotChangePassword
Add-LocalGroupMember -SID S-1-5-32-545 -Member etendard-agent   # Utilisateurs, pas Administrateurs
Get-LocalGroupMember -SID S-1-5-32-544                          # etendard-agent ne doit pas y figurer
```

Garde le mot de passe dans ton gestionnaire : il sert aux étapes 7 (`runas`) et 8 (tâche planifiée).

Donne ensuite au compte le droit « Ouvrir une session en tant que tâche », sans lequel la tâche de l'étape 8 ne
démarre jamais (`LastTaskResult` 267011, sans erreur affichée) : `secpol.msc` → Stratégies locales → Attribution des
droits utilisateur → **Ouvrir une session en tant que tâche** → Ajouter un utilisateur ou un groupe → `etendard-agent`.
Ce droit ne donne aucun accès de plus : il permet seulement au compte de faire tourner une tâche sans session ouverte.

## 4. Fermer à ce compte les dossiers de Flo hors profil **(admin)**

Le profil `C:\Users\floxf` est déjà privé. Mais les dossiers créés à la racine d'un disque héritent
« Utilisateurs authentifiés : Modification » : `etendard-agent` pourrait écrire dans le dépôt principal
(`C:\04-Projets\HSSRD\Etendard\.git\hooks`, exécutés ensuite par le git de Flo) ou dans `C:\03-VSCode`.
De même, `C:\ProgramData\floxf\GitHubDesktop\bin`, dans le PATH de Flo, est ouvert en écriture aux Utilisateurs :
un `fnm.cmd` déposé là s'exécuterait sous Flo à l'ouverture de son terminal. Des installeurs ajoutent aussi des
règles explicites « Utilisateurs » ou « Tout le monde : Contrôle total », jusque dans des sous-dossiers
(`C:\01-Steam`, `D:\02-Jeux\01-Steam`, `GameCenter` de Wargaming) : un exécutable remplacé là tournerait sous Flo.

`C:\04-Projets` (dépôt principal compris) et `C:\ProgramData\floxf` sont réservés à Flo, lecture comprise. Pour les
autres dossiers de tous les disques locaux (cachés compris, comme `C:\OneDriveTemp`), `dossiers-ouverts.ps1` retire
les droits de tous les groupes dont le compte agent est membre (Utilisateurs, Utilisateurs authentifiés, Tout le monde,
Interactif, Batch…), au premier niveau comme dans les sous-dossiers à règle explicite. Flo garde l'écriture ; les
Utilisateurs gardent la lecture au premier niveau, et plus bas celle héritée du parent. Les dossiers système et Store
(`Windows`, `WindowsApps`, `XboxGames`…) ne sont parcourus sur aucun disque. Dans `Program Files` et `ProgramData`,
le script signale les sous-dossiers à règle explicite sans les corriger (« à fermer à la main ») : un logiciel peut
en dépendre, comme `C:\Program Files\GOG Galaxy\Games` pour installer des jeux sans administrateur. Ferme ceux dont
tu n'as pas besoin (`icacls <dossier> /remove:g *S-1-5-32-545 *S-1-5-11 *S-1-1-0`) ; un dossier laissé ouvert reste
un risque, noté dans ADR 0008. **Ne ferme jamais ceux de `ProgramData\Microsoft`** (`Crypto\RSA\MachineKeys`, `WER`…) :
Windows les ouvre à tous exprès. Le parcours prend de quelques minutes à une demi-heure selon les disques, sans rien
afficher avant la fin. Relance-le après avoir créé un dossier à la racine d'un disque ou installé un logiciel.

```powershell
# C:\ProgramData\Git\config serait lue comme configuration système par le git de Flo : le dossier est créé fermé.
New-Item -ItemType Directory -Force C:\ProgramData\Git | Out-Null
icacls C:\ProgramData\Git /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-32-545:(OI)(CI)RX" /Q
foreach ($d in 'C:\04-Projets','C:\ProgramData\floxf') {
  icacls $d /inheritance:r /grant:r "floxf:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /Q
}
cd C:\04-Projets\HSSRD\Etendard
powershell -NoProfile -ExecutionPolicy Bypass -File infra\agents\dossiers-ouverts.ps1             # relis la liste avant de corriger
powershell -NoProfile -ExecutionPolicy Bypass -File infra\agents\dossiers-ouverts.ps1 -Corriger   # affiche les dossiers corrigés
icacls C:\04-Projets   # attendu : floxf, SYSTEM, Administrateurs, rien d'autre
```

Si un logiciel ne se met plus à jour, c'est qu'il passait par ces droits : relance sa mise à jour en administrateur.
Le script de l'étape 10 refait l'audit depuis le compte agent : il ne doit plus lister aucun dossier à corriger
(ÉCHEC). Les dossiers « à fermer à la main » y restent en ALERTE, sans faire échouer la vérification.

## 5. Préparer le dossier du jeton **(admin)**

```powershell
New-Item -ItemType Directory -Force C:\EtendardAgent\gh | Out-Null
icacls C:\EtendardAgent /inheritance:r /grant:r "floxf:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "etendard-agent:(OI)(CI)RX"
```

`etendard-agent` lit le jeton sans pouvoir le remplacer.

## 6. Émettre le jeton toutes les 10 minutes **(admin)**

Depuis le dépôt principal, sur la tête relue de la PR (étape 0, ou `main` après merge), copie le script dans le
profil de Flo : la tâche n'exécute jamais une version du repo qu'un agent aurait pu modifier.
Recopie-le seulement après avoir relu ses changements (`scripts/jeton-bot.js` est sous CODEOWNERS).

```powershell
Copy-Item C:\04-Projets\HSSRD\Etendard\scripts\jeton-bot.js "$env:USERPROFILE\.etendard\jeton-bot.js"
$clientId = "<Client ID>"; $installationId = "<installation ID>"
$action = New-ScheduledTaskAction -Execute "$env:APPDATA\fnm\aliases\default\node.exe" `
  -Argument "`"$env:USERPROFILE\.etendard\jeton-bot.js`" $clientId $installationId `"$env:USERPROFILE\.etendard\hssrd-bot.pem`" C:\EtendardAgent\gh"
$declencheurs = @(
  (New-ScheduledTaskTrigger -AtStartup),
  (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10))
)
$compte = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$env:USERNAME" -LogonType S4U -RunLevel Limited
$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "Etendard - jeton hssrd-bot" -Action $action -Trigger $declencheurs -Principal $compte -Settings $reglages
Start-ScheduledTask "Etendard - jeton hssrd-bot"; Start-Sleep 10
Get-ScheduledTaskInfo "Etendard - jeton hssrd-bot" | Select-Object LastRunTime, LastTaskResult, NextRunTime   # 0, puis dans 10 min
Test-Path C:\EtendardAgent\gh\hosts.yml                                                                      # True attendu
```

Une erreur de `Register-ScheduledTask` se perd facilement dans un bloc collé d'un coup : si `Get-ScheduledTaskInfo`
ne trouve pas la tâche, relance les commandes une à une. Si le jeton manque, lance le script à la main avec les mêmes
arguments : il affiche l'erreur de GitHub (jamais le jeton). Une 422 vient des permissions de l'installation (étape 1).

La tâche tourne sous le compte de Flo (S4U : sans fenêtre ni mot de passe enregistré), donc seule elle lit la clé.
Un échec (réseau absent au démarrage) n'est pas relancé par Windows : la répétition toutes les 10 minutes le rattrape.
PC éteint, le jeton expire au bout d'une heure ; il est réémis au démarrage, avant que les agents en aient besoin.

## 7. Outiller le compte `etendard-agent`

Le compte agent ne lit pas les téléchargements de Flo : dans un PowerShell de Flo, dépose d'abord l'installeur
d'Orca (releases GitHub de `stablyai/orca`, la source de ses mises à jour) dans un dossier lisible par tous.

```powershell
gh release download -R stablyai/orca --pattern orca-windows-setup.exe --dir C:\Users\Public\Downloads
```

Ouvre ensuite une session PowerShell sous ce compte (le premier lancement crée son profil). Elle partage le bureau
de Flo (presse-papiers, fenêtres) : ne t'en sers que pour l'installation, jamais pour lancer un agent.

```powershell
runas /user:etendard-agent powershell
```

**Ne lance la suite que dans cette fenêtre**, dont le titre indique `etendard-agent` (`whoami` le confirme) :
lancées dans une session de Flo, ces commandes y mettent l'identité et le jeton du bot à la place des siens
(réparation : retirer `GH_CONFIG_DIR` de ses variables, remettre son `user.name` et son `user.email`).

```powershell
whoami                               # <PC>\etendard-agent
[Environment]::SetEnvironmentVariable('GH_CONFIG_DIR', 'C:\EtendardAgent\gh', 'User')
$env:GH_CONFIG_DIR = 'C:\EtendardAgent\gh'
gh auth status                       # « Logged in to github.com account hssrd-bot[bot] »
gh auth setup-git                    # git s'authentifie avec le jeton de gh
$id = gh api 'users/hssrd-bot%5Bbot%5D' -q .id
git config --global user.name 'hssrd-bot[bot]'
git config --global user.email "$id+hssrd-bot[bot]@users.noreply.github.com"
git config --global user.email       # commence par un nombre : sinon le jeton manquait (étape 6)

# Scripts PowerShell (npm.ps1, pnpm.ps1) autorisés pour ce compte seulement : un compte neuf les refuse.
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force

# Node 26 et pnpm (même version que le poste de Flo), Claude Code, Orca : installations propres au compte.
# fnm depuis ses releases : winget n'a souvent pas de source utilisable sur un compte neuf (0x8a15000f).
$fnm = "$env:LOCALAPPDATA\fnm"
New-Item -ItemType Directory -Force $fnm | Out-Null
Invoke-WebRequest https://github.com/Schniz/fnm/releases/latest/download/fnm-windows.zip -OutFile "$env:TEMP\fnm.zip" -UseBasicParsing
Expand-Archive "$env:TEMP\fnm.zip" $fnm -Force; Remove-Item "$env:TEMP\fnm.zip"
$env:Path = "$fnm;$env:Path"
fnm install 26; fnm default 26
# fnm et Node dans le PATH du compte (sans `fnm env`), pour cette fenêtre et pour les terminaux d'`orca serve`.
$node = "$env:APPDATA\fnm\aliases\default"
[Environment]::SetEnvironmentVariable('Path', "$node;$fnm;" + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')
$env:Path = "$node;$env:Path"
npm install -g corepack; corepack enable   # Node 26 ne fournit plus corepack
irm https://claude.ai/install.ps1 | iex
claude                                     # sans option : connexion au compte Claude, puis /exit
& C:\Users\Public\Downloads\orca-windows-setup.exe   # installation par utilisateur
Test-Path "$env:LOCALAPPDATA\Programs\orca\resources\bin\orca.cmd"   # True attendu

git clone https://github.com/HSSRD/Etendard.git $env:USERPROFILE\Etendard
cd $env:USERPROFILE\Etendard; pnpm install; pnpm exec playwright install chromium
```

Supprime ensuite l'installeur de `C:\Users\Public\Downloads`.

Le compte n'a ni `gh` de Flo, ni clé SSH, ni Git Credential Manager connecté : le clone passe en HTTPS public,
les push par le jeton de `hssrd-bot`.

## 8. Lancer le runtime Orca des agents et l'appairer

Appairage, une seule fois, dans la fenêtre `etendard-agent` de l'étape 7 :

```powershell
& "$env:LOCALAPPDATA\Programs\orca\resources\bin\orca.cmd" serve --bind 127.0.0.1 --port 6769
```

Port fixe, le même dans la tâche planifiée ci-dessous : l'Orca de Flo occupe déjà 6768, le port par défaut, et sans
`--port` le runtime en prendrait un autre à chaque démarrage, ce qui casserait l'appairage.
`orca serve` affiche un code `orca://pair?...`. Dans un PowerShell de Flo :

```powershell
orca environment add --name etendard-agent --pairing-code "<code affiché>"
```

Arrête ensuite `orca serve` (Ctrl+C) et ferme la fenêtre `etendard-agent` : tant qu'il tourne, il répond à la place
de la tâche et masque un échec de celle-ci. Le runtime des agents tourne désormais en tâche planifiée, dans une
session sans bureau : un agent n'atteint ni le presse-papiers ni les fenêtres de Flo. Elle exige le droit « Ouvrir
une session en tant que tâche » de l'étape 3. **(admin)** :

```powershell
$agent = Get-Credential "$env:COMPUTERNAME\etendard-agent"   # mot de passe de l'étape 3, vérifié seulement au lancement
# Sortie du runtime dans un journal du compte agent, pour diagnostiquer un arrêt.
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c ""C:\Users\etendard-agent\AppData\Local\Programs\orca\resources\bin\orca.cmd" serve --bind 127.0.0.1 --port 6769 > "C:\Users\etendard-agent\orca-serve.log" 2>&1"'
# Sans limite de durée, priorité normale (7 par défaut ralentirait pnpm et Playwright) ; s'il s'arrête : Start-ScheduledTask.
$reglages = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -Priority 5
Register-ScheduledTask -TaskName "Etendard - Orca des agents" -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -User $agent.UserName -Password $agent.GetNetworkCredential().Password -Settings $reglages
Start-ScheduledTask "Etendard - Orca des agents"; Start-Sleep 20
(Get-ScheduledTask "Etendard - Orca des agents").State             # Running attendu
Get-NetTCPConnection -LocalPort 6769 -State Listen                 # une ligne sur 127.0.0.1 attendue
```

Diagnostic si la tâche ne tourne pas :

- `LastTaskResult` 267011 et `LastRunTime` en 1999 (`Get-ScheduledTaskInfo`) : jamais lancée, droit de l'étape 3 absent ;
- erreur 0x8007052E à l'enregistrement : mot de passe incorrect (`Set-LocalUser etendard-agent -Password` pour le changer) ;
- lancée puis arrêtée : `Get-Content C:\Users\etendard-agent\orca-serve.log -Tail 30` (masque un code `orca://pair` avant de le partager).

Puis, dans un PowerShell de Flo :

```powershell
orca status --environment etendard-agent --json   # runtime joignable : l'appairage a survécu au redémarrage du serveur
orca repo add --environment etendard-agent --path C:\Users\etendard-agent\Etendard --json
```

Ce runtime sans fenêtre ne se met pas à jour seul : pour suivre l'Orca de Flo, relance l'installeur sous
`etendard-agent` (`runas`), puis `Stop-ScheduledTask` et `Start-ScheduledTask "Etendard - Orca des agents"`.

Les worktrees, terminaux et agents créés avec `--environment etendard-agent` tournent alors sous ce compte ;
ils s'affichent dans l'Orca de Flo comme ceux de la machine.

## 9. Imposer la relecture de Flo sur les chemins de `.github/CODEOWNERS`

Depuis le dépôt principal, sur la tête relue de la PR (étape 0), avec le `gh` de Flo : un terminal ouvert avant
une erreur de l'étape 7 peut encore porter le jeton du bot, que GitHub refuse (403 « Resource not accessible by integration »).

```powershell
gh auth status   # Logged in to github.com account <compte de Flo>
gh api -X POST repos/HSSRD/Etendard/rulesets --input infra/agents/ruleset-relecture-flo.json
```

Ce ruleset exige l'approbation d'un code owner (`.github/CODEOWNERS`) pour toute PR qui touche ces chemins.
Le rôle Admin (Flo) peut le contourner pour ses propres PR ; `hssrd-bot` n'a aucune exception.
Le bot peut pousser sur toute branche, y compris celle d'une PR de Flo, et l'auteur d'un commit se falsifie.
Contourne donc depuis ta copie locale de la branche, plutôt que par la case de l'interface : le merge échoue si la tête
de la PR n'est plus ton commit, même poussé entre ta vérification et le merge.

```powershell
gh pr merge <numéro> --squash --admin --match-head-commit "$(git rev-parse HEAD)"
```
Le ruleset « Bloque push main » reste inchangé (CI verte, branche à jour, squash) et s'applique à tous.

Merge ensuite la PR du ticket #70 : `.github/CODEOWNERS` doit être sur `main` pour que le ruleset ait des chemins à protéger.

## 10. Vérifier depuis une session agent

```powershell
orca worktree create --environment etendard-agent --repo path:C:/Users/etendard-agent/Etendard `
  --name verif-isolation --no-parent --agent claude `
  --prompt "Lance git fetch origin && git reset --hard origin/main, puis bash infra/agents/verifier-isolation.sh en arrière-plan (il dure plus que le délai par défaut d'une commande) en attendant sa fin, et poste sa sortie complète en commentaire du ticket #70."
```

Le script prend une dizaine de minutes (audit des dossiers de l'étape 4, puis CI de la PR de test `infra/pi/`)
et doit finir par « Isolation vérifiée. ». La PR de test attend sa CI : sans elle, « Bloque push main » refuserait
déjà le merge et masquerait le ruleset. Le script ne tente le merge que si GitHub le bloque, CI verte ; il ferme
ensuite la PR. Une PR de test restée ouverte (script interrompu) se ferme sans merger.
Le commentaire posté par `hssrd-bot` prouve à lui seul que les PR et commentaires des agents sont au nom du bot.

## Révoquer

- Un jeton fuité : il expire seul en moins d'une heure ; pour couper tout de suite, suspends l'installation
  de l'App (HSSRD → Settings → GitHub Apps → hssrd-bot → Suspend).
- La clé : supprime-la dans la page de l'App et génère-en une autre (étapes 1.3 et 2).
