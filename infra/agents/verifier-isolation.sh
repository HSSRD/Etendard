#!/usr/bin/env bash
# Vérifie l'isolation des agents (#70) depuis une session agent, dans un clone du repo.
# Usage : bash infra/agents/verifier-isolation.sh [profil de Flo] [dépôt principal de Flo]
# Ouvre puis ferme une PR de test qui touche infra/pi/ : compte environ 10 minutes (CI).
# N'affiche jamais de jeton.
set -u

PROFIL=${1:-C:/Users/floxf}
DEPOT_FLO=${2:-C:/04-Projets/HSSRD/Etendard}
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
if ls "$PROFIL" >/dev/null 2>&1; then
  ko "le profil $PROFIL est lisible"
else
  ok "le profil $PROFIL est inaccessible"
fi
for fichier in "$PROFIL/.ssh" "$PROFIL/AppData/Roaming/GitHub CLI/hosts.yml" "$PROFIL/.etendard"; do
  if ls "$fichier" >/dev/null 2>&1; then ko "$fichier est lisible"; else ok "$fichier est inaccessible"; fi
done
if ls "$DEPOT_FLO" >/dev/null 2>&1; then
  ko "le dépôt principal $DEPOT_FLO est lisible (hooks git exécutés sous Flo)"
else
  ok "le dépôt principal $DEPOT_FLO est inaccessible"
fi

git fetch -q origin main
retour=$(git rev-parse --abbrev-ref HEAD)

echo "== 3. Push d'une modification de .github/workflows/"
branche_wf="test-isolation-workflows-$ID"
git switch -q -c "$branche_wf" origin/main
echo "# test d'isolation $ID" >>.github/workflows/ci.yml
git commit -q -am "test: modification de workflow refusée (#70)"
sortie=$(git push origin "$branche_wf" 2>&1)
if [ $? -ne 0 ] && grep -qi "workflow" <<<"$sortie"; then
  ok "push refusé : $(grep -i 'workflow' <<<"$sortie" | head -n 1)"
else
  ko "le push de $branche_wf n'a pas été refusé pour la permission workflows"
  git push -q origin --delete "$branche_wf" 2>/dev/null
fi
git switch -q "$retour" && git branch -q -D "$branche_wf"

echo "== 4. Merge d'une PR qui touche infra/pi/"
branche_pi="test-isolation-infra-pi-$ID"
git switch -q -c "$branche_pi" origin/main
echo "<!-- test d'isolation $ID -->" >>infra/pi/README.md
git commit -q -am "test: merge refusé d'une PR infra/pi (#70)"
if git push -q origin "$branche_pi" 2>/dev/null; then
  url=$(gh pr create -R "$REPO" --head "$branche_pi" \
    --title "test: merge refusé d'une PR infra/pi (#70)" \
    --body "PR de test de l'isolation des agents (#70), fermée par le script.")
  echo "PR de test : $url (attente de la CI pour que seul le ruleset de relecture bloque)"
  gh pr checks "$url" --watch >/dev/null 2>&1
  sortie=$(gh pr merge "$url" --squash 2>&1)
  if [ $? -ne 0 ]; then
    ok "merge refusé : $(head -n 1 <<<"$sortie")"
    gh pr view "$url" --json reviewDecision,mergeStateStatus -q '"      reviewDecision=\(.reviewDecision) mergeStateStatus=\(.mergeStateStatus)"'
  else
    ko "la PR $url a été mergée sans relecture de Flo : à annuler (revert) d'urgence"
  fi
  gh pr close "$url" --delete-branch >/dev/null 2>&1 || true
else
  ko "push de $branche_pi impossible"
fi
git switch -q "$retour" && git branch -q -D "$branche_pi"

echo
if [ "$echecs" -eq 0 ]; then echo "Isolation vérifiée."; else echo "$echecs vérification(s) en échec."; fi
exit "$echecs"
