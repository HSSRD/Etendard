#!/bin/bash
# Tests locaux de « verify.sh public <domaine> » (ticket #125, critère 9), avec un faux curl qui simule le
# site servi par Cloudflare : ni réseau ni domaine.
# Usage : bash infra/pi/test/verify-public.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# En-têtes de sécurité du Caddyfile, au format HTTP : le faux site sert exactement ceux-là.
awk '{ l = $0; sub(/^[[:space:]]+/, "", l) } l == "header {" { b = 1; next } b && l == "}" { b = 0 }
  b && match(l, /^[A-Za-z-]+ "/) { n = substr(l, 1, RLENGTH - 2); v = substr(l, RLENGTH + 1); sub(/"$/, "", v); print n ": " v }' \
  "$HERE/../Caddyfile" > "$WORK/securite"
[ "$(grep -c . "$WORK/securite")" -eq 4 ] || { echo "FAIL - en-têtes du Caddyfile illisibles"; exit 1; }

# Faux curl : -I donne le statut et les en-têtes, sinon le corps (sur stdout ou dans le fichier de -o).
# Réglages : STUB_SCRIPT (balise ajoutée aux pages, comme une injection de Cloudflare), STUB_CSP (CSP servie),
# STUB_STATUS_404 (statut d'une page absente), STUB_CORPS_404 (son corps), STUB_CACHE (cf-cache-status de
# version.txt).
mkdir "$WORK/bin"
cat > "$WORK/bin/curl" <<'SH'
#!/bin/bash
head=0 out=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -sSI | -I) head=1 ;;
    -o) out="$2"; shift ;;
    https://*) url="$1"; echo "$1" >> "$STUB_LOG" ;;
  esac
  shift
done
path="/${url#https://*/}"
page() { printf '<!doctype html><title>%s</title><script src="/_expo/static/js/web/entry-0123.js" defer></script>%s\n' "$1" "${STUB_SCRIPT:-}"; }
case "$path" in
  /) status=200 type=text/html cache=no-cache corps="$(page Accueil)" ;;
  /+not-found.html) status=200 type=text/html cache=no-cache corps="$(page Introuvable)" ;;
  /version.txt)
    status=200 type=text/plain cache=no-store corps=0123456789abcdef cf="${STUB_CACHE:-DYNAMIC}" ;;
  *) status="${STUB_STATUS_404:-404}" type=text/html cache=no-cache corps="${STUB_CORPS_404:-$(page Introuvable)}" ;;
esac
if [ "$head" = 1 ]; then
  printf 'HTTP/2 %s\r\ncontent-type: %s\r\ncache-control: %s\r\n' "$status" "$type" "$cache"
  [ -n "${cf:-}" ] && printf 'cf-cache-status: %s\r\n' "$cf"
  if [ -n "${STUB_CSP:-}" ]; then
    grep -v '^Content-Security-Policy:' "$STUB_SECURITE"; echo "Content-Security-Policy: $STUB_CSP"
  else
    cat "$STUB_SECURITE"
  fi | sed 's/^[^:]*:/\L&/; s/$/\r/'   # noms en minuscules, comme Cloudflare en HTTP/2
elif [ -n "$out" ]; then
  printf '%s\n' "$corps" > "$out"
else
  printf '%s\n' "$corps"
fi
SH
chmod +x "$WORK/bin/curl"
export PATH="$WORK/bin:$PATH" STUB_LOG="$WORK/urls" STUB_SECURITE="$WORK/securite"

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

# expect <code attendu> <description> <motif attendu dans la sortie> [arguments de « verify.sh public »]
# La sortie ne contient jamais le domaine ; un argument refusé (code 2) n'envoie aucune requête.
expect() {
  local want="$1" desc="$2" motif="$3" out code
  : > "$STUB_LOG"
  out="$(bash "$HERE/../verify.sh" public "${@:4}" 2>&1)"; code=$?
  [ "$code" -eq "$want" ] || { ko "$desc : code $code au lieu de $want ($out)"; return; }
  grep -qE -- "$motif" <<<"$out" || { ko "$desc : « $motif » absent de la sortie ($out)"; return; }
  ! grep -q exemple <<<"$out" || { ko "$desc : domaine dans la sortie ($(grep exemple <<<"$out" | head -3))"; return; }
  [ "$want" -ne 2 ] || [ ! -s "$STUB_LOG" ] || { ko "$desc : requête envoyée ($(cat "$STUB_LOG"))"; return; }
  ok "$desc (code $code)"
}

expect 0 "site conforme" 'Bilan : [0-9]+ ✅, 0 ❌' exemple.fr
grep -qxF 'https://exemple.fr/' "$STUB_LOG" && grep -qxF 'https://exemple.fr/version.txt' "$STUB_LOG" \
  && grep -q '^https://exemple\.fr/absente-' "$STUB_LOG" && ok "lit /, une page absente et version.txt du domaine donné" \
  || ko "URL demandées : $(cat "$STUB_LOG")"
STUB_STATUS_404=200 expect 1 "page absente servie en 200" '❌ /absente-verify-sh-[0-9]+ répond 404' exemple.fr
STUB_CORPS_404='<h1>Error 1033</h1>' expect 1 "page absente remplacée par une page d'erreur de Cloudflare" \
  '❌ corps de /absente-verify-sh-[0-9]+ identique à /\+not-found.html' exemple.fr
STUB_CSP="default-src 'self'" expect 1 "CSP différente de celle du Caddyfile" '❌ Content-Security-Policy sur /,' exemple.fr
STUB_SCRIPT='<script src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>' \
  expect 1 "script ajouté par Cloudflare (obfuscation des e-mails)" '❌ aucun <script> hors de /_expo/static/ dans /$' exemple.fr
STUB_SCRIPT='<script>alert(1)</script>' expect 1 "script en ligne" '❌ aucun <script> hors de /_expo/static/ dans /$' exemple.fr
STUB_CORPS_404='<!doctype html><title>Introuvable</title>' expect 1 "page sans script : contrôle non vide" \
  '❌ /absente-verify-sh-[0-9]+ charge ses scripts depuis /_expo/static/' exemple.fr
STUB_CACHE=HIT expect 1 "version.txt servi depuis le cache de Cloudflare" '❌ /version.txt hors du cache de Cloudflare \(lecture 1\)' exemple.fr
expect 2 "domaine manquant" 'usage' ''
expect 2 "URL au lieu d'un domaine" 'usage' https://exemple.fr/
expect 2 "plusieurs domaines" 'usage' exemple.fr www.exemple.fr

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
