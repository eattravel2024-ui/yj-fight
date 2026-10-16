#!/usr/bin/env bash
# Official postgres image invokes this only when its data directory is empty.
# The application owns its database, but is never a PostgreSQL cluster superuser.
set -Eeuo pipefail
: "${AZHI_DB_PASSWORD:?missing game database password}"
psql --username "$POSTGRES_USER" --dbname postgres --set=ON_ERROR_STOP=1 \
  --set=game_password="$AZHI_DB_PASSWORD" <<'SQL'
CREATE ROLE azhi_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'game_password';
CREATE DATABASE azhi OWNER azhi_app;
REVOKE ALL ON DATABASE azhi FROM PUBLIC;
GRANT CONNECT ON DATABASE azhi TO azhi_app;
SQL
