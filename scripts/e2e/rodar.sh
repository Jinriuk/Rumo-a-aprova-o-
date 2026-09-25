#!/usr/bin/env bash
# ============================================================
# ETAPA 3 — E2E completo numa stack Supabase LOCAL e descartável
# ------------------------------------------------------------
# Uso:  bash scripts/e2e/rodar.sh [argumentos do playwright test]
# Ex.:  bash scripts/e2e/rodar.sh smoke
#       E2E_MANTER_STACK=1 bash scripts/e2e/rodar.sh --project=http
#
# Sequência: stack → banco (migrations + seeds) → fixture (usuários pela
# API admin local) → front (--mode e2e) → Playwright. A trava de destino
# roda antes do banco, antes da fixture, antes do build e no globalSetup
# da suíte. Requer: Docker, a CLI do Supabase (SUPABASE_BIN ou
# `supabase` no PATH), psql, Node 22, `npm ci` em app/ e tests/.
# ============================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
export E2E_WORKDIR="${E2E_WORKDIR:-${RUNNER_TEMP:-/tmp}/triliva-e2e-stack}"
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  export E2E_RUN_ID="${E2E_RUN_ID:-gh-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}}"
else
  export E2E_RUN_ID="${E2E_RUN_ID:-local-$(date +%Y%m%d%H%M%S)}"
fi

parar() { [ -n "${E2E_MANTER_STACK:-}" ] || bash "$RAIZ/scripts/e2e/stack.sh" parar > /dev/null 2>&1 || true; }
trap parar EXIT

inicio=$(date +%s)
bash "$RAIZ/scripts/e2e/stack.sh" subir
echo "$E2E_RUN_ID" > "$E2E_WORKDIR/run_id"
bash "$RAIZ/scripts/e2e/banco.sh"
node "$RAIZ/scripts/e2e/semear.mjs"
bash "$RAIZ/scripts/e2e/front.sh"
echo "stack + banco + fixture + front: $(( $(date +%s) - inicio ))s"

cd "$RAIZ/app"
npx playwright test "$@"
