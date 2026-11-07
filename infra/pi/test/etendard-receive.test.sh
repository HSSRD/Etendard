#!/bin/bash
# Tests locaux de etendard-receive (Linux ou bash de Git pour Windows).
# Usage : bash infra/pi/test/etendard-receive.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../etendard-receive"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export MSYS=winsymlinks:sys   # bash de Git : vrais liens symboliques au lieu de copies
export ETENDARD_ROOT="$WORK/srv"

# hold_lock / release_lock : un autre déploiement tient le verrou.
# Le bash de Git n'a pas flock : un substitut simule alors un verrou pris tant
# qu'un fichier témoin existe. Sous Linux, le vrai flock est utilisé.
if command -v flock >/dev/null; then
  hold_lock() { flock "$ETENDARD_ROOT/.lock" sleep 2 & sleep 0.5; }
  release_lock() { wait; }
else
  mkdir "$WORK/bin"
  printf '#!/bin/sh\n[ ! -e "$ETENDARD_ROOT/.lock.held" ]\n' > "$WORK/bin/flock"
  chmod +x "$WORK/bin/flock"
  export PATH="$WORK/bin:$PATH"
  hold_lock() { touch "$ETENDARD_ROOT/.lock.held"; }
  release_lock() { rm -f "$ETENDARD_ROOT/.lock.held"; }
  echo "note - flock simulé (bash de Git) ; le vrai verrou est testé sur le Pi par verify.sh"
fi

pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
ko() { fail=$((fail + 1)); echo "FAIL - $1"; }

reset() { rm -rf "$ETENDARD_ROOT"; mkdir -p "$ETENDARD_ROOT/releases"; }

# run <commande SSH> [archive] : exécute le script, stdout+stderr dans $out.
run() {
  local input="${2:-/dev/null}"
  out="$(SSH_ORIGINAL_COMMAND="$1" "$SCRIPT" < "$input" 2>&1)"
}

# site <nom> <sha> : archive saine comme celle de la CI (tar -C dist .).
site() {
  local dir="$WORK/src-$1"
  mkdir -p "$dir/_astro"
  echo "$2" > "$dir/version.txt"
  echo "<h1>page $2</h1>" > "$dir/index.html"
  echo "x" > "$dir/_astro/a.js"
  tar -czf "$WORK/$1.tar.gz" -C "$dir" .
}

expect_refused() { # <description> <archive> <motif du message>
  local before; before="$(readlink "$ETENDARD_ROOT/current" 2>/dev/null)"
  if run "" "$2"; then ko "$1 : acceptée"; return; fi
  grep -q "$3" <<<"$out" || { ko "$1 : message inattendu ($out)"; return; }
  [ "$(readlink "$ETENDARD_ROOT/current" 2>/dev/null)" = "$before" ] || { ko "$1 : current modifié"; return; }
  [ -z "$(find "$ETENDARD_ROOT/releases" -mindepth 1 -name '.incoming*')" ] || { ko "$1 : dossier temporaire laissé"; return; }
  ok "$1"
}

# --- Réception, status, rollback -------------------------------------------
reset
run status && ko "status sans version" || ok "status sans version : erreur ($out)"
run rollback && ko "rollback sans version" || ok "rollback sans version : erreur"

site v1 aaaaaaa; site v2 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
run "" "$WORK/v1.tar.gz" && ok "réception v1 ($out)" || ko "réception v1 : $out"
[ -L "$ETENDARD_ROOT/current" ] && [ "$(readlink "$ETENDARD_ROOT/current")" = releases/aaaaaaa ] \
  && ok "current est un lien vers releases/aaaaaaa" || ko "lien current"
grep -q 'page aaaaaaa' "$ETENDARD_ROOT/current/index.html" && ok "index.html servi" || ko "index.html"
[ -f "$ETENDARD_ROOT/current/_astro/a.js" ] && ok "sous-dossiers extraits" || ko "sous-dossiers"

sleep 1; run "" "$WORK/v2.tar.gz" && ok "réception v2 (SHA de 40 caractères)" || ko "réception v2 : $out"
run status; [ "$out" = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ] && ok "status = v2" || ko "status : $out"
run rollback && ok "rollback ($out)" || ko "rollback : $out"
run status; [ "$out" = aaaaaaa ] && ok "status = v1 après rollback" || ko "status après rollback : $out"
run rollback && ko "rollback au-delà de la plus ancienne" || ok "rollback au-delà de la plus ancienne : erreur"

sleep 1; run "" "$WORK/v2.tar.gz" && grep -q 'déjà présente' <<<"$out" \
  && ok "renvoi d'une version existante : réactivée" || ko "renvoi v2 : $out"
run status; [ "$out" = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ] && ok "status = v2" || ko "status : $out"

# --- Conservation des 5 dernières versions ---------------------------------
reset
for i in 1 2 3 4 5 6 7; do
  site "k$i" "$i$i$i$i$i$i$i"
  run "" "$WORK/k$i.tar.gz" || ko "réception k$i : $out"
  sleep 1
done
kept="$(ls "$ETENDARD_ROOT/releases" | sort | tr '\n' ' ')"
[ "$kept" = "3333333 4444444 5555555 6666666 7777777 " ] && ok "5 dernières versions gardées" || ko "versions gardées : $kept"
run rollback; run rollback; run status
[ "$out" = 5555555 ] && ok "deux rollbacks : 5555555" || ko "deux rollbacks : $out"

# --- Commandes refusées ------------------------------------------------------
for cmd in "id" "bash" "status; id" "rollback x" "sh -c status" "scp -t /tmp" "internal-sftp"; do
  run "$cmd" && ko "commande « $cmd » acceptée" || { grep -q 'commande refusée' <<<"$out" && ok "commande « $cmd » refusée" || ko "« $cmd » : $out"; }
done

# --- Archives piégées --------------------------------------------------------
reset; run "" "$WORK/v1.tar.gz"

expect_refused "entrée vide" /dev/null "archive vide"
printf 'pas une archive' > "$WORK/bad.tar.gz"
expect_refused "fichier non gzip" "$WORK/bad.tar.gz" "illisible"

mkdir -p "$WORK/p1"; echo 1234567 > "$WORK/p1/version.txt"; echo x > "$WORK/p1/f"
tar -czf "$WORK/abs.tar.gz" -P -C "$WORK/p1" version.txt "$WORK/p1/f"
expect_refused "chemin absolu" "$WORK/abs.tar.gz" "chemin absolu"

tar -czf "$WORK/dotdot.tar.gz" -P -C "$WORK/p1" version.txt ../p1/f
expect_refused "chemin avec .." "$WORK/dotdot.tar.gz" "\.\."

mkdir -p "$WORK/p2"; echo 1234567 > "$WORK/p2/version.txt"; ln -s /etc/passwd "$WORK/p2/lien"
tar -czf "$WORK/symlink.tar.gz" -C "$WORK/p2" .
expect_refused "lien symbolique" "$WORK/symlink.tar.gz" "lien ou fichier spécial"

mkdir -p "$WORK/p3"; echo 1234567 > "$WORK/p3/version.txt"; echo x > "$WORK/p3/a"; ln "$WORK/p3/a" "$WORK/p3/b"
tar -czf "$WORK/hardlink.tar.gz" -C "$WORK/p3" .
expect_refused "lien physique" "$WORK/hardlink.tar.gz" "lien ou fichier spécial"

mkdir -p "$WORK/p4"; echo x > "$WORK/p4/index.html"
tar -czf "$WORK/nover.tar.gz" -C "$WORK/p4" .
expect_refused "version.txt absent" "$WORK/nover.tar.gz" "version.txt absent"

n=0
for bad in "ABCDEF1" "123456" "../../etc" "g123456" "$(printf 'a%.0s' {1..41})" "1234567 x"; do
  n=$((n + 1)); site "sha$n" "$bad"
  expect_refused "SHA invalide « $bad »" "$WORK/sha$n.tar.gz" "SHA invalide"
done

hold_lock
expect_refused "déploiement concurrent (verrou pris)" "$WORK/v2.tar.gz" "autre déploiement"
run rollback && ko "rollback avec verrou pris" || ok "rollback refusé avec verrou pris"
run status && ok "status fonctionne pendant un déploiement" || ko "status pendant un déploiement : $out"
release_lock

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
