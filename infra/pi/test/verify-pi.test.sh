#!/bin/bash
# Test local de « verify.sh pi » (tickets #113, critère 10, et #125, critère 6) : sa sortie ne contient ni adresse,
# ni nom de machine, ni port, ni valeur du fichier local, ni jeton, même quand chaque commande du système en affiche.
# Usage : bash infra/pi/test/verify-pi.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Valeurs témoins : aucune ne doit apparaître dans la sortie.
TEMOINS=(hote-temoin 192.0.2.77 2001:db8::77 54321 54322 54323 service-temoin 'Depot Temoin' eyJqZXRvbi10ZW1vaW4)
# Sur deux lignes : la seconde est le port de sshd (« port N » de sshd -T), pour que le contrôle des ports SSH tourne.
export TEMOIN=$'hote-temoin.tailnet-temoin.ts.net 192.0.2.77 [2001:db8::77]:54321 eyJqZXRvbi10ZW1vaW4 port 54322\nport 54323'

# Faux système : chaque commande lue par verify.sh pi affiche les témoins, sur stdout et sur stderr (sauf
# « id -u », qui répond root).
mkdir "$WORK/bin"
cat > "$WORK/bin/temoin" <<'SH'
#!/bin/bash
[ "$(basename "$0") $*" = "id -u" ] && { echo 0; exit 0; }
echo "$TEMOIN"
echo "$TEMOIN" >&2
SH
for c in apt-config caddy cloudflared cmp curl dpkg dpkg-query getent hostname id ip6tables-legacy-save ip6tables-nft-save iptables-legacy-save iptables-nft-save \
  gpg nft python3 readlink runuser ss sshd stat sudo systemctl uname; do
  cp "$WORK/bin/temoin" "$WORK/bin/$c"
  chmod +x "$WORK/bin/$c"
done
printf 'PORT=54321\nPORT=54322/udp\nSERVICE=service-temoin.service\nDEPOT_EXCLU=Depot Temoin\n' > "$WORK/serveur.conf"
# Jeton témoin : le faux système l'affiche aussi, comme une commande qui le lirait.
printf 'eyJqZXRvbi10ZW1vaW4\n' > "$WORK/tunnel.jeton"

out="$(PATH="$WORK/bin:$PATH" DETAIL= ETENDARD_CONF="$WORK/serveur.conf" JETON_TUNNEL="$WORK/tunnel.jeton" bash "$HERE/../verify.sh" pi 2>&1)"
pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

grep -q '^Bilan : ' <<<"$out" && grep -q 'Ticket #125' <<<"$out" \
  && ok "verify.sh pi va jusqu'au bilan" || ko "verify.sh pi s'arrête avant le bilan : $out"
for t in "${TEMOINS[@]}"; do
  grep -qF -- "$t" <<<"$out" \
    && ko "« $t » dans la sortie : $(grep -F -- "$t" <<<"$out" | head -3)" || ok "« $t » absent de la sortie"
done
# Aucune adresse IPv4 ni aucun « :port », quelle que soit leur valeur (3 chiffres au moins : l'heure de la
# date, « 19:07+01:00 », en a deux).
fuite='([0-9]{1,3}\.){3}[0-9]{1,3}|:[0-9]{3,5}\b'
grep -Eq "$fuite" <<<"$out" \
  && ko "adresse ou port dans la sortie : $(grep -E "$fuite" <<<"$out" | head -3)" || ok "aucune adresse IPv4 ni aucun « :port »"

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
