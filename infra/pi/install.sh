#!/bin/bash
# Prépare le Pi à recevoir Étendard (ticket #4, ADR 0002 et 0006).
# À lancer en root sur le Pi, depuis ce dossier copié sur le Pi :
#   sudo bash install.sh github-deploy.pub
# Idempotent : peut être relancé sans dommage (met à jour script, config et clé).
# Ne touche à rien de Sentry : ni Docker, ni les ports 5000 et 8000.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PUBKEY_FILE="${1:-}"

step() { printf '\n==> %s\n' "$*"; }
die() { echo "ERREUR : $*" >&2; exit 1; }
warn() { echo "ATTENTION : $*" >&2; }

# --- Vérifications préalables ------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "à lancer en root (sudo bash install.sh <clé.pub>)"
[ -n "$PUBKEY_FILE" ] && [ -f "$PUBKEY_FILE" ] || die "usage : sudo bash install.sh <clé publique ed25519>"
read -r key_type key_b64 _ < "$PUBKEY_FILE" || true   # pas d'erreur si la ligne finale est sans retour
[ "$key_type" = ssh-ed25519 ] && [[ "$key_b64" =~ ^AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]+=*$ ]] \
  || die "$PUBKEY_FILE n'est pas une clé publique ssh-ed25519"
ssh-keygen -l -f "$PUBKEY_FILE" >/dev/null || die "clé publique illisible par ssh-keygen"

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

step "Service caddy (démarrage au boot)"
systemctl enable caddy
if [ "$caddy_changed" = 1 ] || ! systemctl is-active --quiet caddy; then
  systemctl restart caddy
fi
systemctl is-enabled caddy
systemctl is-active caddy

step "Terminé. Preuves : sudo bash verify.sh pi (sur le Pi), puis bash verify.sh ssh (sur le PC)."
