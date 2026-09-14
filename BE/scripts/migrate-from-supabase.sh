#!/usr/bin/env bash
#
# Travaso completo da Supabase al Postgres locale.
#
# Cosa fa, in ordine:
#   1. crea il database FS0226IT-CAPSTONE se non esiste
#   2. scarica da Supabase schema e dati di Prisma
#   3. li ripristina nello schema "legacy" del database locale
#   4. ricorda quali sono i passi successivi
#
# I dati esistenti non vengono toccati: lo schema applicativo lo crea Flyway all'avvio
# dell'applicazione, e il travaso vero e proprio lo fa import-legacy-data.sql.
#
# Uso:
#   export SUPABASE_DATABASE_URL="postgresql://utente:password@host:5432/postgres?sslmode=require"
#   export PGPASSWORD="password-postgres-locale"
#   ./migrate-from-supabase.sh
#
set -euo pipefail

DB_NAME="${DB_NAME:-FS0226IT-CAPSTONE}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMP_FILE="${DUMP_FILE:-$SCRIPT_DIR/supabase-dump.sql}"

if [[ -z "${SUPABASE_DATABASE_URL:-}" ]]; then
  echo "Errore: SUPABASE_DATABASE_URL non impostata." >&2
  echo "Il valore si trova in backend/.env, voce DATABASE_URL." >&2
  exit 1
fi

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "Errore: PGPASSWORD non impostata (password dell'utente $DB_USER su $DB_HOST)." >&2
  exit 1
fi

echo "==> 1/3  Creazione del database $DB_NAME (se non esiste)"
# psql non ha un CREATE DATABASE IF NOT EXISTS: si controlla prima.
EXISTS="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"

if [[ "$EXISTS" == "1" ]]; then
  echo "    Il database esiste gia', nessuna azione."
else
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -E UTF8 "$DB_NAME"
  echo "    Creato."
fi

echo "==> 2/3  Dump da Supabase verso $DUMP_FILE"
# --no-owner e --no-privileges: i ruoli di Supabase non esistono in locale e bloccherebbero
# il ripristino. --schema=public: si prende solo lo schema applicativo di Prisma.
pg_dump "$SUPABASE_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="$DUMP_FILE"

echo "    Dump completato ($(wc -l < "$DUMP_FILE") righe)."

echo "==> 3/3  Ripristino nello schema legacy di $DB_NAME"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA legacy;"

# Il dump crea gli oggetti in "public": si sposta il search_path in modo che finiscano
# in "legacy", lasciando "public" libero per lo schema nuovo gestito da Flyway.
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "SET search_path TO legacy;" \
  -f <(sed 's/^SET search_path = public.*/SET search_path = legacy;/; s/\bpublic\./legacy./g' "$DUMP_FILE")

echo
echo "Fatto. Prossimi passi:"
echo "  1. Avviare l'applicazione una volta: Flyway crea lo schema nuovo."
echo "       cd BE && DB_PASSWORD=\"\$PGPASSWORD\" ./mvnw spring-boot:run"
echo "  2. Travasare i dati:"
echo "       psql -h $DB_HOST -U $DB_USER -d '$DB_NAME' -v ON_ERROR_STOP=1 -f '$SCRIPT_DIR/import-legacy-data.sql'"
echo "  3. Controllare che i conteggi in coda allo script coincidano, poi:"
echo "       psql -h $DB_HOST -U $DB_USER -d '$DB_NAME' -c 'DROP SCHEMA legacy CASCADE;'"
