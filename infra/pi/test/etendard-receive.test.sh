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

# hold_lock <s> : un autre déploiement tient le verrou pendant <s> secondes ;
# `wait` attend qu'il le rende.
# Le bash de Git n'a pas flock : un substitut simule alors un verrou pris tant
# qu'un fichier témoin existe (et l'attend avec -w). Sous Linux, le vrai flock est utilisé.
if command -v flock >/dev/null; then
  real_flock=1
  hold_lock() { flock "$ETENDARD_ROOT/.lock" sleep "$1" & sleep 0.5; }
else
  real_flock=
  mkdir "$WORK/bin"
  cat > "$WORK/bin/flock" <<'SH'
#!/bin/sh
left=0; [ "$1" = -w ] && left="$2"
while [ -e "$ETENDARD_ROOT/.lock.held" ]; do
  [ "$left" -gt 0 ] || exit 1
  sleep 1; left=$((left - 1))
done
SH
  chmod +x "$WORK/bin/flock"
  export PATH="$WORK/bin:$PATH"
  hold_lock() { touch "$ETENDARD_ROOT/.lock.held"; (sleep "$1"; rm -f "$ETENDARD_ROOT/.lock.held") & }
  echo "note - flock simulé (bash de Git) ; le vrai verrou est testé par la CI (Linux) et sur le Pi par verify.sh"
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

expect_refused() { # <description> <archive> <motif du message> [commande SSH]
  local before; before="$(readlink "$ETENDARD_ROOT/current" 2>/dev/null)"
  if run "${4:-}" "$2"; then ko "$1 : acceptée"; return; fi
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
run rollback; run rollback   # 3333333 servie, la plus ancienne gardée
site k8 8888888; run "" "$WORK/k8.tar.gz"
[ -d "$ETENDARD_ROOT/releases/3333333" ] && ok "ménage : la version remplacée est gardée, même ancienne" \
  || ko "ménage : version remplacée supprimée ($(ls "$ETENDARD_ROOT/releases" | tr '\n' ' '))"
run "restore 3333333"; run status
[ "$out" = 3333333 ] && ok "restore de la version remplacée" || ko "restore de la version remplacée : $out"

# --- Commandes refusées ------------------------------------------------------
for cmd in "id" "bash" "status; id" "rollback x" "restore" "restore;id" "sh -c status" "scp -t /tmp" "internal-sftp"; do
  expect_refused "refus de la commande « $cmd »" /dev/null "commande refusée" "$cmd"
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
expect_refused "chemin avec .." "$WORK/dotdot.tar.gz" "chemin contenant"

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

run "" "$WORK/v2.tar.gz"   # deux versions : seul le verrou peut empêcher le rollback
hold_lock 2
expect_refused "déploiement concurrent (verrou pris)" "$WORK/v1.tar.gz" "autre déploiement"
expect_refused "refus du rollback avec verrou pris" /dev/null "autre déploiement" rollback
run status && ok "status fonctionne pendant un déploiement" || ko "status pendant un déploiement : $out"
wait

# --- restore <sha> : rollback automatique de deploy.yml --------------------
# Après un rollback manuel, A est servie et B est plus récente : l'échec du
# déploiement de C doit ramener A, la version d'avant l'envoi, et non B.
reset
site v3 ccccccc
run "" "$WORK/v1.tar.gz"; sleep 1; run "" "$WORK/v2.tar.gz"; run rollback
sleep 1; run "" "$WORK/v3.tar.gz"
run "restore aaaaaaa" && grep -q 'retour à la version aaaaaaa (depuis ccccccc)' <<<"$out" \
  && ok "restore ($out)" || ko "restore : $out"
run status; [ "$out" = aaaaaaa ] && ok "status = version d'avant l'envoi, pas la plus récente" || ko "status après restore : $out"
run "restore aaaaaaa" && grep -q 'déjà servie' <<<"$out" \
  && ok "restore de la version servie : rien ne change" || ko "restore de la version servie : $out"
expect_refused "restore d'une version absente" /dev/null "version ddddddd absente" "restore ddddddd"
for bad in "ABCDEF1" "../../etc" "aaaaaaa x" ""; do
  expect_refused "restore, SHA invalide « $bad »" /dev/null "SHA invalide" "restore $bad"
done

# Un receive tient le verrou : restore l'attend au lieu d'échouer.
hold_lock 2
start=$SECONDS
run "restore ccccccc" && grep -q 'retour à la version ccccccc' <<<"$out" && [ $((SECONDS - start)) -ge 1 ] \
  && ok "restore attend la fin du verrou ($((SECONDS - start)) s)" || ko "restore avec verrou pris : $out"
wait
export ETENDARD_LOCK_WAIT=1
hold_lock 2
expect_refused "restore, verrou toujours pris au bout du délai" /dev/null "autre déploiement" "restore aaaaaaa"
wait
unset ETENDARD_LOCK_WAIT

# Annulation pendant l'envoi : le receive bascule après le début du rollback,
# qui l'attend puis rétablit la version d'avant l'envoi.
if [ -n "$real_flock" ]; then
  run "restore aaaaaaa"
  ( sleep 2; cat "$WORK/v2.tar.gz" ) | SSH_ORIGINAL_COMMAND="" "$SCRIPT" > "$WORK/receive.log" 2>&1 &
  sleep 0.5
  run "restore aaaaaaa" && grep -q "retour à la version aaaaaaa (depuis bbbb" <<<"$out" \
    && ok "restore pendant un receive : attend sa bascule puis la défait" || ko "restore pendant un receive : $out"
  wait
  grep -q 'publiée\|réactivée' "$WORK/receive.log" && ok "le receive concurrent a abouti" || ko "receive concurrent : $(cat "$WORK/receive.log")"
  run status; [ "$out" = aaaaaaa ] && ok "status = version d'avant l'envoi" || ko "status : $out"
else
  echo "note - restore pendant un vrai receive : testé avec le vrai flock seulement (CI Linux)"
fi

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
