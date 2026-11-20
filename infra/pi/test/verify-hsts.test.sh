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

# expect <code attendu> <description> <en-tête servi> [arguments de verify.sh…]
expect() {
  local want="$1" desc="$2" out code
  : > "$STUB_LOG"
  out="$(STUB_HSTS="$3" bash "$HERE/../verify.sh" "${@:4}" 2>&1)"; code=$?
  [ "$code" -eq "$want" ] && ok "$desc (code $code)" || ko "$desc : code $code au lieu de $want ($out)"
}

expect 0 "valeur retenue, en-tête en minuscules (HTTP/2)" 'strict-transport-security: max-age=31536000' hsts exemple.fr
grep -qx 'https://exemple.fr/' "$STUB_LOG" && grep -q '^https://exemple\.fr/absente-' "$STUB_LOG" \
  && ok "lit / et une 404 du domaine donné" || ko "URL demandées : $(cat "$STUB_LOG")"
expect 0 "valeur retenue, en-tête en HTTP/1.1" 'Strict-Transport-Security: max-age=31536000' hsts exemple.fr
expect 1 "en-tête absent" '' hsts exemple.fr
expect 1 "includeSubDomains refusé" 'Strict-Transport-Security: max-age=31536000; includeSubDomains' hsts exemple.fr
expect 1 "preload refusé" 'Strict-Transport-Security: max-age=31536000; preload' hsts exemple.fr
expect 1 "autre durée refusée" 'Strict-Transport-Security: max-age=15552000' hsts exemple.fr
expect 2 "domaine manquant" '' hsts
expect 2 "URL au lieu d'un domaine" '' hsts https://exemple.fr/
[ ! -s "$STUB_LOG" ] && ok "aucune requête sur un argument refusé" || ko "requête envoyée : $(cat "$STUB_LOG")"

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
