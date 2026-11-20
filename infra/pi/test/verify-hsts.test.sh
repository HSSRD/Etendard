#!/bin/bash
# Tests locaux de « verify.sh hsts <domaine> », avec un faux curl (le site n'est pas encore en ligne).
# Usage : bash infra/pi/test/verify-hsts.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Faux curl : répond avec l'en-tête de $STUB_HSTS (aucun s'il est vide) et note les URL demandées.
mkdir "$WORK/bin"
cat > "$WORK/bin/curl" <<'SH'
#!/bin/sh
for a; do case "$a" in https://*) echo "$a" >> "$STUB_LOG" ;; esac; done
printf 'HTTP/2 200\r\n'
[ -n "$STUB_HSTS" ] && printf '%s\r\n' "$STUB_HSTS"
exit 0
SH
chmod +x "$WORK/bin/curl"
export PATH="$WORK/bin:$PATH" STUB_LOG="$WORK/urls"

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

# expect <code attendu> <description> <en-tête servi> [argument de « verify.sh hsts »]
# Un argument refusé (code 2) ne doit envoyer aucune requête.
expect() {
  local want="$1" desc="$2" out code
  : > "$STUB_LOG"
  out="$(STUB_HSTS="$3" bash "$HERE/../verify.sh" hsts "${@:4}" 2>&1)"; code=$?
  [ "$code" -eq "$want" ] || { ko "$desc : code $code au lieu de $want ($out)"; return; }
  [ "$want" -ne 2 ] || [ ! -s "$STUB_LOG" ] || { ko "$desc : requête envoyée ($(cat "$STUB_LOG"))"; return; }
  ok "$desc (code $code)"
}

expect 0 "valeur retenue, en-tête en minuscules (HTTP/2)" 'strict-transport-security: max-age=31536000' exemple.fr
grep -qxF 'https://exemple.fr/' "$STUB_LOG" && grep -q '^https://exemple\.fr/absente-' "$STUB_LOG" \
  && ok "lit / et une 404 du domaine donné" || ko "URL demandées : $(cat "$STUB_LOG")"
expect 0 "valeur retenue, en-tête en HTTP/1.1" 'Strict-Transport-Security: max-age=31536000' exemple.fr
expect 1 "en-tête absent" '' exemple.fr
expect 1 "includeSubDomains refusé" 'Strict-Transport-Security: max-age=31536000; includeSubDomains' exemple.fr
expect 1 "preload refusé" 'Strict-Transport-Security: max-age=31536000; preload' exemple.fr
expect 1 "autre durée refusée" 'Strict-Transport-Security: max-age=15552000' exemple.fr
expect 1 "second en-tête refusé" \
  $'Strict-Transport-Security: max-age=31536000; includeSubDomains\nStrict-Transport-Security: max-age=31536000' exemple.fr
expect 2 "domaine manquant" ''
expect 2 "URL au lieu d'un domaine" '' https://exemple.fr/

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
