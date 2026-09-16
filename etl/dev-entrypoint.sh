##!/bin/sh
#set -e
#
#echo "[dev-entrypoint] ensure tools"
#  apt-get update -y >/dev/null 2>&1 || true
#apt-get install -y inotify-tools >/dev/null 2>&1 || true
#
#SRC_DIR="/app/src/main"
## Regarde toutes les 2 secondes s'il y a un changement si on n'arrive pas à surveiller avec inofy.
## (docker desktop pb => windows ne propage pas les événements du système.)
#POLL_INTERVAL="2"
#
#
#watch_inotify() {
#  echo "[watch] using inotify on $SRC_DIR"
#  inotifywait -m -r -e close_write,move,create,delete "$SRC_DIR" 2>/dev/null \
#  | while read _; do
#      echo "[watch] change detected -> mvn compile"
#      mvn -q -o -DskipTests compile || true
#    done
#}
#
#watch_polling() {
#  echo "[watch] using polling every ${POLL_INTERVAL}s on $SRC_DIR"
#  LAST=""
#  while sleep "$POLL_INTERVAL"; do
#    CUR="$(find "$SRC_DIR" -type f -print0 2>/dev/null \
#          | xargs -0 stat -c '%n:%Y' 2>/dev/null \
#          | md5sum | cut -d' ' -f1)"
#    if [ "$CUR" != "$LAST" ]; then
#      LAST="$CUR"
#      echo "[watch] change detected (poll) -> mvn compile"
#      mvn -q -o -DskipTests compile || true
#    fi
#  done
#}
#
## tue les jobs en arrière-plan à l’arrêt
#trap 'kill $(jobs -p) 2>/dev/null || true' EXIT
#
## lance inotify en arrière-plan; si aucun event au bout de 3s, bascule en polling
#( watch_inotify ) &
#W_PID=$!
#
#sleep 3
## si Windows/Docker Desktop ne propage pas les events, inotify reste silencieux :
## on garde inotify en fond (au cas où) et on démarre aussi le polling
#( watch_polling ) &
#
#echo "[dev-entrypoint] starting spring-boot:run"
#exec mvn -q spring-boot:run -Dspring-boot.run.profiles=dev
