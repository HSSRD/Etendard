#!/bin/bash
# Tests locaux de « verify.sh hsts <domaine> », avec un faux curl (le site n'est pas encore en ligne).
# Usage : bash infra/pi/test/verify-hsts.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Faux curl : note les URL demandées et répond 200 sur / ($STUB_STATUS force ce statut), 404 ailleurs
# ($STUB_STATUS_404 le force), avec l'en-tête de $STUB_HSTS (aucun s'il est vide) ; sur la page absente,
# celui de $STUB_HSTS_404 s'il est défini.
mkdir "$WORK/bin"
cat > "$WORK/bin/curl" <<'SH'
#!/bin/bash
for a; do [[ "$a" == https://* ]] && url="$a" && echo "$a" >> "$STUB_LOG"; done
if [[ "$url" == */ ]]; then status="${STUB_STATUS:-200}" hsts="$STUB_HSTS"; else status="${STUB_STATUS_404:-404}" hsts="${STUB_HSTS_404-$STUB_HSTS}"; fi
printf 'HTTP/2 %s\r\n' "$status"
[ -n "$hsts" ] && printf '%s\r\n' "$hsts"
exit 0
SH
chmod +x "$WORK/bin/curl"
export PATH="$WORK/bin:$PATH" STUB_LOG="$WORK/urls"

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

# expect <code attendu> <description> <en-tête servi> [arguments de « verify.sh hsts »]
# Un succès doit afficher le bilan de la procédure ; un argument refusé (code 2), n'envoyer aucune requête.
expect() {
  local want="$1" desc="$2" out code
  : > "$STUB_LOG"
  out="$(STUB_HSTS="$3" bash "$HERE/../verify.sh" hsts "${@:4}" 2>&1)"; code=$?
  [ "$code" -eq "$want" ] || { ko "$desc : code $code au lieu de $want ($out)"; return; }
  [ "$want" -ne 0 ] || grep -q 'Bilan : 4 ✅, 0 ❌' <<<"$out" || { ko "$desc : bilan inattendu ($out)"; return; }
  [ "$want" -ne 2 ] || [ ! -s "$STUB_LOG" ] || { ko "$desc : requête envoyée ($(cat "$STUB_LOG"))"; return; }
  ok "$desc (code $code)"
}

ok_hsts='Strict-Transport-Security: max-age=31536000'
expect 0 "valeur retenue, en-tête en minuscules (HTTP/2)" 'strict-transport-security: max-age=31536000' exemple.fr
grep -qxF 'https://exemple.fr/' "$STUB_LOG" && grep -q '^https://exemple\.fr/absente-' "$STUB_LOG" \
  && ok "lit / et une 404 du domaine donné" || ko "URL demandées : $(cat "$STUB_LOG")"
expect 0 "valeur retenue, nom d'en-tête en casse canonique" "$ok_hsts" exemple.fr
expect 1 "en-tête absent" '' exemple.fr
STUB_HSTS_404='' expect 1 "en-tête absent de la 404 seulement" "$ok_hsts" exemple.fr
STUB_STATUS=530 expect 1 "page d'erreur de Cloudflare sur / (Pi coupé), même avec l'en-tête" "$ok_hsts" exemple.fr
STUB_STATUS_404=200 expect 1 "page absente servie en 200 (page de repli), même avec l'en-tête" "$ok_hsts" exemple.fr
expect 1 "includeSubDomains refusé" "$ok_hsts; includeSubDomains" exemple.fr
expect 1 "preload refusé" "$ok_hsts; preload" exemple.fr
expect 1 "autre durée refusée" 'Strict-Transport-Security: max-age=15552000' exemple.fr
expect 1 "second en-tête refusé" $'Strict-Transport-Security: max-age=31536000; includeSubDomains\n'"$ok_hsts" exemple.fr
expect 2 "domaine manquant" ''
expect 2 "URL au lieu d'un domaine" '' https://exemple.fr/
expect 2 "plusieurs domaines" "$ok_hsts" exemple.fr www.exemple.fr

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
