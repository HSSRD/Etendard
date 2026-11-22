#!/usr/bin/env bash
# Vérifie l'isolation des agents (#70) depuis une session agent, dans un clone du repo.
# Usage : bash infra/agents/verifier-isolation.sh
# Ouvre puis ferme une PR de test qui touche infra/pi/ (attend sa CI : compter une dizaine de minutes en tout).
# Lance-le sur un arbre de travail propre. N'affiche jamais de jeton.
set -u

PROFIL=C:/Users/floxf
DEPOT_FLO=C:/04-Projets/HSSRD/Etendard
REPO=HSSRD/Etendard
ID=$(date +%s)
echecs=0
alertes=0

ok() { printf 'OK    %s\n' "$1"; }
ko() { printf 'ÉCHEC %s\n' "$1"; echecs=$((echecs + 1)); }

echo "== 1. Identité GitHub"
jeton_type=$(gh auth token 2>/dev/null | cut -c1-4)
if [ "$jeton_type" = "ghs_" ]; then
  ok "gh auth token est un jeton d'installation d'App (ghs_), pas le jeton OAuth de Flo (gho_)"
else
  ko "gh auth token n'est pas un jeton d'installation (préfixe : ${jeton_type:-aucun})"
fi
if gh api installation/repositories -q '.repositories[].full_name' 2>/dev/null | grep -qx "$REPO"; then
  ok "le jeton est celui d'une installation de l'App sur $REPO"
else
  ko "gh api installation/repositories ne liste pas $REPO"
fi
if [ "$(git config user.name)" = "hssrd-bot[bot]" ]; then
  ok "les commits sont signés hssrd-bot[bot] <$(git config user.email)>"
else
  ko "git config user.name vaut « $(git config user.name) »"
fi

echo "== 2. Fichiers de Flo"
for chemin in "$PROFIL" "$PROFIL/.ssh" "$PROFIL/AppData/Roaming/GitHub CLI/hosts.yml" "$PROFIL/.etendard" "$DEPOT_FLO" /c/ProgramData/floxf; do
  if ls "$chemin" >/dev/null 2>&1; then ko "$chemin est lisible"; else ok "$chemin est inaccessible"; fi
done
# Un dossier de Flo modifiable laisserait planter du code qu'il exécute (hooks git, PATH, exécutables de jeux…).
# Même audit qu'à l'étape 4 du README, vu depuis le compte agent (quelques minutes).
# Les dossiers « à fermer à la main » (Program Files, ProgramData) sont des alertes, pas des échecs : Windows et des
# logiciels en ouvrent volontairement certains à tous (Microsoft\Crypto\RSA\MachineKeys, WER) ; Flo décide au cas par cas.
script_audit="$(dirname "$0")/dossiers-ouverts.ps1"
if ! ouverts=$(powershell -NoProfile -ExecutionPolicy Bypass -Command \
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8; & '$script_audit'; exit \$LASTEXITCODE"); then
  ko "audit des dossiers impossible (dossiers-ouverts.ps1)"
else
  ouverts=${ouverts//$'\r'/}
  a_corriger=0 manuels=0
  while IFS= read -r dossier; do
    case "$dossier" in
      '') ;;
      *"(à fermer à la main)")
        manuels=$((manuels + 1))
        [ "$manuels" -le 20 ] && printf 'ALERTE %s est modifiable\n' "$dossier" ;;
      *) a_corriger=$((a_corriger + 1)); ko "$dossier est modifiable (étape 4 : dossiers-ouverts.ps1 -Corriger)" ;;
    esac
  done <<<"$ouverts"
  [ "$manuels" -gt 20 ] && echo "ALERTE … et $((manuels - 20)) autres (liste complète : dossiers-ouverts.ps1 sans option)"
  alertes=$manuels
  [ "$a_corriger" -eq 0 ] && ok "aucun dossier hors Program Files et ProgramData n'est modifiable par un groupe du compte agent"
fi
# Dossiers que l'audit ne parcourt pas : celui de Flo dans ProgramData et le jeton (lecture seule pour l'agent).
for dossier in /c/ProgramData/floxf/ /c/EtendardAgent/gh/; do
  [ -d "$dossier" ] || continue
  if (: >"${dossier}test-isolation-$ID") 2>/dev/null || mkdir "${dossier}test-isolation-$ID" 2>/dev/null; then
    rm -rf "${dossier}test-isolation-$ID"
    ko "$dossier est modifiable"
  else
    ok "$dossier n'est pas modifiable"
  fi
done

if mkdir /c/ProgramData/Git/test-isolation-$ID 2>/dev/null; then
  rmdir /c/ProgramData/Git/test-isolation-$ID
  ko "C:/ProgramData/Git est modifiable (configuration système du git de Flo)"
elif [ -d /c/ProgramData/Git ]; then
  ok "C:/ProgramData/Git existe et n'est pas modifiable"
else
  ko "C:/ProgramData/Git n'existe pas : le compte agent pourrait le créer"
fi

# Les sections 3 et 4 créent des commits de test : jamais sur une branche de travail.
git diff --quiet HEAD || { echo "Arbre de travail modifié : lance le script sur un worktree propre."; exit 1; }
git fetch -q origin main
retour=$(git symbolic-ref -q --short HEAD || git rev-parse HEAD) # branche, ou commit si HEAD est détachée

echo "== 3. Push d'une modification de .github/workflows/"
branche_wf="test-isolation-workflows-$ID"
git switch -q -c "$branche_wf" origin/main || exit 1
echo "# test d'isolation $ID" >>.github/workflows/ci.yml
git commit -q -am "test: modification de workflow refusée (#70)"
sortie=$(git push origin "$branche_wf" 2>&1)
if [ $? -ne 0 ] && grep -q "refusing to allow a GitHub App" <<<"$sortie"; then
  ok "push refusé : $(grep "refusing to allow a GitHub App" <<<"$sortie" | head -n 1)"
else
  ko "le push de $branche_wf n'a pas été refusé pour la permission workflows"
  git push -q origin --delete "$branche_wf" 2>/dev/null
fi
git checkout -q "$retour" && git branch -q -D "$branche_wf"

echo "== 4. Merge d'une PR qui touche infra/pi/"
branche_pi="test-isolation-infra-pi-$ID"
git switch -q -c "$branche_pi" origin/main || exit 1
echo "<!-- test d'isolation $ID -->" >>infra/pi/README.md
# Avec la CI : sans elle, « Bloque push main » refuse déjà le merge (check verify absent) et masque le ruleset.
git commit -q -am "test: merge refusé d'une PR infra/pi (#70)"
if git push -q origin "$branche_pi" 2>/dev/null; then
  url=$(gh pr create -R "$REPO" --head "$branche_pi" \
    --title "test: merge refusé d'une PR infra/pi (#70), ne pas merger" \
    --body "PR de test de l'isolation des agents (#70), fermée par le script après sa CI.")
fi
if [ -z "${url:-}" ]; then
  ko "push de $branche_pi ou création de sa PR de test impossible"
  git push -q origin --delete "$branche_pi" 2>/dev/null
else
  echo "PR de test : $url (attente de la CI)"
  sleep 20 # le temps que GitHub enregistre le run
  gh pr checks "$url" --watch --interval 20 >/dev/null 2>&1
  ci=$(gh pr view "$url" --json statusCheckRollup -q '[.statusCheckRollup[] | select(.name == "verify") | .conclusion] | first // ""')
  etat=$(gh pr view "$url" --json mergeStateStatus -q .mergeStateStatus)
  if [ "$ci" != "SUCCESS" ]; then
    ko "CI de la PR de test non verte (verify : ${ci:-absent}) : test du merge non concluant"
  elif [ "$etat" != "BLOCKED" ]; then
    # On ne tente pas le merge : il passerait, et mettrait un commit de test sur main.
    ko "la PR de test, CI verte, est mergeable par le bot (mergeStateStatus=$etat) : la relecture de Flo n'est pas imposée"
  else
    # Bloquée CI verte : seul le ruleset de relecture reste. Le refus de GitHub doit le nommer.
    sortie=$(gh pr merge "$url" --squash 2>&1)
    if [ $? -eq 0 ]; then
      ko "la PR $url a été mergée sans relecture de Flo : à annuler (revert) d'urgence"
    elif grep -qi "code owner" <<<"$sortie"; then
      ok "merge refusé, CI verte : $(grep -i -m 1 "code owner" <<<"$sortie")"
    else
      ko "merge refusé sans mention de la relecture d'un code owner : $(tr '\n' ' ' <<<"$sortie")"
    fi
  fi
  gh pr close "$url" >/dev/null
  git push -q origin --delete "$branche_pi"
fi
git checkout -q "$retour" && git branch -q -D "$branche_pi"

echo
if [ "$echecs" -eq 0 ]; then echo "Isolation vérifiée."; else echo "$echecs vérification(s) en échec."; fi
[ "$alertes" -eq 0 ] || echo "$alertes dossier(s) de Program Files ou ProgramData restent modifiables : à fermer à la main si aucun logiciel n'en a besoin (jamais ceux de ProgramData\\Microsoft)."
# Code de sortie 0 ou 1 : un nombre d'échecs multiple de 256 sortirait en 0.
[ "$echecs" -eq 0 ]
