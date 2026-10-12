#!/usr/bin/env bash
# Aggiorna il sito all'ultima versione su GitHub: backup, pull, rebuild. Le migrazioni Flyway
# nuove partono da sole all'avvio del backend.  Uso:  bash deploy/scripts/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/backup.sh
git -C .. pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
