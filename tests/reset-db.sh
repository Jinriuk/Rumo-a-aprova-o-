#!/usr/bin/env bash
# Recria o banco de teste local e aplica migrations + seed.
# Requer um Postgres acessível (default: localhost:54322, user postgres).
# Uso: bash reset-db.sh
set -euo pipefail

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-54322}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE=postgres

DB=rumo_teste
DIR="$(cd "$(dirname "$0")/.." && pwd)"

psql -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB};"
psql -v ON_ERROR_STOP=1 -q -c "create database ${DB};"

export PGDATABASE=$DB
for f in "$DIR"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
done
# o seed 04 (contas no Auth) só roda no Supabase real: aqui não há GoTrue.
# Glob de dois dígitos (01,02,...,10,...) ordenado; 04 é pulado.
for f in "$DIR"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*) continue;; esac
  echo "seed: $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done

# o seed precisa ser idempotente: roda DUAS vezes de propósito e
# o teste de motor confere que nada duplicou
for f in "$DIR"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*) continue;; esac
  psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done

echo "banco ${DB} pronto (migrations + seed 2x, idempotência exercitada)"
