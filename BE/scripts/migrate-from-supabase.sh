#!/usr/bin/env bash
#
# Travaso completo da Supabase al Postgres locale.
#
# Cosa fa, in ordine:
#   1. crea il database FS0226IT-CAPSTONE se non esiste
#   2. scarica da Supabase schema e dati di Prisma
#   3. li ripristina e li sposta nello schema "legacy" del database locale
#   4. ricorda quali sono i passi successivi
#
# Lo schema applicativo lo crea Flyway all'avvio dell'applicazione, e il travaso vero e
# proprio lo fa import-legacy-data.sql: questo script prepara solo la sorgente.
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
  echo "Usare la stringa in modalita' Session (porta 5432): pg_dump non funziona" >&2
  echo "con il pooler in modalita' Transaction (porta 6543)." >&2
  exit 1
fi

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "Errore: PGPASSWORD non impostata (password dell'utente $DB_USER su $DB_HOST)." >&2
  exit 1
fi

psql_local() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

echo "==> 1/4  Creazione del database $DB_NAME (se non esiste)"
# psql non ha un CREATE DATABASE IF NOT EXISTS: si controlla prima.
EXISTS="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"

if [[ "$EXISTS" == "1" ]]; then
  echo "    Il database esiste gia', nessuna azione."
else
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -E UTF8 "$DB_NAME"
  echo "    Creato."
fi

echo "==> 2/4  Dump da Supabase verso $DUMP_FILE"
# --no-owner e --no-privileges: i ruoli di Supabase non esistono in locale e bloccherebbero
# il ripristino. --schema=public: si prende solo lo schema applicativo di Prisma.
pg_dump "$SUPABASE_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="$DUMP_FILE"

echo "    Dump completato ($(wc -l < "$DUMP_FILE") righe)."

echo "==> 3/4  Ripristino in $DB_NAME"
# Le tabelle di Prisma sono in PascalCase fra virgolette ("User", "Card"), quelle dello schema
# nuovo sono in snake_case: non possono collidere, quindi il ripristino puo' andare in public
# e le tabelle vengono spostate subito dopo. Si evita cosi' di riscrivere il dump con sed,
# che toccherebbe anche i dati.
#
# Le uniche due righe da togliere ricreano lo schema public, che in locale esiste gia'.
FILTERED="$(mktemp)"
trap 'rm -f "$FILTERED"' EXIT
sed -e '/^CREATE SCHEMA public;$/d' -e '/^COMMENT ON SCHEMA public IS/d' "$DUMP_FILE" > "$FILTERED"

psql_local -q -f "$FILTERED"
echo "    Ripristinate $(psql_local -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename ~ '[A-Z]'") tabelle Prisma."

echo "==> 4/4  Spostamento nello schema legacy"
psql_local -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS legacy;

DO $$
DECLARE r record;
BEGIN
  -- Le tabelle di Prisma si riconoscono dalle maiuscole nel nome: lo schema nuovo,
  -- tutto in snake_case, non ne ha mai.
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ~ '[A-Z]' LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy', r.tablename);
  END LOOP;

  -- Gli enum seguono le tabelle che li usano.
  FOR r IN SELECT t.typname FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname='public' AND t.typtype='e' LOOP
    EXECUTE format('ALTER TYPE public.%I SET SCHEMA legacy', r.typname);
  END LOOP;

  -- Tabella tecnica di Prisma: non serve allo schema nuovo.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_prisma_migrations') THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations SET SCHEMA legacy';
  END IF;
END $$;
SQL
echo "    Schema legacy: $(psql_local -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='legacy'") tabelle."

echo
echo "Fatto. Prossimi passi:"
echo "  1. Avviare l'applicazione una volta: Flyway crea lo schema nuovo."
echo "       cd BE && DB_PASSWORD=\"\$PGPASSWORD\" ./mvnw spring-boot:run"
echo "  2. Travasare i dati:"
echo "       psql -h $DB_HOST -U $DB_USER -d '$DB_NAME' -v ON_ERROR_STOP=1 -f '$SCRIPT_DIR/import-legacy-data.sql'"
echo "  3. Controllare che i conteggi in coda allo script coincidano, poi:"
echo "       psql -h $DB_HOST -U $DB_USER -d '$DB_NAME' -c 'DROP SCHEMA legacy CASCADE;'"
