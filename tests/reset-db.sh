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
# Glob de dois dígitos (01,02,...,10,...) ordenado. PULADOS aqui:
#   04 → cria contas no Auth (auth.users); só roda no Supabase real.
#   13 → vitrine demo: também insere em auth.users (seção "CONTAS DE
#        ACESSO"), que não existe no Postgres vanilla do CI/local —
#        é seed de ambiente Supabase real, como o 04. Sem este skip,
#        o passo de seed aborta e TODA a suíte de testes é pulada.
#   14 → depende dos alunos da vitrine criados em 13; sem o 13 não há
#        a quem prender os registros. Anda junto com o 13.
# (15 e 16 mexem só em Lucas/higiene da base — rodam sobre 01–12.)
for f in "$DIR"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*|*/13_*|*/14_*) continue;; esac
  echo "seed: $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done

# o seed precisa ser idempotente: roda DUAS vezes de propósito e
# o teste de motor confere que nada duplicou
for f in "$DIR"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*|*/13_*|*/14_*) continue;; esac
  psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done

echo "banco ${DB} pronto (migrations + seed 2x, idempotência exercitada)"
