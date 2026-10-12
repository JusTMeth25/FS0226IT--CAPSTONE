#!/usr/bin/env bash
# Carica un dump (pg_dump -Fc) nel database di produzione, sostituendo quello che c'e'.
# Uso:  bash deploy/scripts/restore.sh deploy/backups/locale.dump
# Il backend si ferma durante il caricamento e riparte alla fine.
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP="${1:?Uso: restore.sh <file .dump>}"
DUMP="$(realpath "$DUMP")"
case "$DUMP" in
  "$(pwd)"/backups/*) ;;
  *) echo "Il dump deve stare in deploy/backups (la cartella che vede il container)." >&2; exit 1 ;;
esac
read -r -p "Sostituisco il database di produzione con $(basename "$DUMP")? Scrivi si: " ok
[ "$ok" = "si" ] || { echo "Annullato."; exit 1; }

docker compose stop backend
docker compose exec -T db psql -U vinyldex -d postgres -c "DROP DATABASE IF EXISTS vinyldex WITH (FORCE);"
docker compose exec -T db psql -U vinyldex -d postgres -c "CREATE DATABASE vinyldex OWNER vinyldex;"
# --no-owner: nel database locale le tabelle sono di "postgres", qui di "vinyldex".
docker compose exec -T db pg_restore -U vinyldex -d vinyldex --no-owner --no-privileges "/backups/$(basename "$DUMP")"
docker compose start backend
echo "Database caricato. Log del backend:  docker compose logs -f backend"
