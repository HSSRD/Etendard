#!/bin/bash
# Test local de « verify.sh pi » (ticket #113, critère 10) : sa sortie ne contient ni adresse, ni nom de
# machine, ni port, ni valeur du fichier local, même quand chaque commande du système en affiche.
# Usage : bash infra/pi/test/verify-pi.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Valeurs témoins : aucune ne doit apparaître dans la sortie.
TEMOINS=(hote-temoin 192.0.2.77 2001:db8::77 54321 54322 service-temoin 'Depot Temoin')
export TEMOIN="hote-temoin.tailnet-temoin.ts.net 192.0.2.77 [2001:db8::77]:54321 port 54322"

# Faux système : chaque commande lue par verify.sh pi affiche les témoins (sauf « id -u », qui répond root).
mkdir "$WORK/bin"
cat > "$WORK/bin/temoin" <<'SH'
#!/bin/bash
[ "$(basename "$0") $*" = "id -u" ] && { echo 0; exit 0; }
echo "$TEMOIN"
SH
for c in apt-config caddy cmp curl dpkg dpkg-query getent hostname id ip ip6tables-legacy-save iptables-legacy-save \
  nft python3 runuser ss sshd stat sudo systemctl tailscale uname; do
  cp "$WORK/bin/temoin" "$WORK/bin/$c"
  chmod +x "$WORK/bin/$c"
done
printf 'PORT=54321\nPORT=54322/udp\nSERVICE=service-temoin.service\nDEPOT_EXCLU=Depot Temoin\n' > "$WORK/serveur.conf"

out="$(PATH="$WORK/bin:$PATH" ETENDARD_CONF="$WORK/serveur.conf" bash "$HERE/../verify.sh" pi 2>&1)"
pass=0 fail=0
if grep -q '^Bilan : ' <<<"$out" && grep -q 'critère 8' <<<"$out"; then
  pass=$((pass + 1)); echo "ok   - verify.sh pi va jusqu'au bilan"
else
  fail=$((fail + 1)); echo "FAIL - verify.sh pi s'arrête avant le bilan : $out"
fi
for t in "${TEMOINS[@]}"; do
  if grep -qF -- "$t" <<<"$out"; then
    fail=$((fail + 1)); echo "FAIL - « $t » dans la sortie : $(grep -F -- "$t" <<<"$out" | head -3)"
  else
    pass=$((pass + 1)); echo "ok   - « $t » absent de la sortie"
  fi
done
# Aucune adresse IPv4 ni aucun « :port », quelle que soit leur valeur (3 chiffres au moins : l'heure de la
# date, « 19:07+01:00 », en a deux).
fuite='([0-9]{1,3}\.){3}[0-9]{1,3}|:[0-9]{3,5}\b'
if grep -Eq "$fuite" <<<"$out"; then
  fail=$((fail + 1)); echo "FAIL - adresse ou port dans la sortie : $(grep -E "$fuite" <<<"$out" | head -3)"
else
  pass=$((pass + 1)); echo "ok   - aucune adresse IPv4 ni aucun « :port »"
fi

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
