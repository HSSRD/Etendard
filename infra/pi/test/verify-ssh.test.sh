#!/bin/bash
# Test local de « verify.sh ssh » (#135) : il laisse servie la version qu'il a trouvée, et aucun rollback
# ni restore ne sert ensuite une de ses versions de test. Sans Pi : un faux ssh lance le vrai
# etendard-receive sur un dossier temporaire.
# Usage : bash infra/pi/test/verify-ssh.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export MSYS=winsymlinks:sys   # bash de Git : vrais liens symboliques au lieu de copies
export ETENDARD_ROOT="$WORK/srv"
export RECEIVE="$HERE/../etendard-receive"
mkdir "$WORK/bin"

# Faux ssh : la clé de déploiement (deploy@…) passe par la commande forcée, comme avec authorized_keys
# (restrict : ni terminal, ni redirection) ; le compte de Flo ne sert qu'à lire la page servie.
cat > "$WORK/bin/ssh" <<'SH'
#!/bin/bash
tt= w=
while [ $# -gt 0 ]; do
  case "$1" in
    -i | -o) shift 2 ;;
    -tt) tt=1; shift ;;
    -W) w=1; shift 2 ;;
    *) break ;;
  esac
done
dest="$1"; shift
case "$dest" in
  deploy@*)
    [ -n "$w" ] && { echo "channel 0: open failed: administratively prohibited" >&2; exit 1; }
    # PTY refusé : sshd ne relaie pas l'erreur de la commande forcée (voir verify.sh).
    [ -n "$tt" ] && { echo "PTY allocation request failed on channel 0" >&2; exec 2>/dev/null; }
    SSH_ORIGINAL_COMMAND="$*" exec "$RECEIVE" ;;
  *) cat "$ETENDARD_ROOT/current/index.html" ;;
esac
SH
printf '#!/bin/sh\necho "Connection closed" >&2; exit 1\n' > "$WORK/bin/sftp"
printf '#!/bin/sh\necho "curl: (7) Failed to connect" >&2; exit 7\n' > "$WORK/bin/curl"
printf '#!/bin/sh\necho "256 SHA256:empreinte-temoin cle (ED25519)"\n' > "$WORK/bin/ssh-keygen"
# Le bash de Git n'a pas flock : ce substitut tient le verrou tant que le processus qui l'a pris
# (etendard-receive, son parent) vit. Sous Linux, le vrai flock est utilisé.
if ! command -v flock >/dev/null; then
  cat > "$WORK/bin/flock" <<'SH'
#!/bin/bash
lock="$ETENDARD_ROOT/.lock.d" left=0
[ "$1" = -w ] && left="$2"
until mkdir "$lock" 2>/dev/null; do
  kill -0 "$(cat "$lock/pid" 2>/dev/null)" 2>/dev/null || { rm -rf "$lock"; continue; }
  [ "$left" -gt 0 ] || exit 1
  sleep 1; left=$((left - 1))
done
echo "$PPID" > "$lock/pid"
SH
  echo "note - flock simulé (bash de Git) ; le vrai verrou est testé par la CI (Linux)"
fi
chmod +x "$WORK/bin/"*
touch "$WORK/cle"
export PATH="$WORK/bin:$PATH"

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

# run <commande SSH> [archive] : etendard-receive, stdout+stderr dans $out.
run() { out="$(SSH_ORIGINAL_COMMAND="$1" "$RECEIVE" < "${2:-/dev/null}" 2>&1)"; }
# site <sha> : archive d'une vraie version.
site() {
  mkdir -p "$WORK/src-$1"
  echo "$1" > "$WORK/src-$1/version.txt"
  echo "<h1>Site $1</h1>" > "$WORK/src-$1/index.html"
  tar -czf "$WORK/$1.tar.gz" -C "$WORK/src-$1" .
}
verify_ssh() {
  out="$(KEY="$WORK/cle" HOST=pi-temoin FLO=flo@pi-temoin bash "$HERE/../verify.sh" ssh 2>&1)"
}
reset() { rm -rf "$ETENDARD_ROOT"; mkdir -p "$ETENDARD_ROOT/releases"; }

# Deux vraies versions : 2222222 servie, 1111111 en cible du rollback.
site 1111111; site 2222222; site 3333333
reset; run "" "$WORK/1111111.tar.gz"; run "" "$WORK/2222222.tar.gz"

verify_ssh && grep -q 'Bilan : [0-9]* ✅, 0 ❌' <<<"$out" \
  && ok "verify.sh ssh sans échec" || ko "verify.sh ssh : $(grep -E '❌|Bilan|déploie' <<<"$out")"
grep -q 'aucune page de test servie' <<<"$out" && ok "verify.sh ssh contrôle l'état laissé" || ko "contrôle de l'état laissé absent"
cp -a "$ETENDARD_ROOT" "$WORK/apres-verify"

# servie <description> : la version du départ, 2222222, est servie.
servie() { run status; [ "$out" = 2222222 ] && ok "$1" || ko "$1 : status = $out"; }

# Critère 1 : la version du départ est servie.
servie "critère 1 : 2222222 servie"
grep -q 'Site 2222222' "$ETENDARD_ROOT/current/index.html" && ok "critère 1 : sa page est servie" || ko "critère 1 : page servie"

# Critère 3 : un rollback manuel, avant tout déploiement, ne sert pas une version de test.
run rollback; grep -q 'aucun envoi à défaire' <<<"$out" && ok "critère 3 : rollback refusé ($out)" || ko "critère 3 : rollback : $out"
servie "critère 3 : 2222222 toujours servie"

# Critère 2 : le déploiement suivant défait, par rollback manuel ou par restore (deploy.yml).
run "" "$WORK/3333333.tar.gz"; run rollback
servie "critère 2 : rollback du déploiement suivant → 2222222"
rm -rf "$ETENDARD_ROOT"; cp -a "$WORK/apres-verify" "$ETENDARD_ROOT"
run "" "$WORK/3333333.tar.gz"; run "restore 2222222"
servie "critère 2 : restore du déploiement suivant → 2222222"

# Précondition : sans vraie version servie, rien n'est envoyé.
for etat in vide test; do
  reset
  [ "$etat" = test ] && { mkdir "$ETENDARD_ROOT/releases/e7e7e7a"; ln -s releases/e7e7e7a "$ETENDARD_ROOT/current"; }
  avant="$(ls "$ETENDARD_ROOT/releases")"
  if verify_ssh; then
    ko "serveur $etat : verify.sh ssh accepté"
  elif grep -q 'déploie le site avant verify.sh ssh' <<<"$out" && [ "$(ls "$ETENDARD_ROOT/releases")" = "$avant" ]; then
    ok "serveur $etat : refusé sans rien envoyer"
  else
    ko "serveur $etat : $out"
  fi
done

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
