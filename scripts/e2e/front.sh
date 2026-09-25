#!/usr/bin/env bash
# ============================================================
# ETAPA 3 — build do front apontando para a stack LOCAL
# ------------------------------------------------------------
# `vite build --mode e2e`: nesse modo o Vite NÃO lê app/.env.production
# (que aponta para o demo). Sem VITE_SUPABASE_URL/ANON_KEY injetadas, o
# app falha ao abrir (src/lib/supabase.js lança) em vez de cair no demo.
# Depois do build, o bundle é conferido: tem de conter a URL local e
# não pode conter nenhum *.supabase.co.
# Saída: app/dist-e2e (fora do dist/ de produção).
# ============================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
W="${E2E_WORKDIR:-${RUNNER_TEMP:-/tmp}/triliva-e2e-stack}"
# shellcheck disable=SC1091
set -a; . "$W/local.env"; set +a

node "$RAIZ/scripts/e2e/trava.mjs" destino

cd "$RAIZ/app"
rm -rf dist-e2e
VITE_SUPABASE_URL="$E2E_API_URL" VITE_SUPABASE_ANON_KEY="$E2E_ANON_KEY" \
  npx vite build --mode e2e --outDir dist-e2e --emptyOutDir > "$W/front-build.log" 2>&1 \
  || { tail -30 "$W/front-build.log" >&2; exit 1; }

if grep -rIl -E "[a-z0-9]{20}\.supabase\.co" dist-e2e >/dev/null; then
  echo "::error::o bundle do E2E cita um projeto *.supabase.co — o build pegou configuração que não é a local" >&2
  grep -rIo -E "[a-z0-9]{20}\.supabase\.co" dist-e2e | sort -u >&2
  exit 1
fi
if ! grep -rIq "$E2E_API_URL" dist-e2e; then
  echo "::error::o bundle do E2E não contém $E2E_API_URL — as variáveis locais não entraram no build" >&2
  exit 1
fi
echo "front do E2E: app/dist-e2e aponta para $E2E_API_URL"
