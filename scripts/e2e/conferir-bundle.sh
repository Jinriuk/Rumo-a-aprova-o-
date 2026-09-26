#!/usr/bin/env bash
# ============================================================
# ETAPA 3 — confere o bundle do front do E2E
# ------------------------------------------------------------
# Uso: bash scripts/e2e/conferir-bundle.sh <dir-do-bundle> <url-local-da-api>
# Reprova se o bundle cita qualquer projeto *.supabase.co (o build pegou
# configuração que não é a local, ex.: o app/.env.production do demo) ou
# se NÃO contém a URL local (as variáveis locais não entraram).
# Separado do front.sh para a prova negativa poder exercê-lo sem build.
# ============================================================
set -euo pipefail
DIR="${1:?informe o diretório do bundle}"
URL="${2:?informe a URL local da API}"
if grep -rIl -E "[a-z0-9]{20}\.supabase\.co" "$DIR" >/dev/null 2>&1; then
  echo "::error::o bundle do E2E cita um projeto *.supabase.co — o build pegou configuração que não é a local" >&2
  grep -rIo -E "[a-z0-9]{20}\.supabase\.co" "$DIR" | sort -u >&2
  exit 1
fi
if ! grep -rIqF "$URL" "$DIR"; then
  echo "::error::o bundle do E2E não contém $URL — as variáveis locais não entraram no build" >&2
  exit 1
fi
