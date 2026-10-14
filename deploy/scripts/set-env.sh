#!/usr/bin/env bash
# Imposta una variabile di deploy/.env leggendo il valore da stdin (cosi' non finisce nella riga di
# comando ne' nella cronologia) e riavvia il backend. Dal PC, in PowerShell:
#   $p | ssh -i C:\Users\<utente>\.ssh\vinyldex.key ubuntu@<IP> bash vinyldex/deploy/scripts/set-env.sh NOME
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:?Uso: set-env.sh NOME (valore da stdin)}"
[[ "$NAME" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Nome non valido: $NAME" >&2; exit 1; }
VALUE="$(cat | tr -d '\r\n')"
[ -n "$VALUE" ] || { echo "Valore vuoto: niente da fare." >&2; exit 1; }
touch .env
chmod 600 .env
# Riscrive il file senza passare il valore a sed (puo' contenere qualsiasi carattere).
TMP="$(mktemp)"
grep -v "^${NAME}=" .env > "$TMP" || true
printf '%s=%s\n' "$NAME" "$VALUE" >> "$TMP"
cat "$TMP" > .env
rm -f "$TMP"
docker compose up -d backend >/dev/null 2>&1
echo "$NAME salvata, backend riavviato."
