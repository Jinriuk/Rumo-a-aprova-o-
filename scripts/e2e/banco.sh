#!/usr/bin/env bash
# ============================================================
# ETAPA 3 — banco da stack local: migrations + seeds + fixture
# ------------------------------------------------------------
# Pré: stack.sh subir (gera $E2E_WORKDIR/local.env) e E2E_RUN_ID.
# Ordem:
#   1. trava de destino (host local, sem *.supabase.co, run id) e
#      criação do marcador da fixture no banco recém-criado;
#   2. cadeia de migrations inteira, por psql, na ordem do
#      tests/reset-db.sh (mesmo motivo do stack.sh: prefixo 0047 duplo);
#   3. seeds de supabase/seed, menos 04 e 21 (escrevem em auth.users;
#      aqui os usuários nascem pela API admin, em semear.mjs);
#   4. o agendamento pg_cron da 0004 sai: a virada só acontece quando o
#      teste manda, com data controlada;
#   5. conferência final do marcador (a trava inteira).
# ============================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
W="${E2E_WORKDIR:-${RUNNER_TEMP:-/tmp}/triliva-e2e-stack}"
# shellcheck disable=SC1091
set -a; . "$W/local.env"; set +a
: "${E2E_RUN_ID:?defina E2E_RUN_ID (id de execução)}"

node "$RAIZ/scripts/e2e/trava.mjs" marcar

export PGOPTIONS="-c client_min_messages=warning"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  psql "$E2E_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done
echo "migrations aplicadas: $(ls "$RAIZ"/supabase/migrations/*.sql | wc -l)"

for f in "$RAIZ"/supabase/seed/[0-9][0-9]_*.sql; do
  case "$f" in */04_*|*/21_*) continue;; esac
  psql "$E2E_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
done
echo "seeds aplicados (menos 04 e 21)"

psql "$E2E_DB_URL" -v ON_ERROR_STOP=1 -q -c \
  "select cron.unschedule(jobname) from cron.job where jobname = 'virar-semana-diaria';" > /dev/null
echo "agendamento da virada removido (o E2E controla a data)"

node "$RAIZ/scripts/e2e/trava.mjs" conferir
