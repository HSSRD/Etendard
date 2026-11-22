#!/bin/bash
# Prépare et durcit le Pi qui sert Étendard (tickets #4 et #113, ADR 0002, 0006 et 0017).
# À lancer en root sur le Pi, par sudo depuis le compte d'administration, dans ce dossier :
#   sudo bash install.sh github-deploy.pub
# Lit les valeurs propres au serveur dans /etc/etendard/serveur.conf (format : serveur.conf.exemple).
# Idempotent : peut être relancé sans dommage, sur ce Pi comme sur un système neuf.
# Ne modifie aucun autre service du Pi, sauf ceux que le fichier local demande de désactiver.
# SSH et le pare-feu changent en dernier : garde une session ouverte jusqu'au bout (README.md).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PUBKEY_FILE="${1:-}"
source "$HERE/commun.sh"

step() { printf '\n==> %s\n' "$*"; }
die() { echo "ERREUR : $*" >&2; exit 1; }
warn() { echo "ATTENTION : $*" >&2; }

# --- Vérifications préalables (avant tout changement) -------------------------
[ "$(id -u)" -eq 0 ] || die "à lancer en root (sudo bash install.sh <clé.pub>)"
[ -n "$PUBKEY_FILE" ] && [ -f "$PUBKEY_FILE" ] || die "usage : sudo bash install.sh <clé publique ed25519>"
read -r key_type key_b64 _ < "$PUBKEY_FILE" || true   # pas d'erreur si la ligne finale est sans retour
[ "$key_type" = ssh-ed25519 ] && [[ "$key_b64" =~ ^AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]+=*$ ]] \
  || die "$PUBKEY_FILE n'est pas une clé publique ssh-ed25519"
ssh-keygen -l -f "$PUBKEY_FILE" >/dev/null || die "clé publique illisible par ssh-keygen"

lire_conf || die "fichier local invalide, rien n'a été modifié"

# Garde-fou contre le verrouillage : sans clé autorisée, couper les mots de passe fermerait la porte à Flo.
admin="${SUDO_USER:-}"
[ -n "$admin" ] && [ "$admin" != root ] \
  || die "lance install.sh par sudo depuis le compte d'administration : c'est lui qui doit garder l'accès SSH"
cle_admin_autorisee "$admin" "$(getent passwd "$admin" | cut -d: -f6)" \
  || die "aucune clé SSH autorisée pour $admin : ajoute la tienne (ssh-copy-id) et vérifie qu'elle ouvre une session avant de couper les mots de passe ; rien n'a été modifié"

# Un port redirigé avant la chaîne d'entrée échapperait au pare-feu : mieux vaut le dire que le croire filtré.
for i in "${!PORTS[@]}"; do
  ! port_contourne "${PORTS[$i]}" \
    || die "le port n°$((i + 1)) du fichier local est redirigé (NAT) avant la chaîne d'entrée : le pare-feu ne le filtrerait pas ; rien n'a été modifié"
done

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

# --- Isolation des services exposés (#113, critère 7) -------------------------
# score <unité> : niveau d'exposition de systemd-analyze security (0 : isolé, 10 : aucune isolation).
score() { systemd-analyze security --no-pager "$1" 2>/dev/null | awk '/Overall exposure level/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+\.[0-9]+$/) print $i }'; }

# isoler <unité> <dossiers où elle écrit…> : surcharge systemd d'isolation.conf, appliquée par un redémarrage.
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
  systemctl restart "$unit" \
    || die "$unit ne démarre pas avec son isolation (journalctl -u $unit) ; retour arrière : README.md"
  echo "$unit : score systemd-analyze security avant $avant, après $(score "$unit")"
}

step "Isolation systemd des services exposés"
isoler caddy.service /var/lib/caddy /var/log/caddy

# --- Mises à jour automatiques (#113, critère 6) -------------------------------
step "Mises à jour automatiques : sécurité du système, noyau en cours, ${PAQUETS_MAJ_AUTO[*]}"
if ! dpkg -s unattended-upgrades >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades
fi
noyau="$(paquet_noyau)"
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
  for paquet in "$noyau" "${PAQUETS_MAJ_AUTO[@]}"; do
    if ! motif="$(origine_maj "$paquet")"; then
      warn "$paquet : absent ou sans dépôt, hors des mises à jour automatiques (relance install.sh une fois installé)"
      continue
    fi
    for depot in "${DEPOTS_EXCLUS[@]}"; do
      [[ ",$motif," == *",origin=$depot,"* ]] && { warn "$paquet : dépôt exclu par le fichier local"; continue 2; }
    done
    echo "  \"$motif\";"
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
command -v nft >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y nftables
# Réseau local : les préfixes directement joignables par l'interface de la route par défaut.
lan_if="$(ip -o -4 route show default | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }')"
[ -n "$lan_if" ] || die "aucune route par défaut : réseau local introuvable, pare-feu non appliqué"
mapfile -t lan4 < <(ip -o -4 route show dev "$lan_if" scope link | awk '$1 ~ /\// && !/ via / { print $1 }')
mapfile -t lan6 < <(ip -o -6 route show dev "$lan_if" | awk '$1 ~ /\// && $1 !~ /^fe80:/ && !/ via / { print $1 }')
lan6+=(fe80::/10)
[ "${#lan4[@]}" -gt 0 ] || die "aucun réseau IPv4 sur $lan_if : pare-feu non appliqué"
echo "Réseau local détecté sur $lan_if : ${lan4[*]} ${lan6[*]}"

tcp=() udp=()
mapfile -t tcp < <(sshd -T | awk '$1 == "port" { print $2 }')
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
  echo '		# IPv6 : voisins, routeur et réponses DHCPv6, sans quoi le Pi perd son adresse IPv6.'
  echo '		icmpv6 type { nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert } accept'
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

step "Terminé. Avant de fermer cette session, ouvre-en une nouvelle depuis le réseau local et depuis le tailnet (README.md)."
echo "Preuves : sudo bash verify.sh pi (sur le Pi), puis HOST=<hote-du-pi> FLO=<login>@<ip-du-pi> bash verify.sh ssh (sur le PC)."
