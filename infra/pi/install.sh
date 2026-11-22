#!/bin/bash
# Prépare, durcit et met en ligne le Pi qui sert Étendard (tickets #4, #113 et #125, ADR 0002, 0006 et 0017).
# À lancer en root sur le Pi, par sudo depuis le compte d'administration, dans ce dossier :
#   sudo bash install.sh github-deploy.pub
# Lit les valeurs propres au serveur dans /etc/etendard/serveur.conf (format : serveur.conf.exemple), et le
# jeton du tunnel Cloudflare dans /etc/etendard/tunnel.jeton (README.md), sans jamais l'afficher.
# Idempotent : peut être relancé sans dommage, sur ce Pi comme sur un système neuf.
# Ne modifie pas les services existants du Pi, sauf ceux que le fichier local demande de désactiver.
# SSH et le pare-feu changent en dernier : garde une session ouverte jusqu'au bout (README.md).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PUBKEY_FILE="${1:-}"
source "$HERE/commun.sh"

step() { printf '\n==> %s\n' "$*"; }
die() { echo "ERREUR : $*" >&2; exit 1; }
warn() { echo "ATTENTION : $*" >&2; }

# paquets <nom…> : installe ceux qui manquent, avec un seul « apt-get update » par exécution.
apt_a_jour=0
paquets() {
  local manquants=() p
  # Le statut, pas « dpkg -s » : il réussit aussi pour un paquet retiré dont la configuration reste.
  for p; do
    [ "$(dpkg-query -W -f='${Status}' "$p" 2>/dev/null)" = 'install ok installed' ] || manquants+=("$p")
  done
  [ "${#manquants[@]}" -gt 0 ] || return 0
  [ "$apt_a_jour" = 1 ] || { apt-get update; apt_a_jour=1; }
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${manquants[@]}"
}

# --- Vérifications préalables (avant tout changement) -------------------------
[ "$(id -u)" -eq 0 ] || die "à lancer en root (sudo bash install.sh <clé.pub>)"
[ -n "$PUBKEY_FILE" ] && [ -f "$PUBKEY_FILE" ] || die "usage : sudo bash install.sh <clé publique ed25519>"
read -r key_type key_b64 _ < "$PUBKEY_FILE" || true   # pas d'erreur si la ligne finale est sans retour
[ "$key_type" = ssh-ed25519 ] && [[ "$key_b64" =~ ^AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]+=*$ ]] \
  || die "$PUBKEY_FILE n'est pas une clé publique ssh-ed25519"
ssh-keygen -l -f "$PUBKEY_FILE" >/dev/null || die "clé publique illisible par ssh-keygen"

lire_conf || die "fichier local invalide, rien n'a été modifié"
controler_jeton || die "jeton du tunnel refusé, rien n'a été modifié"

# Garde-fou contre le verrouillage : sans clé autorisée, couper les mots de passe fermerait la porte à Flo.
admin="${SUDO_USER:-}"
[ -n "$admin" ] && [ "$admin" != root ] \
  || die "lance install.sh par sudo depuis le compte d'administration : c'est lui qui doit garder l'accès SSH"
cle_admin_autorisee "$admin" "$(getent passwd "$admin" | cut -d: -f6)" \
  || die "aucune clé SSH autorisée pour $admin : ajoute la tienne (ssh-copy-id) et vérifie qu'elle ouvre une session avant de couper les mots de passe ; rien n'a été modifié"

# Un port redirigé avant la chaîne d'entrée échapperait au pare-feu : mieux vaut le dire que le croire filtré.
! redirection_nat \
  || die "un port est redirigé (NAT) avant la chaîne d'entrée : le pare-feu ne le filtrerait pas (README.md) ; rien n'a été modifié"

if ss -Hltnp 'sport = :8080' | grep -v '"caddy"' | grep -q .; then
  die "le port 8080 est déjà pris par un autre programme : $(ss -Hltnp 'sport = :8080')"
fi
if sshd -T 2>/dev/null | grep -Eqi '^(allowusers|allowgroups) '; then
  warn "sshd a une directive AllowUsers/AllowGroups : ajoute-y deploy, sinon la clé sera refusée"
fi
if tailscale debug prefs 2>/dev/null | grep -q '"RunSSH": true'; then
  warn "Tailscale SSH est actif : il intercepte le port 22 du tailnet et contourne la commande forcée (voir tailscale-checklist.md)"
fi

# --- Utilisateur deploy ------------------------------------------------------
step "Utilisateur deploy (sans mot de passe, sans sudo, sans groupe secondaire)"
id deploy >/dev/null 2>&1 || useradd --create-home --user-group deploy
# Shell /bin/sh obligatoire : sshd lance la commande forcée par le shell de l'utilisateur.
# Mot de passe « * » : aucun mot de passe valide, sans verrouiller le compte pour la clé.
usermod --password '*' --shell /bin/sh -G '' deploy
deploy_home="$(getent passwd deploy | cut -d: -f6)"
id deploy

# --- Dossier du site ---------------------------------------------------------
step "Dossier /srv/etendard"
install -d -o deploy -g deploy -m 755 /srv/etendard /srv/etendard/releases
ls -ld /srv/etendard /srv/etendard/releases

# --- Script de réception -----------------------------------------------------
step "Script /usr/local/bin/etendard-receive"
install -o root -g root -m 755 "$HERE/etendard-receive" /usr/local/bin/etendard-receive
sha256sum /usr/local/bin/etendard-receive

# --- Clé de déploiement à commande forcée -------------------------------------
step "Clé de déploiement (authorized_keys à commande forcée)"
# .ssh et authorized_keys appartiennent à root : deploy ne peut pas les modifier.
ak="$deploy_home/.ssh/authorized_keys"
install -d -o root -g root -m 755 "$deploy_home/.ssh"
printf 'command="/usr/local/bin/etendard-receive",restrict %s %s github-deploy\n' "$key_type" "$key_b64" > "$ak.new"
chown root:root "$ak.new"
chmod 644 "$ak.new"
mv -f "$ak.new" "$ak"
ssh-keygen -l -f "$ak"

# --- Caddy -------------------------------------------------------------------
step "Configuration de Caddy (/etc/caddy/Caddyfile)"
# Écrite avant l'installation du paquet : Caddy ne démarre jamais avec la config
# par défaut du paquet (qui écoute sur :80).
install -d -m 755 /etc/caddy
caddy_changed=0
if ! cmp -s "$HERE/Caddyfile" /etc/caddy/Caddyfile; then
  install -o root -g root -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
  caddy_changed=1
fi

step "Paquet caddy (dépôt apt officiel de Caddy, cloudsmith.io)"
if ! dpkg -s caddy >/dev/null 2>&1; then
  apt-get update
  apt-get install -y curl gpg debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  gpg --show-keys /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  echo 'deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt_a_jour=1
  # --force-confold : garde notre Caddyfile au lieu de celui du paquet.
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold caddy
  caddy_changed=1
fi
caddy version
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Journal d'accès (directive log du Caddyfile) : à l'utilisateur caddy, sous lequel tourne le
# service. validate, lancé en root, vient de l'ouvrir et l'a créé s'il n'existait pas.
install -d -m 750 /var/log/caddy
chown -R caddy:caddy /var/log/caddy

step "Service caddy (démarrage au boot)"
systemctl enable caddy
if [ "$caddy_changed" = 1 ] || ! systemctl is-active --quiet caddy; then
  systemctl restart caddy
fi
systemctl is-enabled caddy
systemctl is-active caddy

# --- Cloudflare Tunnel (#125) --------------------------------------------------
step "Paquet cloudflared (dépôt apt officiel de Cloudflare, clé vérifiée par son empreinte)"
# Selon le dépôt, pas le paquet : un cloudflared installé d'ailleurs reçoit ainsi aussi les mises à jour. Une
# autre clé ou une autre ligne (anciennes instructions de Cloudflare) est remplacée.
cle=/usr/share/keyrings/cloudflare-public-v2.gpg
depot="deb [signed-by=$cle] https://pkg.cloudflare.com/cloudflared any main"
if [ "$(empreinte_cle "$cle")" != "$EMPREINTE_CLOUDFLARE" ] || [ "$(cat /etc/apt/sources.list.d/cloudflared.list 2>/dev/null)" != "$depot" ]; then
  paquets curl gpg
  curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg -o "$cle.new"
  if [ "$(empreinte_cle "$cle.new")" != "$EMPREINTE_CLOUDFLARE" ]; then
    rm -f "$cle.new"
    die "la clé servie par pkg.cloudflare.com n'est pas celle attendue (EMPREINTE_CLOUDFLARE de commun.sh) : dépôt non ajouté"
  fi
  chmod 644 "$cle.new"
  mv -f "$cle.new" "$cle"
  echo "$depot" > /etc/apt/sources.list.d/cloudflared.list
  # Relu même si cloudflared est déjà installé : sans lui, les mises à jour automatiques ignoreraient ce dépôt.
  apt-get update
  apt_a_jour=1
fi
paquets cloudflared
cloudflared --version

step "Service du tunnel (démarré en dernier, une fois le serveur durci)"
unites_changees=0 tunnel_changed=0
for f in "${UNITES_TUNNEL[@]}"; do
  if ! cmp -s "$HERE/$f" "/etc/systemd/system/$f"; then
    install -o root -g root -m 644 "$HERE/$f" "/etc/systemd/system/$f"
    unites_changees=1
    # Seul un changement du service lui-même demande de relancer le tunnel (coupure du site).
    [ "$f" != etendard-tunnel.service ] || tunnel_changed=1
  fi
done
[ "$unites_changees" = 0 ] || systemctl daemon-reload

# --- Isolation des services exposés (#113, critère 7) -------------------------
# score <unité> : niveau d'exposition de systemd-analyze security (0 : isolé, 10 : aucune isolation).
score() { systemd-analyze security --no-pager "$1" 2>/dev/null | awk '/Overall exposure level/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+\.[0-9]+$/) print $i }'; }

# isoler <unité> <dossiers où elle écrit…> : surcharge systemd d'isolation.conf, appliquée par un redémarrage
# s'il tourne (le tunnel, arrêté à sa première installation, ne démarre qu'à la fin).
isoler() {
  local unit="$1" d="/etc/systemd/system/$1.d" avant
  avant="$(score "$unit")"
  install -d -m 755 "$d"
  { cat "$HERE/isolation.conf"; echo "ReadWritePaths=${*:2}"; } > "$d/etendard-isolation.conf.new"
  if cmp -s "$d/etendard-isolation.conf.new" "$d/etendard-isolation.conf"; then
    rm -f "$d/etendard-isolation.conf.new"
    echo "$unit : isolation inchangée, score systemd-analyze security $avant"
    return
  fi
  mv -f "$d/etendard-isolation.conf.new" "$d/etendard-isolation.conf"
  systemctl daemon-reload
  if ! systemctl try-restart "$unit"; then
    # Comme pour sshd : la surcharge refusée est retirée, le service repart sans elle (le site reste servi).
    rm -f "$d/etendard-isolation.conf"
    systemctl daemon-reload
    systemctl restart "$unit" || true
    die "$unit ne démarre pas avec son isolation (journalctl -u $unit) : surcharge retirée, service relancé sans elle"
  fi
  echo "$unit : score systemd-analyze security avant $avant, après $(score "$unit")"
}

step "Isolation systemd des services exposés"
for unit in "${!SERVICES_ISOLES[@]}"; do
  # Sans guillemets : la valeur est une liste de dossiers séparés par des espaces.
  isoler "$unit" ${SERVICES_ISOLES[$unit]}
done

# --- Mises à jour automatiques (#113, critère 6) -------------------------------
step "Mises à jour automatiques : sécurité du système, noyau en cours, ${PAQUETS_MAJ_AUTO[*]}"
paquets unattended-upgrades
noyau="$(paquet_noyau)" || true   # sans « || true », set -e sortirait ici sans le message ci-dessous
[ -n "$noyau" ] || die "paquet du noyau en cours introuvable : ses mises à jour ne peuvent pas être activées"
# Les correctifs de sécurité du système viennent de la configuration du paquet (50unattended-upgrades) ;
# ce fichier, lu après elle, y ajoute les dépôts du noyau et des logiciels exposés.
maj=/etc/apt/apt.conf.d/52etendard-maj-auto
{
  echo '// Généré par install.sh (ticket #113) : relance install.sh plutôt que de modifier ce fichier.'
  echo 'APT::Periodic::Update-Package-Lists "1";'
  echo 'APT::Periodic::Unattended-Upgrade "1";'
  echo '// Pas de redémarrage automatique : verify.sh pi signale celui qui est en attente.'
  echo 'Unattended-Upgrade::Automatic-Reboot "false";'
  echo 'Unattended-Upgrade::Origins-Pattern {'
  maj_paquets=("$noyau" "${PAQUETS_MAJ_AUTO[@]}")
  mapfile -t motifs < <(origines_maj "${maj_paquets[@]}")
  for i in "${!maj_paquets[@]}"; do
    motif="${motifs[$i]:-}"
    if [ -z "$motif" ]; then
      warn "${maj_paquets[$i]} : absent ou sans dépôt, hors des mises à jour automatiques (relance install.sh une fois installé)"
    elif motif_exclu "$motif" "${DEPOTS_EXCLUS[@]}"; then
      warn "${maj_paquets[$i]} : dépôt exclu par le fichier local"
    else
      echo "  \"$motif\";"
    fi
  done
  echo '};'
} > "$maj.new"
mv -f "$maj.new" "$maj"
systemctl enable --now apt-daily.timer apt-daily-upgrade.timer

# --- Démarrage sans bureau, services inutiles désactivés (#113, critère 8) ----
step "Démarrage sans environnement graphique (effectif au prochain redémarrage), services du fichier local masqués"
systemctl set-default multi-user.target
for s in "${SERVICES[@]}"; do
  # Masqué plutôt que désactivé : ni un autre service ni un socket ne peut le relancer.
  systemctl mask "$s"
  systemctl stop "$s" 2>/dev/null || true   # unité absente de ce système : rien à arrêter
done

# --- SSH par clé uniquement (#113, critère 4) ----------------------------------
step "SSH par clé uniquement (/etc/ssh/sshd_config.d/00-etendard.conf)"
install -D -o root -g root -m 644 "$HERE/sshd-etendard.conf" /etc/ssh/sshd_config.d/00-etendard.conf
if ! sshd -t; then
  rm -f /etc/ssh/sshd_config.d/00-etendard.conf
  die "configuration de sshd refusée : fichier retiré, SSH inchangé"
fi
systemctl reload ssh   # les sessions ouvertes restent
[ "$(sshd -T | grep -Eic '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin) no$')" -eq 3 ] \
  || die "une autre configuration de sshd l'emporte (sshd -T) : mots de passe ou root encore acceptés"

# --- Pare-feu d'entrée (#113, critère 5) ---------------------------------------
step "Pare-feu d'entrée (table nftables inet etendard)"
paquets nftables
# Réseau local : les préfixes directement joignables par l'interface de la route par défaut.
lan_if="$(ip -o -4 route show default | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }')"
[ -n "$lan_if" ] || die "aucune route par défaut : réseau local introuvable, pare-feu non appliqué"
# Sans doublon (un même préfixe a une route par métrique) : nft peut refuser un élément répété.
mapfile -t lan4 < <(ip -o -4 route show dev "$lan_if" scope link | awk '$1 ~ /\// && !/ via / { print $1 }' | sort -u)
mapfile -t lan6 < <(ip -o -6 route show dev "$lan_if" | awk '$1 ~ /\// && $1 !~ /^fe80:/ && !/ via / { print $1 }' | sort -u)
lan6+=(fe80::/10)
[ "${#lan4[@]}" -gt 0 ] || die "aucun réseau IPv4 sur $lan_if : pare-feu non appliqué"
echo "Réseau local détecté sur $lan_if : ${lan4[*]} ${lan6[*]}"

udp=()
mapfile -t tcp < <(ports_ssh)
[ "${#tcp[@]}" -gt 0 ] || die "port SSH introuvable (sshd -T) : pare-feu non appliqué"
for p in "${PORTS[@]}"; do
  if [ "${p#*/}" = udp ]; then udp+=("${p%/*}"); else tcp+=("${p%/*}"); fi
done
# Sans doublon (port SSH aussi listé en PORT=) : nft peut refuser un élément répété dans un ensemble.
mapfile -t tcp < <(printf '%s\n' "${tcp[@]}" | sort -un)
mapfile -t udp < <(printf '%s\n' "${udp[@]}" | sort -un | grep .)
join() { local IFS=,; echo "$*"; }
# autoriser <proto> <ports…> : une règle par source autorisée (tailnet, réseau local en IPv4 et en IPv6).
autoriser() {
  local proto="$1" ports; shift
  [ "$#" -gt 0 ] || return 0
  ports="$(join "$@")"
  printf '\t\tiifname "tailscale0" %s dport { %s } accept\n' "$proto" "$ports"
  printf '\t\tiifname "%s" ip saddr { %s } %s dport { %s } accept\n' "$lan_if" "$(join "${lan4[@]}")" "$proto" "$ports"
  printf '\t\tiifname "%s" ip6 saddr { %s } %s dport { %s } accept\n' "$lan_if" "$(join "${lan6[@]}")" "$proto" "$ports"
}
regles=/etc/etendard/pare-feu.nft
install -d -m 755 /etc/etendard
{
  echo '# Généré par install.sh (ticket #113) : relance install.sh plutôt que de modifier ce fichier.'
  echo '# Créer puis supprimer la table rend le fichier rejouable : il la remplace en une transaction.'
  echo 'table inet etendard'
  echo 'delete table inet etendard'
  echo 'table inet etendard {'
  echo '	chain entree {'
  echo '		type filter hook input priority filter; policy drop;'
  echo '		iif lo accept'
  echo '		ct state established,related accept'
  echo '		# IPv6 : voisins, routeur et réponses DHCPv6, sans quoi le Pi perd son adresse IPv6 ; requêtes MLD,'
  echo '		# sans quoi un commutateur qui filtre le multicast cesse de lui transmettre les voisins (RFC 4890).'
  echo '		icmpv6 type { nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, mld-listener-query } accept'
  echo '		ip6 saddr fe80::/10 udp sport 547 udp dport 546 accept'
  autoriser tcp "${tcp[@]}"
  autoriser udp "${udp[@]}"
  echo '	}'
  echo '}'
} > "$regles.new"
nft -c -f "$regles.new" || die "règles refusées par nft : pare-feu inchangé"
mv -f "$regles.new" "$regles"
install -o root -g root -m 644 "$HERE/etendard-pare-feu.service" /etc/systemd/system/etendard-pare-feu.service
systemctl daemon-reload
systemctl enable etendard-pare-feu
systemctl reload-or-restart etendard-pare-feu
systemctl is-active etendard-pare-feu

# --- Mise en ligne (#125) ------------------------------------------------------
# En dernier : un arrêt plus haut (die) laisse le site hors ligne plutôt que public sur un serveur à moitié durci.
step "Tunnel Cloudflare (mise en ligne) et sa relance après une mise à jour de cloudflared"
systemctl enable etendard-tunnel etendard-tunnel-maj.path
systemctl start etendard-tunnel-maj.path
if [ "$tunnel_changed" = 1 ] || ! systemctl is-active --quiet etendard-tunnel; then
  # Type=notify : le redémarrage ne réussit qu'une fois le tunnel connecté à Cloudflare.
  systemctl restart etendard-tunnel \
    || die "le tunnel ne se connecte pas à Cloudflare (jeton révoqué ? réseau ? isolation ?) : journalctl -u etendard-tunnel"
fi
systemctl is-active etendard-tunnel etendard-tunnel-maj.path

step "Terminé. Avant de fermer cette session, ouvre-en une nouvelle depuis le réseau local et depuis le tailnet (README.md)."
echo "Preuves : sudo bash verify.sh pi (sur le Pi), puis HOST=<hote-du-pi> FLO=<login>@<ip-du-pi> bash verify.sh ssh et bash verify.sh public <domaine> (sur le PC)."
