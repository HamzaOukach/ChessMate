#!/bin/sh

# Exécute en root : ajuste le groupe dynamiquement
if [ -e /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  groupadd -g $DOCKER_GID docker || true
  usermod -aG docker telegraf
fi

# Ajoute les droits de lecture sur le fichier config (en root)
if [ -e /telegraf_conf ]; then
  chmod 644 /telegraf_conf
else
  echo "Fichier config introuvable !"
fi

ls -l /telegraf_conf || echo "Fichier config introuvable !"

# Switch à telegraf SANS '-', pour garder l'env, et lance l'original
exec su telegraf -s /bin/sh -c "exec /entrypoint.sh \"\$@\"" -- "$@"