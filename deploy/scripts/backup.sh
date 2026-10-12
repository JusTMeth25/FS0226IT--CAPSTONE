#!/usr/bin/env bash
# Copia del database di produzione in deploy/backups (formato custom di pg_dump), si tengono le
# ultime 14. Lo lancia cron ogni notte (setup-server.sh); a mano:  bash deploy/scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/vinyldex-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T db pg_dump -U vinyldex -d vinyldex -Fc > "$FILE"
echo "$(date '+%F %T') backup $FILE ($(du -h "$FILE" | cut -f1))"
ls -1t backups/vinyldex-*.dump | tail -n +15 | xargs -r rm --
