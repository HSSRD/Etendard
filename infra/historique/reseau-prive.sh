#!/bin/bash
# Retire du repo public les valeurs du réseau privé de Flo (ticket #31). Procédure : README.md de ce dossier.
#   bash reseau-prive.sh reecrire <valeurs> [dossier]   clone neuf, git filter-repo --replace-text, contrôle.
#                                                       Ne pousse rien : le force-push reste à faire à la main.
#   bash reseau-prive.sh verifier <valeurs>             clone neuf : historique et refs/pull/* ; API GitHub :
#                                                       tickets, PR, commentaires, revues, Releases et leurs
#                                                       historiques de modification.
# <valeurs> : fichier au format --replace-text (« valeur==>remplacement », une par ligne), hors de tout repo.
# Seules des lignes littérales sont admises (pas de « regex: » ni de « glob: »). Aucune valeur n'est affichée :
# chacune est désignée par son numéro de ligne.
set -euo pipefail

REPO=HSSRD/Etendard
URL="https://github.com/$REPO.git"

die() { echo "reseau-prive.sh : $*" >&2; exit 1; }

# Valeurs à chercher, une par ligne : la partie avant le dernier « ==> ».
lire_valeurs() {
  [ -f "$1" ] || die "fichier des valeurs introuvable : $1"
  local dir
  dir="$(cd "$(dirname "$1")" && pwd)"
  git -C "$dir" rev-parse --is-inside-work-tree > /dev/null 2>&1 \
    && die "le fichier des valeurs est dans un repo Git : place-le hors de tout repo"
  FICHIER="$dir/$(basename "$1")"
  VALEURS=()
  local ligne
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    ligne="${ligne%$'\r'}"
    [ -n "$ligne" ] || continue
    case "$ligne" in regex:* | glob:*) die "ligne non littérale refusée : $ligne" ;; esac
    VALEURS+=("${ligne%==>*}")
  done < "$FICHIER"
  [ "${#VALEURS[@]}" -gt 0 ] || die "aucune valeur dans $FICHIER"
}

# compter <titre> <fichier> : affiche, pour chaque valeur, le nombre de lignes du fichier qui la contiennent.
# Ajoute le total à RESTE.
compter() {
  local i n
  echo "$1"
  for i in "${!VALEURS[@]}"; do
    n="$(grep -c -F -- "${VALEURS[$i]}" "$2" || true)"
    echo "  valeur $((i + 1)) : $n"
    RESTE=$((RESTE + n))
  done
}

# Commande de git filter-repo : git filter-repo (paquet, ou pip avec Scripts dans le PATH), sinon py -3.
filter_repo() {
  if git filter-repo --version > /dev/null 2>&1; then
    FR=(git filter-repo)
  elif py -3 -m git_filter_repo --version > /dev/null 2>&1; then
    FR=(py -3 -m git_filter_repo)
  else
    die "git filter-repo introuvable : voir « Installer git filter-repo » dans infra/historique/README.md"
  fi
}

mode_reecrire() {
  lire_valeurs "${1:?usage : bash reseau-prive.sh reecrire <valeurs> [dossier]}"
  local dossier="${2:-$HOME/etendard-reecriture}"
  [ ! -e "$dossier" ] || die "$dossier existe déjà : choisis un autre dossier"
  filter_repo

  # Préalables (étapes 1 à 3 du README) : rien d'autre que main sur GitHub.
  local n
  n="$(gh pr list -R "$REPO" --state open --json number -q length)"
  [ "$n" = 0 ] || die "$n PR encore ouverte(s) : ferme-les ou merge-les avant la réécriture"
  n="$(gh api "repos/$REPO/branches?per_page=100" --paginate -q '.[].name' | grep -cvx main || true)"
  [ "$n" = 0 ] || die "$n branche(s) autre(s) que main sur GitHub : supprime-les d'abord (étape 2)"
  n="$(git ls-remote --tags "$URL" | grep -c . || true)"
  [ "$n" = 0 ] || die "$n tag(s) sur GitHub : supprime les Releases et les tags d'abord (étape 3)"

  git clone "$URL" "$dossier"
  cd "$dossier"
  local avant
  avant="$(git rev-list --count HEAD)"
  # --sensitive-data-removal réécrit aussi refs/pull/* et note le premier commit modifié,
  # à donner au support GitHub (étape 8).
  "${FR[@]}" --sensitive-data-removal --replace-text "$FICHIER" --replace-message "$FICHIER"

  RESTE=0
  git log --all -p > "$d/historique"
  compter "Lignes de l'historique réécrit qui contiennent une valeur (attendu : 0)" "$d/historique"
  echo "Commits de main : $avant avant, $(git rev-list --count HEAD) après"
  echo "Premier commit modifié (pour le support) : $(cat .git/filter-repo/first-changed-commits)"
  [ "$RESTE" -eq 0 ] || die "des valeurs restent dans l'historique réécrit : ne pousse pas"
  echo "Historique réécrit dans $(pwd). Suite : étape 5 du README (force-push de main seule)."
}

mode_verifier() {
  lire_valeurs "${1:?usage : bash reseau-prive.sh verifier <valeurs>}"
  RESTE=0

  git clone -q "$URL" "$d/clone"
  printf '%s\n' "${VALEURS[@]}" > "$d/valeurs"
  git -C "$d/clone" grep -h -F -f "$d/valeurs" HEAD -- > "$d/main" || true
  compter "Fichiers de main (critère 1)" "$d/main"
  git -C "$d/clone" log --all -p > "$d/historique"
  compter "Historique d'un clone neuf, git log --all -p (critère 3)" "$d/historique"
  echo "Branches distantes autres que main (critère 4) : $(git -C "$d/clone" branch -r | grep -cv -e '/main$' -e '/HEAD ' || true)"
  echo "Tags (critère 4) : $(git -C "$d/clone" tag | grep -c . || true)"

  # Une ligne par texte : « <url> <titre, corps et versions modifiées, en JSON> ».
  local textes="$d/textes" max num
  {
    gh api "repos/$REPO/releases?per_page=100" --paginate \
      -q '.[] | .html_url + " " + ([.name, .body] | map(select(. != null)) | join("\n") | @json)'
    gh api "repos/$REPO/comments?per_page=100" --paginate -q '.[] | .html_url + " " + (.body | @json)'
    max="$(gh api "repos/$REPO/issues?state=all&per_page=1" -q '.[0].number')"
    for ((num = 1; num <= max; num++)); do
      gh api graphql -F n="$num" -f query='
        fragment e on Comment { userContentEdits(first: 50) { nodes { diff } } }
        query($n: Int!) { repository(owner: "HSSRD", name: "Etendard") { issueOrPullRequest(number: $n) {
          ... on Issue { url title body ...e comments(first: 100) { nodes { url body ...e } } }
          ... on PullRequest { url title body ...e comments(first: 100) { nodes { url body ...e } }
            reviews(first: 50) { nodes { url body ...e comments(first: 50) { nodes { url body ...e } } } } }
        } } }' \
        -q '.. | objects | select(has("url")) | .url + " " + ([.title, .body, .userContentEdits.nodes[]?.diff]
          | map(select(. != null)) | join("\n") | @json)' 2> /dev/null || true
    done
  } > "$textes"
  compter "Textes GitHub, historiques de modification compris (critère 5)" "$textes"
  local i
  for i in "${!VALEURS[@]}"; do
    grep -F -- "${VALEURS[$i]}" "$textes" | cut -d' ' -f1 | sed "s/^/  valeur $((i + 1)) dans /" || true
  done

  # Hors bilan : ces références ne disparaissent qu'à la demande du support GitHub (critère 6).
  git -C "$d/clone" fetch -q origin '+refs/pull/*:refs/pull/*'
  local bilan=$RESTE
  git -C "$d/clone" log --all -p > "$d/pull"
  compter "refs/pull/* gardées par GitHub (critère 6, purge par le support)" "$d/pull"

  echo "Bilan : $bilan occurrence(s) hors refs/pull/*"
  [ "$bilan" -eq 0 ]
}

# Dossier de travail, supprimé à la sortie.
d="$(mktemp -d)"
trap 'rm -rf "$d"' EXIT

case "${1:-}" in
  reecrire) shift; mode_reecrire "$@" ;;
  verifier) shift; mode_verifier "$@" ;;
  *) echo "usage : bash reseau-prive.sh reecrire <valeurs> [dossier]   |   bash reseau-prive.sh verifier <valeurs>" >&2; exit 2 ;;
esac
