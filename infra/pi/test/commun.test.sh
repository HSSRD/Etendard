#!/bin/bash
# Tests locaux de commun.sh (ticket #113) : lecture du fichier local et garde-fou contre le verrouillage.
# Usage : bash infra/pi/test/commun.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
source "$HERE/../commun.sh"

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

# conf <description> <motif attendu dans l'erreur, vide si le fichier est valide> <contenu du fichier>
# Une erreur ne doit jamais recopier la valeur fautive : la ligne « secret » sert de témoin.
conf() {
  local desc="$1" want="$2" err code
  printf '%s' "$3" > "$WORK/serveur.conf"
  err="$(ETENDARD_CONF="$WORK/serveur.conf" lire_conf 2>&1)"; code=$?
  if [ -z "$want" ]; then
    [ "$code" -eq 0 ] && ok "$desc" || ko "$desc : refusé ($err)"
  elif [ "$code" -eq 0 ]; then
    ko "$desc : accepté"
  elif ! grep -q -- "$want" <<<"$err"; then
    ko "$desc : message inattendu ($err)"
  elif grep -q secret <<<"$err"; then
    ko "$desc : la valeur fautive est recopiée ($err)"
  else
    ok "$desc"
  fi
}

complet=$'PORT=\nSERVICE=\nDEPOT_EXCLU=\n'

err="$(ETENDARD_CONF="$WORK/absent.conf" lire_conf 2>&1)" \
  && ko "fichier absent : accepté" \
  || { grep -q "absent.conf absent : copie-y serveur.conf.exemple" <<<"$err" && ok "fichier absent : arrêt expliqué" || ko "fichier absent : $err"; }

conf "exemple du repo, valeurs neutres" '' "$(cat "$HERE/../serveur.conf.exemple")"
conf "trois clés vides" '' "$complet"
conf "clé SERVICE absente" 'clé SERVICE absente' $'PORT=\nDEPOT_EXCLU=\n'
conf "fichier vide" 'clé PORT absente' ''
conf "port 0" 'ligne 1 : PORT attend' $'PORT=0\n'"$complet"
conf "port 65536" 'ligne 1 : PORT attend' $'PORT=65536\n'"$complet"
conf "port non numérique" 'ligne 1 : PORT attend' $'PORT=secret\n'"$complet"
conf "protocole inconnu" 'ligne 1 : PORT attend' $'PORT=53/secret\n'"$complet"
conf "service au nom invalide" 'ligne 1 : SERVICE attend' $'SERVICE=secret; rm -rf /\n'"$complet"
conf "service SSH refusé" 'nécessaire à l.accès' $'SERVICE=ssh.service\n'"$complet"
conf "socket SSH refusé" 'nécessaire à l.accès' $'SERVICE=ssh.socket\n'"$complet"
conf "service de Tailscale refusé" 'nécessaire à l.accès' $'SERVICE=tailscaled\n'"$complet"
conf "service isolé (Caddy) refusé" 'nécessaire à l.accès' $'SERVICE=caddy\n'"$complet"
conf "service du tunnel refusé" 'nécessaire à l.accès' $'SERVICE=etendard-tunnel\n'"$complet"
conf "relance du tunnel après mise à jour refusée" 'nécessaire à l.accès' $'SERVICE=etendard-tunnel-maj.path\n'"$complet"
conf "dépôt avec guillemet" 'ligne 1 : DEPOT_EXCLU attend' $'DEPOT_EXCLU=secret"\n'"$complet"
conf "dépôt avec virgule" 'ligne 1 : DEPOT_EXCLU attend' $'DEPOT_EXCLU=secret,x\n'"$complet"
conf "dépôt suivi d'une espace" 'ligne 1 : DEPOT_EXCLU attend' $'DEPOT_EXCLU=secret \n'"$complet"
conf "clé inconnue" 'ligne 1 : clé inconnue' $'SECRET=1\n'"$complet"
conf "ligne sans signe égal" 'ligne 1 : attendu CLE=valeur' $'secret\n'"$complet"
conf "export shell refusé (le fichier n'est pas exécuté)" 'ligne 1 : attendu CLE=valeur' $'export PORT=secret\n'"$complet"

# Fichier valide : valeurs lues, fins de ligne Windows et commentaires tolérés, dernière ligne sans retour.
printf '# commentaire\r\nPORT=9000\r\nPORT=09001/udp\r\n\r\nSERVICE=exemple.service\r\nSERVICE=autre.socket\r\nDEPOT_EXCLU=Exemple Origine\r\nDEPOT_EXCLU=' > "$WORK/serveur.conf"
if ETENDARD_CONF="$WORK/serveur.conf" lire_conf; then
  got="${PORTS[*]}|${SERVICES[*]}|${DEPOTS_EXCLUS[*]}"
  [ "$got" = '9000/tcp 9001/udp|exemple.service autre.socket|Exemple Origine' ] \
    && ok "valeurs lues, TCP par défaut, zéros initiaux retirés" || ko "valeurs lues : $got"
else
  ko "fichier valide refusé"
fi

# Garde-fou : un faux sshd donne les fichiers de clés (AuthorizedKeysFile) ; « secours » n'en a aucun.
mkdir -p "$WORK/bin" "$WORK/home/.ssh"
cat > "$WORK/bin/sshd" <<'SH'
#!/bin/bash
[ "$1" = -T ] && [ -n "${FAUX_AKF:-}" ] && echo "authorizedkeysfile $FAUX_AKF"
exit 0
SH
chmod +x "$WORK/bin/sshd"
export PATH="$WORK/bin:$PATH"
ssh-keygen -q -t ed25519 -N '' -C test -f "$WORK/cle"

garde() { # <description> <attendu : 0 ou 1>
  local code
  cle_admin_autorisee flo "$WORK/home"; code=$?
  [ "$code" -eq "$2" ] && ok "$1" || ko "$1 : code $code au lieu de $2"
}
FAUX_AKF='.ssh/authorized_keys' garde "aucun fichier de clés : arrêt" 1
: > "$WORK/home/.ssh/authorized_keys"
FAUX_AKF='.ssh/authorized_keys' garde "fichier de clés vide : arrêt" 1
echo 'pas une clé' > "$WORK/home/.ssh/authorized_keys"
FAUX_AKF='.ssh/authorized_keys' garde "fichier sans clé valide : arrêt" 1
cp "$WORK/cle.pub" "$WORK/home/.ssh/authorized_keys"
FAUX_AKF='.ssh/authorized_keys' garde "clé autorisée : poursuite" 0
FAUX_AKF='' garde "sshd muet : fichiers par défaut d'OpenSSH lus" 0
rm "$WORK/home/.ssh/authorized_keys"
cp "$WORK/cle.pub" "$WORK/home/.ssh/cles_flo"
FAUX_AKF='.ssh/authorized_keys %h/.ssh/cles_%u' garde "AuthorizedKeysFile avec %h et %u" 0
FAUX_AKF='.ssh/authorized_keys' garde "clé hors des fichiers lus par sshd : arrêt" 1

# Redirection NAT : chaque outil de pare-feu est un faux ; seul celui nommé dans FAUX_NAT_OUTIL affiche FAUX_NAT,
# les autres échouent comme un outil absent (127) : la détection ne doit dépendre que de ce qui est lu.
for c in nft iptables-nft-save ip6tables-nft-save iptables-legacy-save ip6tables-legacy-save; do
  printf '#!/bin/bash\n[ "${FAUX_NAT_OUTIL:-}" = %s ] || exit 127\necho "$FAUX_NAT"\n' "$c" > "$WORK/bin/$c"
  chmod +x "$WORK/bin/$c"
done
nat() { # <description> <attendu : 0 (redirection) ou 1> <outil> <règles>
  local code
  FAUX_NAT_OUTIL="$3" FAUX_NAT="$4" redirection_nat; code=$?
  [ "$code" -eq "$2" ] && ok "$1" || ko "$1 : code $code au lieu de $2"
}
nat "aucune règle : rien de redirigé" 1 nft ''
nat "chaîne nat sans redirection (priorité dstnat)" 1 nft 'type nat hook prerouting priority dstnat; policy accept;'
nat "port publié vu par nft" 0 nft 'tcp dport 9000 counter dnat to 172.17.0.2:9000'
nat "port publié posé par iptables, nft absent" 0 iptables-nft-save '-A DOCKER ! -i docker0 -p tcp -m tcp --dport 9000 -j DNAT --to-destination 172.17.0.2:9000'
nat "port publié en IPv6, outil lu en dernier" 0 ip6tables-nft-save '-A DOCKER -p tcp --dport 9000 -j DNAT --to-destination [fd00::2]:9000'

# Paquet du noyau : « :arch » gardé, car apt ne trouve pas sans lui un paquet d'une autre architecture.
printf '#!/bin/bash\necho 6.1.0-temoin\n' > "$WORK/bin/uname"
printf '#!/bin/bash\necho "noyau-temoin:arm64: /boot/vmlinuz-6.1.0-temoin"\n' > "$WORK/bin/dpkg"
chmod +x "$WORK/bin/uname" "$WORK/bin/dpkg"
[ "$(paquet_noyau)" = noyau-temoin:arm64 ] && ok "paquet du noyau avec son architecture" || ko "paquet du noyau : $(paquet_noyau)"

# Jeton du tunnel (#125) : un faux stat donne le propriétaire et les droits (FAUX_DROITS), que le bash de
# Git ne sait pas poser. Un message ne doit jamais recopier le jeton : JETON en sert de témoin.
printf '#!/bin/bash\necho "$FAUX_DROITS"\n' > "$WORK/bin/stat"
chmod +x "$WORK/bin/stat"
JETON=eyJhIjoiamV0b24tdGVtb2luIn0aBcD0123456789
export JETON_TUNNEL="$WORK/tunnel.jeton"
jeton() { # <description> <motif attendu dans l'erreur, vide si le jeton est accepté> <droits>
  local err code
  err="$(FAUX_DROITS="$3" controler_jeton 2>&1)"; code=$?
  if [ -z "$2" ]; then
    [ "$code" -eq 0 ] && ok "$1" || ko "$1 : refusé ($err)"
  elif [ "$code" -eq 0 ]; then
    ko "$1 : accepté"
  elif ! grep -q -- "$2" <<<"$err"; then
    ko "$1 : message inattendu ($err)"
  elif grep -qF "$JETON" <<<"$err"; then
    ko "$1 : le jeton est recopié ($err)"
  else
    ok "$1"
  fi
}
jeton "jeton absent : arrêt expliqué" 'jeton du tunnel absent' '0 600'
mkdir "$JETON_TUNNEL"
jeton "dossier au lieu d'un fichier" "n'est pas un fichier ordinaire" '0 600'
rmdir "$JETON_TUNNEL"
printf '%s\n' "$JETON" > "$JETON_TUNNEL"
jeton "jeton à root, 600 : accepté" '' '0 600'
jeton "jeton à root, 400 : accepté" '' '0 400'
jeton "lisible par le groupe : arrêt" "n'être lisible que par lui" '0 640'
jeton "lisible par tous : arrêt" "n'être lisible que par lui" '0 644'
jeton "propriétaire autre que root : arrêt" "doit appartenir à root" '1000 600'
printf 'sudo cloudflared service install %s\n' "$JETON" > "$JETON_TUNNEL"
jeton "commande entière copiée : arrêt" 'sans la commande' '0 600'
printf '%s\n%s\n' "$JETON" "$JETON" > "$JETON_TUNNEL"
jeton "deux lignes : arrêt" 'sur une ligne' '0 600'
printf '\r\n  %s \t\r\n\r\n' "$JETON" > "$JETON_TUNNEL"
jeton "blancs autour, fins de ligne Windows et lignes vides tolérés (comme par cloudflared)" '' '0 600'
: > "$JETON_TUNNEL"
jeton "fichier vide : arrêt" 'sur une ligne' '0 600'

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
