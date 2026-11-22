# Fonctions partagées par install.sh, verify.sh et leurs tests (ticket #113, ADR 0017).
# Chargé par « source » : ne s'exécute pas seul.

# Valeurs propres au serveur, hors du repo (public) : format dans serveur.conf.exemple.
ETENDARD_CONF="${ETENDARD_CONF:-/etc/etendard/serveur.conf}"

# Logiciels exposés : mises à jour automatiques (avec le noyau en cours) et isolation systemd, appliquées
# par install.sh, contrôlées par verify.sh. Pour en ajouter un : son paquet dans PAQUETS_MAJ_AUTO, son unité
# et les dossiers où elle écrit dans SERVICES_ISOLES (le tunnel n'écrit nulle part, #125).
PAQUETS_MAJ_AUTO=(caddy tailscale cloudflared)
declare -A SERVICES_ISOLES=([caddy.service]="/var/lib/caddy /var/log/caddy" [cloudflared.service]="")
# Nécessaires à l'accès de Flo ou au déploiement, en plus des services isolés : jamais masqués.
SERVICES_PROTEGES=(ssh.service sshd.service ssh.socket tailscaled.service etendard-pare-feu.service)

# lire_conf : lit $ETENDARD_CONF dans PORTS (« port/proto »), SERVICES et DEPOTS_EXCLUS. Sur une erreur,
# écrit la raison sur stderr, sans la valeur fautive (seulement son numéro de ligne), et renvoie 1.
# Le fichier n'est jamais exécuté : seules les lignes « CLE=valeur » des trois clés sont acceptées.
lire_conf() {
  PORTS=() SERVICES=() DEPOTS_EXCLUS=()
  local f="$ETENDARD_CONF" line key value n=0 seen=' ' unite p
  if [ ! -f "$f" ]; then
    echo "fichier local $f absent : copie-y serveur.conf.exemple de ce dossier, puis remplis-le (README.md)" >&2
    return 1
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    n=$((n + 1))
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    if ! [[ "$line" =~ ^([A-Z_]+)=(.*)$ ]]; then
      echo "$f, ligne $n : attendu CLE=valeur" >&2; return 1
    fi
    key="${BASH_REMATCH[1]}" value="${BASH_REMATCH[2]}"
    case "$key" in
      PORT | SERVICE | DEPOT_EXCLU) seen+="$key " ;;
      *) echo "$f, ligne $n : clé inconnue (PORT, SERVICE ou DEPOT_EXCLU)" >&2; return 1 ;;
    esac
    [ -z "$value" ] && continue   # « CLE= » : aucune valeur pour cette clé
    case "$key" in
      PORT)
        if [[ "$value" =~ ^([0-9]{1,5})(/(tcp|udp))?$ ]] && ((10#${BASH_REMATCH[1]} >= 1 && 10#${BASH_REMATCH[1]} <= 65535)); then
          PORTS+=("$((10#${BASH_REMATCH[1]}))/${BASH_REMATCH[3]:-tcp}")
        else
          echo "$f, ligne $n : PORT attend un numéro de 1 à 65535, suivi au besoin de /tcp ou /udp" >&2; return 1
        fi ;;
      SERVICE)
        if ! [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9@._:-]*$ ]]; then
          echo "$f, ligne $n : SERVICE attend un nom d'unité systemd" >&2; return 1
        fi
        # Masquer l'un d'eux couperait l'accès de Flo, le déploiement ou le site (sans suffixe, systemd lit .service).
        unite="$value"
        [[ "$unite" == *.* ]] || unite+=.service
        for p in "${SERVICES_PROTEGES[@]}" "${!SERVICES_ISOLES[@]}"; do
          if [ "$unite" = "$p" ]; then
            echo "$f, ligne $n : ce service est nécessaire à l'accès ou au site, il ne peut pas être désactivé" >&2; return 1
          fi
        done
        SERVICES+=("$value") ;;
      DEPOT_EXCLU)
        # Ni guillemet, ni virgule, ni barre oblique inverse : la valeur entre dans un motif d'apt. Ni espace
        # au bout : le motif ne correspondrait à aucune origine, et le dépôt resterait mis à jour.
        if ! [[ "$value" =~ ^[A-Za-z0-9]([A-Za-z0-9\ ._/:+-]*[A-Za-z0-9._/:+-])?$ ]]; then
          echo "$f, ligne $n : DEPOT_EXCLU attend l'origine d'un dépôt (champ o= de « apt-cache policy »)" >&2; return 1
        fi
        DEPOTS_EXCLUS+=("$value") ;;
    esac
  done < "$f"
  for key in PORT SERVICE DEPOT_EXCLU; do
    if [[ "$seen" != *" $key "* ]]; then
      echo "$f : clé $key absente (écris « $key= » s'il n'y a aucune valeur)" >&2; return 1
    fi
  done
}

# Jeton du tunnel Cloudflare (#125), seul secret du tunnel, à côté du fichier local et comme lui hors du
# repo. cloudflared.service le reprend (LoadCredential=) : systemd le lit en root et le passe au service.
JETON_TUNNEL="${JETON_TUNNEL:-/etc/etendard/tunnel.jeton}"

# Clé de signature du dépôt apt de Cloudflare (cloudflare-public-v2.gpg, « CloudFlare Software Packaging
# 2025 »), relevée le 2026-11-22 sur https://pkg.cloudflare.com/ : install.sh refuse toute autre clé.
EMPREINTE_CLOUDFLARE=CC94B39C77AE7342A68B89628A682D308D4E5E73

# empreinte_cle <fichier> : empreinte de la clé principale du trousseau, vide s'il en contient plusieurs
# (une clé ajoutée signerait aussi des paquets acceptés par apt) ou aucune.
empreinte_cle() {
  gpg --show-keys --with-colons "$1" 2>/dev/null \
    | awk -F: '$1 == "pub" { n++; p = 1; next } p && $1 == "fpr" { f = $10; p = 0 } END { if (n == 1) print f }'
}

# controler_jeton : réussit si $JETON_TUNNEL est un fichier ordinaire à root, lisible par root seul, qui ne
# contient qu'un jeton. Sinon, écrit la raison sur stderr, jamais le contenu, et renvoie 1.
controler_jeton() {
  local f="$JETON_TUNNEL"
  if [ ! -e "$f" ]; then
    echo "jeton du tunnel absent ($f) : crée le tunnel dans Cloudflare, puis écris-y son jeton (README.md)" >&2
    return 1
  fi
  # Un lien ferait lire un autre fichier que celui dont les droits sont contrôlés ici.
  if [ -L "$f" ] || [ ! -f "$f" ]; then
    echo "$f n'est pas un fichier ordinaire" >&2; return 1
  fi
  if ! [[ "$(stat -c '%u %a' "$f")" =~ ^0\ [46]00$ ]]; then
    echo "$f doit appartenir à root et n'être lisible que par lui : sudo chown root:root $f && sudo chmod 600 $f" >&2
    return 1
  fi
  # Le tableau de bord affiche le jeton dans une commande (« cloudflared service install <jeton> ») : seul le
  # jeton doit être copié. Lu sans être affiché ; plusieurs lignes ne correspondent pas au motif.
  if ! [[ "$(lire_jeton)" =~ ^[A-Za-z0-9+/_=-]{20,}$ ]]; then
    echo "$f doit contenir le seul jeton du tunnel, sur une ligne, sans la commande qui l'entoure" >&2
    return 1
  fi
}

# lire_jeton : le jeton, sans lignes vides ni fin de ligne Windows, comme le lit cloudflared (qui retire les
# blancs autour). À garder dans une variable : jamais affiché, jamais dans une ligne de commande.
lire_jeton() {
  tr -d '\r' < "$JETON_TUNNEL" | grep .
}

# cle_admin_autorisee <compte> <dossier personnel> : réussit si sshd accepterait au moins une clé publique
# pour ce compte. Fichiers lus : AuthorizedKeysFile de « sshd -T » (%h, %u et %% développés, chemin relatif
# au dossier personnel), ou ceux par défaut d'OpenSSH si sshd ne répond pas.
cle_admin_autorisee() {
  local user="$1" home="$2" files f
  files="$(sshd -T -C "user=$user,host=localhost,addr=127.0.0.1" 2>/dev/null | awk '$1 == "authorizedkeysfile" { $1 = ""; print }')"
  read -ra files <<<"${files:-.ssh/authorized_keys .ssh/authorized_keys2}"
  for f in "${files[@]}"; do
    f="${f//"%h"/$home}" f="${f//"%u"/$user}" f="${f//"%%"/%}"
    [[ "$f" == /* ]] || f="$home/$f"
    [ -s "$f" ] && ssh-keygen -l -f "$f" >/dev/null 2>&1 && return 0
  done
  return 1
}

# origines_maj <paquet…> : pour chaque paquet, dans l'ordre, une ligne avec le motif
# Unattended-Upgrade::Origins-Pattern du dépôt qui fournit sa version candidate, vide si le paquet est
# inconnu ou ne vient d'aucun dépôt. Un seul cache apt pour tous (long à charger sur le Pi). Python et
# python3-apt viennent avec unattended-upgrades ; une virgule est échappée, un guillemet donne une ligne
# vide (apt.conf n'a pas d'échappement).
origines_maj() {
  python3 - "$@" <<'PY'
import apt, sys
cache = apt.Cache()
for name in sys.argv[1:]:
    pkg = cache[name] if name in cache else None
    origins = [o for o in (pkg.candidate.origins if pkg and pkg.candidate else []) if o.site]
    fields = [(k, v) for k, v in (("origin", origins[0].origin), ("codename", origins[0].codename),
              ("label", origins[0].label)) if v] if origins else []
    ok = fields and not any('"' in v for _, v in fields)
    print(",".join(k + "=" + v.replace(",", "\\,") for k, v in fields) if ok else "")
PY
}

# motif_exclu <motif> <dépôt…> : réussit si l'origine du motif (origin= ou o=) est l'un des dépôts.
motif_exclu() {
  local motif=",$1," d
  shift
  for d; do
    [[ "$motif" == *",origin=$d,"* || "$motif" == *",o=$d,"* ]] && return 0
  done
  return 1
}

# ports_ssh : ports TCP où écoute sshd, un par ligne.
ports_ssh() {
  sshd -T 2>/dev/null | awk '$1 == "port" { print $2 }'
}

# paquet_noyau : paquet qui a installé le noyau en cours (son dépôt fournit aussi le firmware). Garde
# « :arch » (noyau d'une autre architecture que le système) : sans lui, apt ne trouve pas le paquet.
paquet_noyau() {
  dpkg -S "/boot/vmlinuz-$(uname -r)" 2>/dev/null | sed 's/: .*//'
}

# redirection_nat : réussit si une règle de NAT redirige un port avant la chaîne d'entrée (port publié
# d'un conteneur, par exemple) : ce trafic échapperait au pare-feu, quel que soit le port. Chaque outil
# est lu : une règle posée par iptables ne se voit pas avec nft si son paquet n'est pas installé. Les
# outils « legacy » seulement si leur table existe : les lancer la créerait (vérification en lecture seule).
redirection_nat() {
  local regles
  # Sortie capturée avant grep : dans un tube sous pipefail, un outil absent ou coupé par « grep -q »
  # ferait échouer le tube même quand grep trouve.
  regles="$({
    nft list ruleset
    iptables-nft-save -t nat
    ip6tables-nft-save -t nat
    if grep -qx nat /proc/net/ip_tables_names; then iptables-legacy-save -t nat; fi
    if grep -qx nat /proc/net/ip6_tables_names; then ip6tables-legacy-save -t nat; fi
  } 2>/dev/null)"
  grep -Eiq '(^|[^a-z])dnat([^a-z]|$)' <<<"$regles"
}
