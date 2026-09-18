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
# Glob de dois dígitos (01,02,...,10,...) ordenado. PULADOS aqui — e a
# regra do corte é uma só: quem escreve no schema `auth` (GoTrue) não
# roda no Postgres vanilla do CI/local.
#   04 → contas de Auth do seed de dev.
#   21 → contas de Auth dos alunos da vitrine.
#
# Onda 8: antes o skip era 04/13/14, porque o 13 misturava `usuarios`
# (público) com `auth.users` no mesmo laço. O efeito colateral era
# grave: a base INTEIRA da vitrine — 60 alunos, registros, metas e
# simulados — ficava fora do CI, sem um único teste. Foi assim que as
# datas cravadas em junho passaram três meses congeladas em silêncio.
# A parte de Auth saiu para o 21; o 13 virou 100% público e o 14, que
# nunca tocou em `auth`, voltou junto. Os dois agora são testados.
for f in "$DIR"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*|*/21_*) continue;; esac
  echo "seed: $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done

# o seed precisa ser idempotente: roda DUAS vezes de propósito e
# o teste de motor confere que nada duplicou
for f in "$DIR"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*|*/21_*) continue;; esac
  psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done

echo "banco ${DB} pronto (migrations + seed 2x, idempotência exercitada)"
