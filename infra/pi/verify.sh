#!/bin/bash
# Produit les preuves des critères 1 à 5 du ticket #4, à coller en commentaire, du critère 4 du ticket #25
# et du critère 2 du ticket #36.
#   sudo bash verify.sh pi      sur le Pi, après install.sh (critères 1, 2, 3 et verrou ; en-têtes, journal, cache)
#   bash verify.sh ssh          sur le PC, avec la clé privée (critères 1, 4 et 5)
# Variables du mode ssh : KEY (clé privée, défaut ~/.ssh/github-deploy),
# HOST (défaut florasp), FLO (défaut flo@192.168.1.41), LAN_IP (défaut 192.168.1.41).
# Lecture seule, sauf en mode ssh : publie deux versions de test puis revient à la première.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
pass=0 fail=0

# probe <attendu|interdit> <description> <motif grep -E> <commande...> :
# affiche la commande, sa sortie et le verdict.
probe() {
  local want="$1" desc="$2" pattern="$3"; shift 3
  local out found=interdit
  echo "\$ $*"
  out="$("$@" 2>&1)"
  [ -n "$out" ] && sed 's/^/  /' <<<"$out"
  grep -Eq -- "$pattern" <<<"$out" && found=attendu
  if [ "$found" = "$want" ]; then
    pass=$((pass + 1)); echo "  ✅ $desc"
  else
    fail=$((fail + 1)); echo "  ❌ $desc (motif $want : /$pattern/)"
  fi
  echo
}
check() { probe attendu "$@"; }
refute() { probe interdit "$@"; }

# header <url> <nom> : affiche l'en-tête servi, puis « conforme » s'il est identique à celui du
# Caddyfile de ce dossier (une config modifiée mais pas rechargée ne l'est pas).
header() {
  local got want
  got="$(curl -sSI "$1" | tr -d '\r' | grep -i "^$2:")"
  want="$(sed -n "s|^[[:space:]]*$2 \"\(.*\)\"$|$2: \1|p" "$HERE/Caddyfile")"
  echo "$got"
  [ -n "$want" ] && [ "$got" = "$want" ] && echo conforme
}

title() { printf '\n### %s\n\n' "$*"; }

mode_pi() {
  [ "$(id -u)" -eq 0 ] || { echo "à lancer en root : sudo bash verify.sh pi" >&2; exit 1; }
  export LC_ALL=C   # messages système en anglais, pour les motifs attendus
  echo "Hôte : $(hostname) — $(date -Is)"

  title "Critère 1 — Caddy"
  check "Caddy installé" '^v2\.' caddy version
  check "démarre au boot" '^enabled$' systemctl is-enabled caddy
  check "actif" '^active$' systemctl is-active caddy
  check "écoute sur 127.0.0.1:8080" '127\.0\.0\.1:8080' ss -Hltnp 'sport = :8080'
  refute "aucune autre écoute de Caddy" '"caddy"' sh -c "ss -Hltnup | grep -v '127.0.0.1:8080 '"
  check "racine /srv/etendard/current" 'root \* /srv/etendard/current' grep -n root /etc/caddy/Caddyfile
  check "sert le site en local" '^HTTP/1.1 (200|404)' curl -sSI http://127.0.0.1:8080/
  refute "injoignable par l'adresse LAN" '^HTTP' curl -sSI --connect-timeout 3 "http://$(hostname -I | cut -d' ' -f1):8080/"

  title "Ticket #25 — en-têtes de sécurité et journal d'accès"
  check "Caddyfile installé, identique à celui de ce dossier" '^ok$' sh -c "cmp /etc/caddy/Caddyfile '$HERE/Caddyfile' && echo ok"
  # Une page servie et une erreur 404 : les en-têtes doivent être sur chaque réponse.
  # Chemin propre à ce passage : sa ligne dans le journal ne peut venir que de lui.
  local url name absent="/absente-verify-sh-$(date +%s)"
  for url in http://127.0.0.1:8080/ "http://127.0.0.1:8080$absent"; do
    for name in Content-Security-Policy X-Content-Type-Options Referrer-Policy Permissions-Policy; do
      check "$name sur $url, conforme au Caddyfile" '^conforme$' header "$url" "$name"
    done
  done
  local log=/var/log/caddy/etendard-access.log
  # grep plutôt que tail : d'autres visites peuvent s'être intercalées.
  check "journal d'accès JSON, avec la requête $absent" '^\{.*"logger":"http\.log\.access' grep -F "\"uri\":\"$absent\"" "$log"
  check "journal à l'utilisateur caddy" '^caddy:caddy ' stat -c '%U:%G %a %n' "$log"

  title "Ticket #36 — cache d'un an des fichiers de /_astro/"
  # Un fichier réel du site servi : son nom porte l'empreinte de son contenu.
  local asset
  asset="$(find /srv/etendard/current/_astro -maxdepth 1 -type f -printf '%f\n' -quit)"
  check "Cache-Control sur /_astro/$asset, conforme au Caddyfile" '^conforme$' header "http://127.0.0.1:8080/_astro/$asset" Cache-Control
  refute "pas de cache d'un an sur /" 'max-age=31536000|immutable' header http://127.0.0.1:8080/ Cache-Control
  refute "pas de cache d'un an sur une 404 de /_astro/" 'max-age=31536000|immutable' header "http://127.0.0.1:8080/_astro$absent" Cache-Control

  title "Critère 2 — utilisateur deploy"
  check "utilisateur deploy, sans groupe secondaire" '^uid=[0-9]+\(deploy\) gid=[0-9]+\(deploy\) groups=[0-9]+\(deploy\)$' id deploy
  check "aucun mot de passe valide (champ « * »)" '^deploy:\*$' sh -c "getent shadow deploy | cut -d: -f1,2"
  check "aucun droit sudo" 'not allowed to run sudo' sudo -l -U deploy
  check "une seule clé, à commande forcée" '^1 command="/usr/local/bin/etendard-receive",restrict ssh-ed25519 [^ ]+ github-deploy$' \
    sh -c 'f=~deploy/.ssh/authorized_keys; printf "%s %s\n" "$(grep -c . $f)" "$(cat $f)"'
  check "authorized_keys non modifiable par deploy" '^root:root 644 ' sh -c 'stat -c "%U:%G %a %n" ~deploy/.ssh/authorized_keys ~deploy/.ssh'
  check "sshd accepte la clé" 'pubkeyauthentication yes' sh -c "sshd -T | grep -Ei '^(pubkeyauthentication|allowusers|allowgroups|authorizedkeysfile) '"

  title "Critère 3 — etendard-receive"
  check "script installé, identique au repo" '^ok$' sh -c "cmp /usr/local/bin/etendard-receive '$HERE/etendard-receive' && echo ok"
  check "droits du script" '^root:root 755$' stat -c '%U:%G %a' /usr/local/bin/etendard-receive
  check "dossiers du site à deploy" 'deploy deploy' ls -ld /srv/etendard /srv/etendard/releases
  check "versions et lien current" 'releases' sh -c 'ls -l /srv/etendard /srv/etendard/releases'
  # Verrou réel (le bash de Git n'a pas flock) : on le prend 5 s au nom de deploy.
  runuser -u deploy -- flock /srv/etendard/.lock sleep 5 &
  sleep 1
  check "verrou flock : 2e opération refusée pendant un déploiement" 'autre déploiement' \
    runuser -u deploy -- env SSH_ORIGINAL_COMMAND=rollback /usr/local/bin/etendard-receive
  wait

  title "Sentry intact (lecture seule)"
  check "ports 5000 et 8000 toujours servis" ':(5000|8000) ' ss -Hltn '( sport = :5000 or sport = :8000 )'
}

mode_ssh() {
  local key="${KEY:-$HOME/.ssh/github-deploy}" host="${HOST:-florasp}"
  local flo="${FLO:-flo@192.168.1.41}" lan="${LAN_IP:-192.168.1.41}"
  [ -f "$key" ] || { echo "clé privée introuvable : $key (variable KEY)" >&2; exit 1; }
  local ssh=(ssh -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
  d="$(mktemp -d)"; trap 'rm -rf "$d"' EXIT
  local a=e7e7e7a b=e7e7e7b
  for v in $a $b; do
    mkdir -p "$d/$v"; echo "$v" > "$d/$v/version.txt"
    printf '<!doctype html><meta charset="utf-8"><title>Étendard</title><h1>Page de test %s</h1>\n' "$v" > "$d/$v/index.html"
    tar -czf "$d/$v.tar.gz" -C "$d/$v" .
  done
  echo "Depuis : $(hostname) — $(date -Iseconds) — clé $(ssh-keygen -l -f "$key" | cut -d' ' -f2)"

  title "Critère 1 — Caddy injoignable hors du Pi"
  refute "pas de site sur $lan:8080" '^HTTP' curl -sSI --connect-timeout 3 "http://$lan:8080/"
  refute "pas de site sur $host:8080 (Tailscale)" '^HTTP' curl -sSI --connect-timeout 3 "http://$host:8080/"

  title "Critère 4 — la clé ne lance que etendard-receive"
  check "sans commande : etendard-receive attend une archive" 'archive vide' "${ssh[@]}" "deploy@$host" </dev/null
  check "commande arbitraire refusée" 'commande refusée : id' "${ssh[@]}" "deploy@$host" id </dev/null
  check "enchaînement refusé" 'commande refusée' "${ssh[@]}" "deploy@$host" 'status; cat /etc/passwd' </dev/null
  # sshd ne relaie pas toujours stderr (sous-système, PTY refusé) : on prouve le refus par ses effets.
  check "terminal refusé" 'PTY allocation request failed' "${ssh[@]}" -tt "deploy@$host" bash </dev/null
  refute "aucune commande exécutée, même avec -tt" 'SHELL_OUVERT' "${ssh[@]}" -tt "deploy@$host" 'echo SHELL_OUVERT' </dev/null
  echo pwd > "$d/sftp-batch"
  refute "aucune session sftp" 'Remote working directory' \
    sftp -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 -b "$d/sftp-batch" "deploy@$host"
  check "redirection de port refusée" 'prohibited|refused|failed' "${ssh[@]}" -W 127.0.0.1:8080 "deploy@$host" </dev/null

  title "Critère 5 — réception, status, rollback"
  check "envoi de la version $a" "version $a" "${ssh[@]}" "deploy@$host" < "$d/$a.tar.gz"
  check "status = $a" "^$a\$" "${ssh[@]}" "deploy@$host" status </dev/null
  check "page $a servie sur le Pi" "Page de test $a" ssh "$flo" curl -s http://127.0.0.1:8080/
  check "envoi de la version $b" "version $b" "${ssh[@]}" "deploy@$host" < "$d/$b.tar.gz"
  check "status = $b" "^$b\$" "${ssh[@]}" "deploy@$host" status </dev/null
  check "page $b servie" "Page de test $b" ssh "$flo" curl -s http://127.0.0.1:8080/
  check "rollback" "retour à la version $a" "${ssh[@]}" "deploy@$host" rollback </dev/null
  check "status = $a après rollback" "^$a\$" "${ssh[@]}" "deploy@$host" status </dev/null
  check "page $a de nouveau servie" "Page de test $a" ssh "$flo" curl -s http://127.0.0.1:8080/

  title "Durcissement — deux déploiements simultanés"
  ( sleep 5; cat "$d/$b.tar.gz" ) | "${ssh[@]}" "deploy@$host" > "$d/first.log" 2>&1 &
  sleep 2
  check "2e envoi refusé pendant le 1er" 'autre déploiement' "${ssh[@]}" "deploy@$host" < "$d/$a.tar.gz"
  wait
  check "le 1er envoi a abouti" "version $b" cat "$d/first.log"
  check "rollback final vers $a" "retour à la version $a" "${ssh[@]}" "deploy@$host" rollback </dev/null

  echo "Reste à faire à la main : ssh -L 8080:127.0.0.1:8080 $flo puis http://localhost:8080 → « Page de test $a »."
}

case "${1:-}" in
  pi) mode_pi ;;
  ssh) mode_ssh ;;
  *) echo "usage : sudo bash verify.sh pi   |   bash verify.sh ssh" >&2; exit 2 ;;
esac

echo "Bilan : $pass ✅, $fail ❌"
[ "$fail" -eq 0 ]
