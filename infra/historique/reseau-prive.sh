#!/bin/bash
# Retire du repo public les valeurs du réseau privé de Flo (ticket #31). Procédure : README.md de ce dossier.
#   bash reseau-prive.sh reecrire <valeurs> [dossier]   clone neuf, git filter-repo --replace-text, contrôle.
#                                                       Ne pousse rien : le force-push reste à faire à la main.
#   bash reseau-prive.sh verifier <valeurs>             clone neuf : historique et refs/pull/* ; API GitHub :
#                                                       tickets, PR, commentaires, revues, Releases et leurs
#                                                       historiques de modification.
# <valeurs> : fichier au format --replace-text (« valeur==>remplacement », une par ligne), hors de tout repo.
# Seules des lignes littérales sont admises (pas de « regex: » ni de « glob: »), sans BOM. Les valeurs sont
# cherchées sans tenir compte de la casse : une variante oubliée dans le fichier arrête la réécriture.
# Aucune valeur n'est affichée : chacune est désignée par son numéro de ligne.
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
  # git filter-repo garderait le BOM dans la première valeur, qui ne serait jamais remplacée.
  [ "$(head -c 3 "$FICHIER")" != $'\xef\xbb\xbf' ] || die "fichier des valeurs en UTF-8 avec BOM : enregistre-le sans BOM"
  VALEURS=()
  local ligne num=0 v
  while IFS= read -r ligne || [ -n "$ligne" ]; do
    num=$((num + 1))
    ligne="${ligne%$'\r'}"
    [ -n "$ligne" ] || continue
    case "$ligne" in regex:* | glob:*) die "ligne $num non littérale (regex: ou glob:) : refusée" ;; esac
    v="${ligne%==>*}"
    VALEURS+=("${v#literal:}")
  done < "$FICHIER"
  [ "${#VALEURS[@]}" -gt 0 ] || die "aucune valeur dans $FICHIER"
}

# compter <titre> <fichier> : affiche, pour chaque valeur, le nombre de lignes du fichier qui la contiennent.
# Ajoute le total à RESTE.
compter() {
  local i n
  echo "$1"
  for i in "${!VALEURS[@]}"; do
    n="$(grep -c -i -F -- "${VALEURS[$i]}" "$2" || true)"
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
  # --sensitive-data-removal date de git filter-repo 2.47.
  [[ "$("${FR[@]}" -h)" == *--sensitive-data-removal* ]] \
    || die "git filter-repo trop ancien (2.47 au moins) : installe-le par pip (README.md, étape 0)"
}

mode_reecrire() {
  lire_valeurs "${1:?usage : bash reseau-prive.sh reecrire <valeurs> [dossier]}"
  local dossier="${2:-$HOME/etendard-reecriture}"
  [ ! -e "$dossier" ] || die "$dossier existe déjà : choisis un autre dossier"
  filter_repo

  # Préalables (étapes 1 à 3 du README) : rien d'autre que main sur GitHub.
  # Chaque lecture est faite à part : une erreur de l'API arrête le script (set -e) au lieu de compter 0.
  local n liste
  n="$(gh pr list -R "$REPO" --state open --json number -q length)"
  [ "$n" = 0 ] || die "$n PR encore ouverte(s) : ferme-les ou merge-les avant la réécriture"
  liste="$(gh api "repos/$REPO/branches?per_page=100" --paginate -q '.[].name')"
  n="$(grep -cvx main <<< "$liste" || true)"
  [ "$n" = 0 ] || die "$n branche(s) autre(s) que main sur GitHub : supprime-les d'abord (étape 2)"
  liste="$(git ls-remote --tags "$URL")"
  n="$(grep -c . <<< "$liste" || true)"
  [ "$n" = 0 ] || die "$n tag(s) sur GitHub : supprime les Releases et les tags d'abord (étape 3)"

  git clone "$URL" "$dossier"
  cd "$dossier"
  local avant sha
  avant="$(git rev-list --count HEAD)"
  sha="$(git rev-parse HEAD)"
  # --sensitive-data-removal réécrit aussi refs/pull/* et note le premier commit modifié,
  # à donner au support GitHub (étape 8).
  "${FR[@]}" --sensitive-data-removal --replace-text "$FICHIER" --replace-message "$FICHIER"

  RESTE=0
  git log --all -p > "$d/historique"
  compter "Lignes de l'historique réécrit qui contiennent une valeur (attendu : 0)" "$d/historique"
  echo "Commits de main : $avant avant, $(git rev-list --count HEAD) après"
  echo "Premier commit modifié (pour le support) : $(cat .git/filter-repo/first-changed-commits)"
  [ "$RESTE" -eq 0 ] || die "des valeurs restent dans l'historique réécrit : ne pousse pas"
  echo "Historique réécrit dans $(pwd). Suite : étape 5 du README, avec l'ancien main :"
  echo "  git push --force-with-lease=main:$sha origin main"
}

mode_verifier() {
  lire_valeurs "${1:?usage : bash reseau-prive.sh verifier <valeurs>}"
  RESTE=0

  git clone -q "$URL" "$d/clone"
  printf '%s\n' "${VALEURS[@]}" > "$d/valeurs"
  git -C "$d/clone" grep -h -i -F -f "$d/valeurs" HEAD -- > "$d/main" || true
  compter "Fichiers de main (critère 1)" "$d/main"
  git -C "$d/clone" log --all -p > "$d/historique"
  compter "Historique d'un clone neuf, git log --all -p (critère 3)" "$d/historique"
  echo "Branches distantes autres que main (critère 4) : $(git -C "$d/clone" branch -r | grep -cv -e '/main$' -e '/HEAD ' || true)"
  echo "Tags (critère 4) : $(git -C "$d/clone" tag | grep -c . || true)"

  # Textes par l'API REST : une ligne « T <url> <titre et corps en JSON> » et une ligne « I <node_id> » chacun.
  # Puis leurs historiques de modification par GraphQL, 50 identifiants par requête (coût réduit).
  # Toute erreur de l'API arrête la vérification (set -e) : un texte non lu ne compte jamais pour 0.
  local textes="$d/textes" brut="$d/brut" jqt prs pr ids id args i
  jqt='.[] | ("T " + .html_url + " " + ([.title, .name, .body] | map(select(. != null)) | join("\n") | @json)),
    (select(.node_id != null) | "I " + .node_id)'
  gh api "repos/$REPO/issues?state=all&per_page=100" --paginate -q "$jqt" > "$brut"
  gh api "repos/$REPO/issues/comments?per_page=100" --paginate -q "$jqt" >> "$brut"
  gh api "repos/$REPO/pulls/comments?per_page=100" --paginate -q "$jqt" >> "$brut"
  gh api "repos/$REPO/comments?per_page=100" --paginate -q "$jqt" >> "$brut"
  gh api "repos/$REPO/releases?per_page=100" --paginate -q "$jqt" >> "$brut"
  prs="$(gh api "repos/$REPO/pulls?state=all&per_page=100" --paginate -q '.[].number')"
  for pr in $prs; do
    gh api "repos/$REPO/pulls/$pr/reviews?per_page=100" --paginate -q "$jqt" >> "$brut"
  done
  sed -n 's/^T //p' "$brut" > "$textes"
  mapfile -t ids < <(sed -n 's/^I //p' "$brut")
  for ((i = 0; i < ${#ids[@]}; i += 50)); do
    args=()
    for id in "${ids[@]:i:50}"; do args+=(-f "ids[]=$id"); done
    gh api graphql "${args[@]}" -f query='query($ids: [ID!]!) { nodes(ids: $ids) {
        ... on Issue { url } ... on PullRequest { url } ... on IssueComment { url } ... on PullRequestReview { url }
        ... on PullRequestReviewComment { url } ... on CommitComment { url } ... on Comment { userContentEdits(first: 50) { nodes { diff } } } } }' \
      -q '.data.nodes[] | select(. != null and .url != null)
        | .url + " " + ([(.userContentEdits.nodes // [])[].diff] | map(select(. != null)) | join("\n") | @json)' >> "$textes"
  done
  compter "Textes GitHub, historiques de modification compris (critère 5)" "$textes"
  for i in "${!VALEURS[@]}"; do
    grep -i -F -- "${VALEURS[$i]}" "$textes" | cut -d' ' -f1 | sort -u | sed "s/^/  valeur $((i + 1)) dans /" || true
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
