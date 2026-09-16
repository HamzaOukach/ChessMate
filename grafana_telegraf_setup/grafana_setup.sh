#!/bin/sh

GRAFANA_URL=${GF_URL}
DATASOURCE_NAME=${TELEGRAF_DB}
DATASOURCE_URL=${POSTGRES_URL}
DATASOURCE_USER=${TELEGRAF_USER}
DATASOURCE_PASSWORD=${TELEGRAF_PASSWORD}
DATASOURCE_DB=${TELEGRAF_DB}
POSTGRES_HOST=$(echo "$POSTGRES_URL" | cut -d: -f1)
POSTGRES_PORT=$(echo "$POSTGRES_URL" | cut -d: -f2)
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-chessmate}
DASHBOARD_FILE="/system_metrics_dashboard.json"
# Exporter PGPASSWORD pour psql
export PGPASSWORD="$POSTGRES_PASSWORD"


create_database_and_user() {
  echo "Creating database and setting up permissions..."

  # Créer l'utilisateur si n'existe pas
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c \
    "CREATE USER $TELEGRAF_USER WITH PASSWORD '$TELEGRAF_PASSWORD';" 2>/dev/null || echo "User $TELEGRAF_USER already exists."

  # Créer la base de données
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c \
    "CREATE DATABASE $TELEGRAF_DB OWNER $TELEGRAF_USER;" 2>/dev/null || echo "Database $TELEGRAF_DB already exists."

  # Accorder les privilèges
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c \
    "GRANT CONNECT ON DATABASE $TELEGRAF_DB TO $TELEGRAF_USER;
     GRANT ALL PRIVILEGES ON DATABASE $TELEGRAF_DB TO $TELEGRAF_USER;
     ALTER DATABASE $TELEGRAF_DB OWNER TO $TELEGRAF_USER;"

  # Accorder les privilèges sur le schéma public (important pour que Telegraf puisse créer des tables)
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TELEGRAF_DB" -c \
    "GRANT ALL PRIVILEGES ON SCHEMA public TO $TELEGRAF_USER;
     GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $TELEGRAF_USER;
     GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $TELEGRAF_USER;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO $TELEGRAF_USER;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO $TELEGRAF_USER;"

  echo "Database and user setup complete."
}

wait_for_grafana() {
  echo "Waiting for Grafana to be ready..."
  while ! curl -s "http://grafana:3000/api/health" | grep '"database": "ok"' > /dev/null; do
    echo "Waiting for Grafana to start..."
    sleep 5
  done
  echo "Grafana is up!"
}

set_active_org() {
  echo "Setting active organization to Org ID: $GF_MAIN_ORG_ID"
  curl -s -X POST "$GRAFANA_URL/api/user/using/$GF_MAIN_ORG_ID" \
    -H "Content-Type: application/json" \
    -d '{}' > /dev/null
  echo "Organization set to $GF_MAIN_ORG_ID"
}

create_datasource_if_not_exists() {
  echo "Checking if datasource exists..."
  if curl -s "$GRAFANA_URL/api/datasources/name/$DATASOURCE_NAME" | grep '"message":"Data source not found"' > /dev/null; then
    echo "Datasource not found. Creating datasource..."
    curl -s -X POST "$GRAFANA_URL/api/datasources" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "'"${DATASOURCE_NAME}"'",
        "type": "postgres",
        "access": "proxy",
        "url": "'"${DATASOURCE_URL}"'",
        "user": "'"${DATASOURCE_USER}"'",
        "secureJsonData": {
          "password": "'"${DATASOURCE_PASSWORD}"'"
        },
        "jsonData": {
            "sslmode": "disable",
            "timescaledb": false
        },
        "database": "'"${DATASOURCE_DB}"'",
        "basicAuth": false,
        "isDefault": true,
        "withCredentials": false
      }' > /dev/null
    echo "Datasource created successfully."

    # Récupère l'UID du datasource nouvellement créé
    DATASOURCE_UID=$(curl -s "$GRAFANA_URL/api/datasources/name/$DATASOURCE_NAME" | grep -o '"uid":"[^"]*"' | sed 's/"uid":"\([^"]*\)"/\1/')
    echo "Datasource UID: $DATASOURCE_UID"

  else
    echo "Datasource already exists."

    # Récupère l'UID du datasource existant
    DATASOURCE_UID=$(curl -s "$GRAFANA_URL/api/datasources/name/$DATASOURCE_NAME" | grep -o '"uid":"[^"]*"' | sed 's/"uid":"\([^"]*\)"/\1/')
    echo "Datasource UID: $DATASOURCE_UID"
  fi

  export DS_TELEGRAF="$DATASOURCE_UID"
}

import_dashboard() {
  if [ -f "$DASHBOARD_FILE" ]; then
    sed 's/\${DS_TELEGRAF}/'"$DS_TELEGRAF"'/g' "$DASHBOARD_FILE" > /tmp$DASHBOARD_FILE

    echo "Importing dashboard..."
    curl -s -X POST "$GRAFANA_URL/api/dashboards/db" \
      -H "Content-Type: application/json" \
      --data-binary @/tmp$DASHBOARD_FILE > /dev/null

    echo "Dashboard imported successfully."
  else
    echo "Warning: Dashboard file not found at $DASHBOARD_FILE"
  fi
}

create_folder() {
  FOLDER_UID=$(curl -s "$GRAFANA_URL/api/search?query=System%20Alerts&type=dash-folder" \
    | grep -o '"uid":"[^"]*' | grep -o '[^"]*$')

  if [ -z "$FOLDER_UID" ]; then
    echo "Folder does not exist. Creating folder..."
    FOLDER_UID=$(curl -s -X POST "$GRAFANA_URL/api/folders" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "System Alerts"
      }' | grep -o '"uid":"[^"]*"' | sed 's/"uid":"\([^"]*\)"/\1/')
    echo "Folder created with UID: $FOLDER_UID"
    export FOLDER_UID="$FOLDER_UID"

  else
    echo "Folder already exists with UID: $FOLDER_UID"
    export FOLDER_UID="$FOLDER_UID"
  fi
}

# Exécuter les fonctions dans le bon ordre
create_database_and_user
wait_for_grafana
set_active_org
create_datasource_if_not_exists
import_dashboard
#create_folder
#set_alerts