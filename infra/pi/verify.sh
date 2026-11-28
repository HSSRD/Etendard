#!/bin/bash
# Produit les preuves des critères 1 à 5 du ticket #4, à coller en commentaire, du critère 4 du ticket #25,
# du critère 2 du ticket #36, du critère 3 du ticket #52, des critères 1 et 2 du ticket #41, du ticket #106,
# des critères 1 et 2 du ticket #114, des critères 4 à 8 du ticket #113 et des critères 3 et 6 du ticket #125.
#   sudo bash verify.sh pi      sur le Pi, après install.sh (critères 1, 2, 3 et verrou ; en-têtes, journal, cache, page 404 ;
#                               durcissement ; tunnel). Sortie sans adresse, nom de machine, port ni liste de logiciels :
#                               elle se colle telle quelle dans un ticket. « sudo DETAIL=1 bash verify.sh pi »
#                               affiche aussi chaque commande et sa sortie, pour chercher une panne (à ne pas coller).
#   HOST=… FLO=… bash verify.sh ssh   sur le PC, avec la clé privée (critères 1, 4 et 5), après un premier déploiement
#   bash verify.sh hsts <domaine>   depuis n'importe quel poste, une fois le site en ligne (HSTS de Cloudflare)
#   bash verify.sh public <domaine>   depuis n'importe quel poste : site servi par Cloudflare Tunnel (#125), sortie
#                               sans le domaine, à coller telle quelle (DETAIL=1 : commandes et sorties)
# Variables du mode ssh : KEY (clé privée, défaut ~/.ssh/github-deploy), HOST (nom du Pi dans le tailnet),
# FLO (<login>@<ip-du-pi>), LAN_IP (défaut : l'adresse de FLO). HOST et FLO sont obligatoires :
# le repo ne contient aucune valeur du réseau local (#31).
# Lecture seule, sauf en mode ssh : publie deux versions de test puis revient à la version servie au départ (#135).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/commun.sh"
pass=0 fail=0
show=1   # 0 (modes pi et public) : seulement la description et le verdict, sans commande ni sortie
# En-têtes de sécurité, lus dans le bloc « header { » du Caddyfile de ce dossier : un en-tête ajouté y est
# contrôlé en local (mode pi) et en public sans autre modification.
mapfile -t EN_TETES_SECURITE < <(awk '{ l = $0; sub(/^[[:space:]]+/, "", l) } l == "header {" { b = 1; next }
  b && l == "}" { b = 0 } b && match(l, /^[A-Za-z-]+ "/) { print substr(l, 1, RLENGTH - 2) }' "$HERE/Caddyfile")
# Une liste vide ne contrôlerait aucun en-tête, en silence (bloc renommé ou réécrit).
[ "${#EN_TETES_SECURITE[@]}" -gt 0 ] || { echo "aucun en-tête de sécurité lu dans le bloc « header { » du Caddyfile" >&2; exit 1; }

# probe <attendu|interdit> <description> <motif grep -E> <commande...> :
# affiche la commande, sa sortie et le verdict.
probe() {
  local want="$1" desc="$2" pattern="$3"; shift 3
  local out found=interdit
  [ "$show" = 1 ] && echo "\$ $*"
  out="$("$@" 2>&1)"
  [ "$show" = 1 ] && [ -n "$out" ] && sed 's/^/  /' <<<"$out"
  grep -Eq -- "$pattern" <<<"$out" && found=attendu
  [ "$found" = "$want" ]
  verdict $? "$desc" "$([ "$show" = 1 ] && echo " (motif $want : /$pattern/)")"
  if [ "$show" = 1 ]; then echo; fi
}
# verdict <code : 0 réussi> <description> [précision affichée en cas d'échec] : compte et affiche.
verdict() {
  if [ "$1" -eq 0 ]; then
    pass=$((pass + 1)); echo "  ✅ $2"
  else
    fail=$((fail + 1)); echo "  ❌ $2${3:-}"
  fi
}
check() { probe attendu "$@"; }
refute() { probe interdit "$@"; }

# served <url> <nom> [options curl…] : la ligne de l'en-tête servi, son nom écrit comme demandé (en HTTP/2,
# par Cloudflare, les noms arrivent en minuscules).
served() { curl -sSI "${@:3}" "$1" | tr -d '\r' | grep -i "^$2:" | sed "s/^[^:]*:/$2:/"; }

# header <url> <nom> [matcher [options curl…]] : affiche l'en-tête servi, puis « conforme » s'il est
# identique à celui du bloc « header [matcher] { » du Caddyfile de ce dossier (une config modifiée
# mais pas rechargée ne l'est pas). Sans matcher, le bloc des en-têtes de sécurité.
header() {
  local got want
  got="$(served "$1" "$2" "${@:4}")"
  want="$(awk -v name="$2" -v block="header ${3:+$3 }{" '
    { line = $0; sub(/^[[:space:]]+/, "", line) }
    line == block { inside = 1; next }
    inside && line == "}" { inside = 0 }
    inside && index(line, name " \"") == 1 && sub(/"$/, "", line) { print name ": " substr(line, length(name) + 3) }
  ' "$HERE/Caddyfile")"
  echo "$got"
  [ -n "$want" ] && [ "$got" = "$want" ] && echo conforme
}

title() { printf '\n### %s\n\n' "$*"; }

# verifier_port <libellé> <port/proto> (#113) : autorisé depuis le tailnet et le réseau local dans la chaîne
# d'entrée. Le libellé remplace le numéro dans la sortie.
verifier_port() {
  # nft affiche « dport 22 » pour un seul port, « dport { 22, 9000 } » pour plusieurs.
  local dport="${2#*/} dport (${2%/*}|\{ ([^}]*, )?${2%/*}(, [^}]*)? \}) accept"
  check "port $1 autorisé depuis le tailnet" "iifname \"tailscale0\" $dport" nft list chain inet etendard entree
  check "port $1 autorisé depuis le réseau local" "ip saddr .* $dport" nft list chain inet etendard entree
}

mode_pi() {
  [ "$(id -u)" -eq 0 ] || { echo "à lancer en root : sudo bash verify.sh pi" >&2; exit 1; }
  export LC_ALL=C   # messages système en anglais, pour les motifs attendus
  lire_conf || exit 1
  show="${DETAIL:-0}"
  # Sortie à coller dans un ticket : les erreurs hors de probe (curl, apt…) peuvent citer une adresse ou un port.
  [ "$show" = 1 ] || exec 2>/dev/null
  echo "verify.sh pi — $(date -Is)"

  title "Critère 1 — Caddy"
  check "Caddy installé" '^v2\.' caddy version
  check "démarre au boot" '^enabled$' systemctl is-enabled caddy
  check "actif" '^active$' systemctl is-active caddy
  check "écoute sur la boucle locale seulement" '127\.0\.0\.1:8080' ss -Hltnp 'sport = :8080'
  refute "aucune autre écoute de Caddy" '"caddy"' sh -c "ss -Hltnup | grep -v '127.0.0.1:8080 '"
  check "racine /srv/etendard/current" 'root \* /srv/etendard/current' grep -n root /etc/caddy/Caddyfile
  check "sert le site en local" '^HTTP/1.1 (200|404)' curl -sSI http://127.0.0.1:8080/
  refute "injoignable par l'adresse LAN" '^HTTP' curl -sSI --connect-timeout 3 "http://$(hostname -I | cut -d' ' -f1):8080/"

  title "Ticket #25 — en-têtes de sécurité et journal d'accès"
  check "Caddyfile installé, identique à celui de ce dossier" '^ok$' sh -c "cmp /etc/caddy/Caddyfile '$HERE/Caddyfile' && echo ok"
  # Une page servie et des erreurs 404 (la page 404 du site, #114) : les en-têtes doivent être sur chaque réponse.
  # Chemin propre à ce passage : sa ligne dans le journal ne peut venir que de lui.
  local url name absent="/absente-verify-sh-$(date +%s)"
  # À la racine, dans un dossier du site, sous /_expo/static/ (cache d'un an) : trois routes de Caddy.
  # Chemins seuls dans la sortie : elle ne montre pas le port de Caddy (#113, critère 10).
  local missing=("$absent" "/projets$absent" "/_expo/static$absent.js")
  for url in / "${missing[@]}"; do
    for name in "${EN_TETES_SECURITE[@]}"; do
      check "$name sur $url, conforme au Caddyfile" '^conforme$' header "http://127.0.0.1:8080$url" "$name"
    done
  done
  local log=/var/log/caddy/etendard-access.log
  # grep plutôt que tail : d'autres visites peuvent s'être intercalées.
  check "journal d'accès JSON, avec la requête $absent" '^\{.*"logger":"http\.log\.access' grep -F "\"uri\":\"$absent\"" "$log"
  check "journal à l'utilisateur caddy" '^caddy:caddy ' stat -c '%U:%G %a %n' "$log"

  title "Tickets #36 et #76 — cache d'un an des fichiers de /_expo/static/"
  # Un fichier réel du site servi : son nom porte l'empreinte de son contenu.
  local asset
  asset="$(find /srv/etendard/current/_expo/static -type f -printf '%P\n' -quit)"
  check "Cache-Control sur /_expo/static/$asset, conforme au Caddyfile" '^conforme$' header "http://127.0.0.1:8080/_expo/static/$asset" Cache-Control '/_expo/static/*'
  # Ni sur un nom fixe, ni sur une 404 de /_expo/static/.
  for url in / /version.txt "/_expo/static$absent"; do
    refute "pas de cache d'un an sur $url" 'max-age=31536000|immutable' header "http://127.0.0.1:8080$url" Cache-Control
  done

  title "Ticket #52 — pages HTML revalidées, version.txt jamais en cache"
  for url in / /index.html; do
    check "Cache-Control sur $url, conforme au Caddyfile" '^conforme$' header "http://127.0.0.1:8080$url" Cache-Control @html
  done
  # La revalidation par ETag répond 304 (statut vérifié ici, en-tête juste après).
  local etag
  check "ETag servi sur /" '^E[Tt]ag: "[^"]+"$' served http://127.0.0.1:8080/ ETag
  etag="$(served http://127.0.0.1:8080/ ETag)"; etag="${etag#*: }"
  check "revalidation de / par ETag : 304" '^HTTP/1.1 304' curl -sSI -H "If-None-Match: $etag" http://127.0.0.1:8080/
  check "Cache-Control sur la revalidation de / (If-None-Match), conforme au Caddyfile" '^conforme$' \
    header http://127.0.0.1:8080/ Cache-Control @html -H "If-None-Match: $etag"
  check "Cache-Control sur /version.txt, conforme au Caddyfile" '^conforme$' header http://127.0.0.1:8080/version.txt Cache-Control /version.txt

  title "Ticket #106 — pages sans extension"
  # Une page réelle du site demandée sans « .html », et l'index d'un sous-dossier sans barre oblique finale :
  # 200 sans redirection, revalidées comme les autres pages.
  # current est un lien symbolique : la barre oblique finale fait entrer find dedans.
  # Les noms viennent des fichiers de deploy : jamais dans une chaîne passée à un shell (verify.sh tourne en root).
  local page dir
  page="$(find /srv/etendard/current/ -name '*.html' ! -name index.html -printf '/%P\n' -quit)"
  dir="$(find /srv/etendard/current/ -mindepth 2 -name index.html -printf '/%P\n' -quit)"
  if [ -n "$page" ] && [ -n "$dir" ]; then
    for url in "${page%.html}" "${dir%/index.html}"; do
      check "$url répond 200" '^HTTP/1.1 200' curl -sSI "http://127.0.0.1:8080$url"
      check "Cache-Control sur $url, conforme au Caddyfile" '^conforme$' header "http://127.0.0.1:8080$url" Cache-Control @html
    done
  else
    fail=$((fail + 1)); echo "  ❌ le site servi n'a pas de page hors index.html ou de sous-dossier avec index.html"; echo
  fi

  title "Ticket #114 — page 404 du site"
  local h
  # notfound [options curl…] <url> : « ok » si le corps servi est la page 404 du site servi.
  notfound() { curl -s "$@" | cmp -s - /srv/etendard/current/+not-found.html && echo ok; }
  for url in "${missing[@]}"; do
    check "$url répond 404" '^HTTP/1.1 404' curl -sSI "http://127.0.0.1:8080$url"
    check "Content-Type text/html sur $url" '^Content-Type: text/html' served "http://127.0.0.1:8080$url" Content-Type
    check "corps de $url identique à +not-found.html" '^ok$' notfound "http://127.0.0.1:8080$url"
    # Une revalidation, une plage ou une précondition reçoit aussi la page entière, pas une 404 vide ou
    # tronquée. Chaque valeur déclencherait 304, 206 ou 412 sur le fichier, sans lire ses ETag et date.
    for h in 'If-None-Match: *' 'If-Modified-Since: Fri, 01 Jan 2100 00:00:00 GMT' 'Range: bytes=0-9' \
      'If-Match: "absent"' 'If-Unmodified-Since: Thu, 01 Jan 1970 00:00:00 GMT'; do
      check "$url avec $h : corps identique à +not-found.html" '^ok$' notfound -H "$h" "http://127.0.0.1:8080$url"
    done
    check "Cache-Control sur $url, conforme au Caddyfile (celui des pages)" '^conforme$' header "http://127.0.0.1:8080$url" Cache-Control @html
  done

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
  runuser -u deploy -- flock /srv/etendard/.lock sleep 5 >/dev/null 2>&1 &
  sleep 1
  check "verrou flock : 2e opération refusée pendant un déploiement" 'autre déploiement' \
    runuser -u deploy -- env SSH_ORIGINAL_COMMAND=rollback /usr/local/bin/etendard-receive
  wait
  # restore d'une version absente : prouve l'attente du verrou sans rien basculer.
  runuser -u deploy -- flock /srv/etendard/.lock sleep 3 >/dev/null 2>&1 &
  sleep 1
  check "restore attend la fin d'un déploiement en cours" 'version 0000000 absente' \
    runuser -u deploy -- env SSH_ORIGINAL_COMMAND="restore 0000000" /usr/local/bin/etendard-receive
  wait

  # Ticket #113 : chaque port, service ou dépôt du fichier local est désigné par son numéro, jamais par
  # sa valeur (sortie à coller dans un ticket, sans valeur du serveur).
  local i p
  title "Ticket #113 — services existants (fichier local)"
  for i in "${!PORTS[@]}"; do
    p="${PORTS[$i]}"
    # Le port lui-même, pas toute sortie : un message d'erreur de ss ne vaut pas un port servi.
    check "port n°$((i + 1)) toujours servi" ":${p%/*}[[:space:]]" ss -Hln --"${p#*/}" "( sport = :${p%/*} )"
  done

  title "Ticket #113, critère 4 — SSH par clé uniquement"
  check "configuration installée, identique à ce dossier" '^ok$' sh -c "cmp /etc/ssh/sshd_config.d/00-etendard.conf '$HERE/sshd-etendard.conf' && echo ok"
  check "mots de passe refusés" '^passwordauthentication no$' sshd -T
  check "clavier interactif refusé" '^kbdinteractiveauthentication no$' sshd -T
  check "connexion root refusée" '^permitrootlogin no$' sshd -T

  title "Ticket #113, critère 5 — pare-feu d'entrée"
  check "service du pare-feu identique à ce dossier" '^ok$' sh -c "cmp /etc/systemd/system/etendard-pare-feu.service '$HERE/etendard-pare-feu.service' && echo ok"
  check "pare-feu chargé au démarrage" '^enabled$' systemctl is-enabled etendard-pare-feu
  check "pare-feu actif" '^active$' systemctl is-active etendard-pare-feu
  check "entrée refusée par défaut" 'hook input .*policy drop;' nft list chain inet etendard entree
  ! redirection_nat
  verdict $? "aucun port redirigé (NAT) avant la chaîne d'entrée, qui échapperait au pare-feu"
  # Ports de sshd et du fichier local : autorisés dans la chaîne.
  local ports=()
  mapfile -t ports < <(ports_ssh)
  [ "${#ports[@]}" -gt 0 ]
  verdict $? "port SSH lu dans sshd -T"
  for i in "${!ports[@]}"; do verifier_port "SSH n°$((i + 1))" "${ports[$i]}/tcp"; done
  for i in "${!PORTS[@]}"; do verifier_port "n°$((i + 1)) du fichier local" "${PORTS[$i]}"; done

  title "Ticket #113, critère 6 — mises à jour automatiques"
  check "unattended-upgrades installé" '^install ok installed$' dpkg-query -W -f='${Status}\n' unattended-upgrades
  check "lancées chaque jour" '"1";$' apt-config dump APT::Periodic::Unattended-Upgrade
  check "minuteries d'apt actives" '^active.active$' sh -c 'systemctl is-active apt-daily.timer apt-daily-upgrade.timer | paste -sd .'
  check "pas de redémarrage automatique" '"false";$' apt-config dump Unattended-Upgrade::Automatic-Reboot
  local motifs motif exclu maj_paquets etiquettes motifs_paquets=() en_vigueur=()
  motifs="$(apt-config dump Unattended-Upgrade::Origins-Pattern)"
  check "correctifs de sécurité du système" '[Ss]ecurity' echo "$motifs"
  maj_paquets=("$(paquet_noyau)" "${PAQUETS_MAJ_AUTO[@]}")
  etiquettes=("noyau en cours" "${PAQUETS_MAJ_AUTO[@]}")
  mapfile -t motifs_paquets < <(origines_maj "${maj_paquets[@]}")
  for i in "${!maj_paquets[@]}"; do
    motif="${motifs_paquets[$i]:-}"
    # Exclu par le fichier local : install.sh l'a écarté, le contrôle « dépôt exclu » ci-dessous le prouve.
    if [ -n "$motif" ] && motif_exclu "$motif" "${DEPOTS_EXCLUS[@]}"; then
      echo "  ⚠️ dépôt de ${etiquettes[$i]} exclu par le fichier local"
      continue
    fi
    [ -n "$motif" ] && grep -qF "\"$motif\";" <<<"$motifs"
    verdict $? "dépôt de ${etiquettes[$i]} inclus"
  done
  # Même règle qu'install.sh (motif_exclu), appliquée à chaque motif en vigueur.
  mapfile -t en_vigueur < <(grep -oE '"[^"]+"' <<<"$motifs" | tr -d '"')
  for i in "${!DEPOTS_EXCLUS[@]}"; do
    exclu=0
    for motif in "${en_vigueur[@]}"; do
      motif_exclu "$motif" "${DEPOTS_EXCLUS[$i]}" && exclu=1
    done
    verdict "$exclu" "dépôt exclu n°$((i + 1)) hors des mises à jour automatiques"
  done
  # Signalé sans échec : redémarrer est le choix de Flo (pas de redémarrage automatique).
  [ -e /run/reboot-required ] && echo "  ⚠️ redémarrage en attente, pour appliquer une mise à jour"

  title "Ticket #113, critère 7 — isolation des services exposés"
  local unit pid f
  for unit in "${!SERVICES_ISOLES[@]}"; do
    # ReadWritePaths= : exactement les dossiers de SERVICES_ISOLES (aucun pour le tunnel).
    for p in NoNewPrivileges=yes ProtectSystem=strict ProtectHome=yes PrivateDevices=yes "ReadWritePaths=${SERVICES_ISOLES[$unit]}\$" 'RestrictAddressFamilies=AF_'; do
      check "$unit : ${p%%=*}" "^$p" systemctl show -p "${p%%=*}" "$unit"
    done
    # Le processus en cours, pas seulement l'unité : prouve qu'il a redémarré avec son isolation.
    pid="$(systemctl show -p MainPID --value "$unit")"
    check "$unit : processus en cours isolé" '^NoNewPrivs:[[:space:]]+1$' grep NoNewPrivs "/proc/$pid/status"
    # Un binaire remplacé par une mise à jour sans relance reste en mémoire, marqué « (deleted) » ; sans
    # processus, rien à lire.
    check "$unit : processus sur le binaire installé (mise à jour appliquée)" '^/[^[:space:]]+$' readlink "/proc/$pid/exe"
  done

  title "Ticket #113, critère 8 — services désactivés"
  check "démarrage sans environnement graphique" '^multi-user\.target$' systemctl get-default
  for i in "${!SERVICES[@]}"; do
    check "service n°$((i + 1)) masqué" '^masked' systemctl is-enabled "${SERVICES[$i]}"
    refute "service n°$((i + 1)) arrêté" '^active' systemctl is-active "${SERVICES[$i]}"
  done

  # La règle du tunnel (domaine → serveur web local) est dans Cloudflare : verify.sh public la contrôle.
  title "Ticket #125 — Cloudflare Tunnel"
  controler_jeton
  verdict $? "jeton à root, lisible par root seul, sans la commande qui l'entoure"
  check "clé du dépôt de Cloudflare : empreinte attendue" "^$EMPREINTE_CLOUDFLARE\$" empreinte_cle "$CLE_CLOUDFLARE"
  [ "$(cat /etc/apt/sources.list.d/cloudflared.list)" = "$DEPOT_CLOUDFLARE" ]
  verdict $? "dépôt de Cloudflare signé par cette clé, et seulement par elle"
  check "cloudflared installé" '^cloudflared version ' cloudflared --version
  check "relance après une mise à jour qui remplace un binaire" '^ok$' \
    sh -c "apt-config dump DPkg::Post-Invoke | grep -qF -- \"\$1\" && echo ok" sh "$RELANCE_APRES_MAJ"
  check "service identique à ce dossier" '^ok$' sh -c "cmp /etc/systemd/system/etendard-tunnel.service '$HERE/etendard-tunnel.service' && echo ok"
  check "démarre au boot" '^enabled$' systemctl is-enabled etendard-tunnel
  check "actif" '^active$' systemctl is-active etendard-tunnel
  pid="$(systemctl show -p MainPID --value etendard-tunnel)"
  check "processus sous un utilisateur sans privilèges" '^Uid:([[:space:]]+[1-9][0-9]*){4}$' grep '^Uid:' "/proc/$pid/status"
  # Le jeton passe à grep par un descripteur (printf est interne à bash) : jamais dans une ligne de commande.
  # Seul le code 1 de grep (rien trouvé) vaut preuve : 2 dit qu'il n'a pas pu lire.
  local jeton
  jeton="$(lire_jeton)"
  [ -n "$jeton" ] && grep -qaFf <(printf '%s\n' "$jeton") "/proc/$pid/cmdline" "/proc/$pid/environ"
  [ $? -eq 1 ] && [ -n "$jeton" ]
  verdict $? "jeton absent de la ligne de commande (ps) et de l'environnement du service"
  # ss lit le processus de chaque port, filtré sur celui du tunnel (un autre cloudflared du Pi ne compte pas) :
  # la première ligne prouve qu'il le voit, la seconde qu'aucun autre port.
  check "métriques de cloudflared sur la boucle locale" '127\.0\.0\.1:[0-9]+ ' sh -c "ss -Hltnp | grep -F 'pid=$pid,'"
  refute "cloudflared n'écoute sur aucune autre interface" '.' \
    sh -c "ss -Hltnup | grep -F 'pid=$pid,' | grep -Ev '[[:space:]](127\.0\.0\.1|\[::1\]):[0-9]+[[:space:]]'"
}

# Site public, à travers Cloudflare (#125), depuis n'importe quel poste. Sortie sans le domaine : chemins
# seuls. « DETAIL=1 bash verify.sh public <domaine> » affiche aussi chaque commande et sa sortie.
mode_public() {
  local base="https://$1" url name i absent="/absente-verify-sh-$(date +%s)"
  show="${DETAIL:-0}"
  # Les erreurs de curl citent le domaine ou une adresse.
  [ "$show" = 1 ] || exec 2>/dev/null
  echo "verify.sh public — $(date -Is)"

  title "Ticket #125 — réponses du site"
  check "/ répond 200" '^HTTP/[0-9.]+ 200([[:space:]]|$)' curl -sSI "$base/"
  check "$absent répond 404" '^HTTP/[0-9.]+ 404([[:space:]]|$)' curl -sSI "$base$absent"
  # La page 404 du site est aussi servie sous son nom : une page d'erreur de Cloudflare en diffère. Une page
  # vide des deux côtés échoue plus bas (« charge ses scripts »).
  meme_corps() { cmp -s <(curl -s "$1") <(curl -s "$2") && echo ok; }
  check "corps de $absent identique à /+not-found.html" '^ok$' meme_corps "$base$absent" "$base/+not-found.html"

  title "Ticket #125 — en-têtes de sécurité identiques à ceux du Caddyfile"
  for url in / "$absent"; do
    for name in "${EN_TETES_SECURITE[@]}"; do
      check "$name sur $url, conforme au Caddyfile" '^conforme$' header "$base$url" "$name"
    done
  done

  title "Ticket #125 — aucun script ajouté par Cloudflare (la CSP le bloquerait)"
  # balises_script <url> : chaque balise <script …> ouvrante de la page, une par ligne ; hors_expo <url> :
  # celles qui ne chargent pas un fichier de /_expo/static/.
  balises_script() { curl -s "$1" | grep -oiE '<script[^>]*>'; }
  hors_expo() { balises_script "$1" | grep -viE '[[:space:]]src="/_expo/static/[^"]+"'; }
  for url in / "$absent"; do
    # La page lue a bien des scripts : sans cette preuve, une page vide passerait le contrôle suivant.
    check "$url charge ses scripts depuis /_expo/static/" '[[:space:]]src="/_expo/static/' balises_script "$base$url"
    refute "aucun <script> hors de /_expo/static/ dans $url" '.' hors_expo "$base$url"
  done

  title "Ticket #125 — version.txt jamais servi depuis le cache de Cloudflare"
  check "/version.txt répond 200" '^HTTP/[0-9.]+ 200([[:space:]]|$)' curl -sSI "$base/version.txt"
  check "Cache-Control sur /version.txt, conforme au Caddyfile" '^conforme$' header "$base/version.txt" Cache-Control /version.txt
  # Lu par GET, comme le test de fumée. Deux lectures : la première mettrait le fichier en cache, la seconde
  # l'y lirait.
  cache_cloudflare() { curl -sS -D - -o /dev/null "$1" | tr -d '\r' | grep -i '^cf-cache-status:' | sed 's/^[^:]*:/cf-cache-status:/'; }
  for i in 1 2; do
    refute "/version.txt hors du cache de Cloudflare (lecture $i)" '^cf-cache-status: (HIT|STALE|UPDATING|REVALIDATED)' \
      cache_cloudflare "$base/version.txt"
  done
}

mode_ssh() {
  local key="${KEY:-$HOME/.ssh/github-deploy}" host="${HOST:-}" flo="${FLO:-}"
  [ -n "$host" ] && [ -n "$flo" ] || { echo "variables HOST et FLO requises : HOST=<hote-du-pi> FLO=<login>@<ip-du-pi> bash verify.sh ssh" >&2; exit 2; }
  local lan="${LAN_IP:-${flo#*@}}"
  [ -f "$key" ] || { echo "clé privée introuvable : $key (variable KEY)" >&2; exit 1; }
  local ssh=(ssh -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
  d="$(mktemp -d)"; trap 'rm -rf "$d"' EXIT
  local a=e7e7e7a b=e7e7e7b served
  for v in $a $b; do
    mkdir -p "$d/$v"; echo "$v" > "$d/$v/version.txt"
    printf '<!doctype html><meta charset="utf-8"><title>Étendard</title><h1>Page de test %s</h1>\n' "$v" > "$d/$v/index.html"
    tar -czf "$d/$v.tar.gz" -C "$d/$v" .
  done
  echo "Depuis : $(hostname) — $(date -Iseconds) — clé $(ssh-keygen -l -f "$key" | cut -d' ' -f2)"
  # Version servie au départ, rétablie à la fin (#135). Chaque envoi de test la remplace, elle : previous la désigne
  # donc jusqu'au bout (le ménage la garde) et, après le rollback final, un rollback manuel est refusé.
  served="$("${ssh[@]}" "deploy@$host" status </dev/null)"   # stdout seul : ssh peut avertir sur stderr
  [[ "$served" =~ ^[0-9a-f]{7,40}$ && "$served" != "$a" && "$served" != "$b" ]] \
    || { echo "aucune vraie version servie${served:+ ($served)} : déploie le site avant verify.sh ssh" >&2; exit 1; }
  echo "Version servie au départ : $served"

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

  title "Critère 5 — réception, status, rollback, restore"
  check "envoi de la version $a" "version $a" "${ssh[@]}" "deploy@$host" < "$d/$a.tar.gz"
  check "status = $a" "^$a\$" "${ssh[@]}" "deploy@$host" status </dev/null
  check "page $a servie sur le Pi" "Page de test $a" ssh "$flo" curl -s http://127.0.0.1:8080/
  check "rollback" "retour à la version $served" "${ssh[@]}" "deploy@$host" rollback </dev/null
  check "status = $served après rollback" "^$served\$" "${ssh[@]}" "deploy@$host" status </dev/null
  refute "page de test retirée" "Page de test" ssh "$flo" curl -s http://127.0.0.1:8080/
  check "envoi de la version $b" "version $b" "${ssh[@]}" "deploy@$host" < "$d/$b.tar.gz"
  check "status = $b" "^$b\$" "${ssh[@]}" "deploy@$host" status </dev/null
  check "page $b servie" "Page de test $b" ssh "$flo" curl -s http://127.0.0.1:8080/
  check "restore $a" "retour à la version $a" "${ssh[@]}" "deploy@$host" restore "$a" </dev/null
  check "restore $b" "retour à la version $b" "${ssh[@]}" "deploy@$host" restore "$b" </dev/null
  check "status = $b après restore" "^$b\$" "${ssh[@]}" "deploy@$host" status </dev/null

  title "Durcissement — deux déploiements simultanés"
  # Le 1er envoi renvoie $b, déjà servie : previous désigne toujours $served.
  ( sleep 5; cat "$d/$b.tar.gz" ) | "${ssh[@]}" "deploy@$host" > "$d/first.log" 2>&1 &
  sleep 2
  check "2e envoi refusé pendant le 1er" 'autre déploiement' "${ssh[@]}" "deploy@$host" < "$d/$a.tar.gz"
  wait
  check "le 1er envoi a abouti" "version $b" cat "$d/first.log"
  check "rollback final vers $served" "retour à la version $served" "${ssh[@]}" "deploy@$host" rollback </dev/null

  title "Ticket #135 — état laissé : la version du départ, servie et seule cible d'un rollback"
  check "status = $served" "^$served\$" "${ssh[@]}" "deploy@$host" status </dev/null
  refute "aucune page de test servie" "Page de test" ssh "$flo" curl -s http://127.0.0.1:8080/
  check "rollback manuel refusé" "aucun envoi à défaire" "${ssh[@]}" "deploy@$host" rollback </dev/null

  echo "Reste à faire à la main : ssh -L 8080:127.0.0.1:8080 $flo puis http://localhost:8080 → le site (version $served)."
}

# HSTS est posé par Cloudflare, pas par Caddy (FONCTIONNEMENT.md) : on le lit sur le domaine public.
mode_hsts() {
  local url status
  echo "Domaine : $1 — $(date -Iseconds)"

  title "Ticket #41 — Strict-Transport-Security, posé par Cloudflare"
  # Une page servie (200) et une 404 du site : l'en-tête doit être sur chaque réponse HTTPS. Le statut
  # écarte une page d'erreur de Cloudflare (Pi ou tunnel coupé), qui porterait aussi l'en-tête.
  # Valeur exacte, ni includeSubDomains ni preload, et un seul en-tête (le navigateur n'applique que
  # le premier) : sts joint les lignes servies par « | », un second en-tête fait donc échouer le motif.
  sts() { served "$1" Strict-Transport-Security | paste -sd '|' -; }
  for url in "https://$1/" "https://$1/absente-verify-sh-$(date +%s)"; do
    [[ "$url" == */ ]] && status=200 || status=404
    check "$url répond $status" "^HTTP/[0-9.]+ $status([[:space:]]|\$)" curl -sSI "$url"
    check "Strict-Transport-Security sur $url : max-age=31536000" \
      '^[Ss]trict-[Tt]ransport-[Ss]ecurity: max-age=31536000$' sts "$url"
  done
}

case "${1:-}" in
  pi) mode_pi ;;
  ssh) mode_ssh ;;
  # Un seul nom de domaine : ni schéma, ni chemin, ni port.
  hsts | public) [[ $# -eq 2 && "$2" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "usage : bash verify.sh $1 <domaine>" >&2; exit 2; }
    "mode_$1" "$2" ;;
  *) echo "usage : sudo bash verify.sh pi   |   HOST=<hote-du-pi> FLO=<login>@<ip-du-pi> bash verify.sh ssh   |   bash verify.sh hsts <domaine>   |   bash verify.sh public <domaine>" >&2; exit 2 ;;
esac

echo "Bilan : $pass ✅, $fail ❌"
[ "$fail" -eq 0 ]
