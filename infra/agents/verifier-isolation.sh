#!/usr/bin/env bash
# Vérifie l'isolation des agents (#70) depuis une session agent, dans un clone du repo.
# Usage : bash infra/agents/verifier-isolation.sh
# Ouvre puis ferme une PR de test qui touche infra/pi/. Lance-le sur un arbre de travail propre.
# N'affiche jamais de jeton.
set -u

PROFIL=C:/Users/floxf
DEPOT_FLO=C:/04-Projets/HSSRD/Etendard
REPO=HSSRD/Etendard
ID=$(date +%s)
echecs=0

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
for chemin in "$PROFIL" "$PROFIL/.ssh" "$PROFIL/AppData/Roaming/GitHub CLI/hosts.yml" "$PROFIL/.etendard" "$DEPOT_FLO"; do
  if ls "$chemin" >/dev/null 2>&1; then ko "$chemin est lisible"; else ok "$chemin est inaccessible"; fi
done
# Un dossier de Flo modifiable laisserait planter du code qu'il exécute (hooks git, PATH…).
# Mêmes dossiers que l'étape 4 du README, plus le dossier du jeton (lecture seule pour l'agent).
for dossier in /c/*/ /d/*/ /e/*/ /c/ProgramData/floxf/ /c/EtendardAgent/gh/; do
  [ -d "$dossier" ] || continue
  case "$(basename "$dossier")" in
    \$* | Windows | Users | ProgramData | "Program Files"* | WindowsApps | WpSystem | "System Volume Information" | "Documents and Settings" | EtendardAgent) continue ;;
  esac
  if (: >"${dossier}test-isolation-$ID") 2>/dev/null; then
    rm -f "${dossier}test-isolation-$ID"
    ko "$dossier est modifiable"
  else
    ok "$dossier n'est pas modifiable"
  fi
done

git fetch -q origin main
retour=$(git rev-parse --abbrev-ref HEAD)

echo "== 3. Push d'une modification de .github/workflows/"
branche_wf="test-isolation-workflows-$ID"
git switch -q -c "$branche_wf" origin/main
echo "# test d'isolation $ID" >>.github/workflows/ci.yml
git commit -q -am "test: modification de workflow refusée (#70)"
sortie=$(git push origin "$branche_wf" 2>&1)
if [ $? -ne 0 ] && grep -q "refusing to allow a GitHub App" <<<"$sortie"; then
  ok "push refusé : $(grep "refusing to allow a GitHub App" <<<"$sortie" | head -n 1)"
else
  ko "le push de $branche_wf n'a pas été refusé pour la permission workflows"
  git push -q origin --delete "$branche_wf" 2>/dev/null
fi
git switch -q "$retour" && git branch -q -D "$branche_wf"

echo "== 4. Merge d'une PR qui touche infra/pi/"
branche_pi="test-isolation-infra-pi-$ID"
git switch -q -c "$branche_pi" origin/main
echo "<!-- test d'isolation $ID -->" >>infra/pi/README.md
git commit -q -am "test: merge refusé d'une PR infra/pi (#70) [skip ci]"
if git push -q origin "$branche_pi" 2>/dev/null; then
  url=$(gh pr create -R "$REPO" --head "$branche_pi" \
    --title "test: merge refusé d'une PR infra/pi (#70)" \
    --body "PR de test de l'isolation des agents (#70), fermée par le script.")
  echo "PR de test : $url"
  sortie=$(gh pr merge "$url" --squash 2>&1)
  refus=$?
  # Sans attendre la CI : REVIEW_REQUIRED prouve que la relecture de Flo bloque, CI verte ou non.
  decision=$(gh pr view "$url" --json reviewDecision -q .reviewDecision)
  if [ "$refus" -ne 0 ] && [ "$decision" = "REVIEW_REQUIRED" ]; then
    ok "merge refusé (reviewDecision=$decision) : $(head -n 1 <<<"$sortie")"
  elif [ "$refus" -ne 0 ]; then
    ko "merge refusé, mais sans relecture exigée (reviewDecision=${decision:-aucune}) : ruleset absent ?"
  else
    ko "la PR $url a été mergée sans relecture de Flo : à annuler (revert) d'urgence"
  fi
  [ -n "$url" ] && gh pr close "$url" >/dev/null
  git push -q origin --delete "$branche_pi"
else
  ko "push de $branche_pi impossible"
fi
git switch -q "$retour" && git branch -q -D "$branche_pi"

echo
if [ "$echecs" -eq 0 ]; then echo "Isolation vérifiée."; else echo "$echecs vérification(s) en échec."; fi
exit "$echecs"
