#!/usr/bin/env bash
# ============================================================
# ETAPA 4 — provas dos alertas na stack local e descartável da E3
# ------------------------------------------------------------
# Uso:  bash scripts/alertas/provas.sh
# Requer o mesmo que scripts/e2e/rodar.sh: Docker, a CLI do Supabase
# (SUPABASE_BIN ou `supabase` no PATH), psql, Node 22, `npm ci` em app/
# e tests/, e o Chromium do Playwright (ou PW_CHROMIUM_PATH).
#
# Sequência:
#   1. simulador de Resend e healthchecks no host (scripts/alertas/
#      simulador.mjs), alcançado pelos containers pelo IP da docker0;
#   2. stack local da E3 com segredos A MAIS só desta prova:
#      ALERTA_EMAIL fictício e RESEND_API_URL apontando para o
#      simulador (a função só aceita host local/privado nessa variável);
#   3. banco (migrations + seeds) e front com VITE_ERROR_REPORT_URL
#      apontando para a função registrar-erro LOCAL;
#   4. scripts/alertas/provas.mjs (P1 a P7) e o relatório.
# Nada sai da máquina: a trava da E3 recusa *.supabase.co, e o e-mail e
# o ping caem no simulador. A stack cai no fim (E2E_MANTER_STACK=1 mantém).
# ============================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
export E2E_WORKDIR="${E2E_WORKDIR:-${RUNNER_TEMP:-/tmp}/triliva-alertas-stack}"
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  export E2E_RUN_ID="${E2E_RUN_ID:-gh-alertas-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}}"
else
  export E2E_RUN_ID="${E2E_RUN_ID:-alertas-$(date +%Y%m%d%H%M%S)}"
fi
export PROVAS_SAIDA="${PROVAS_SAIDA:-$RAIZ/e2e-artefatos/alertas}"
PORTA="${SIMULADOR_PORTA:-54399}"
mkdir -p "$PROVAS_SAIDA" "$E2E_WORKDIR"

# IP do host visto de dentro dos containers da stack (gateway da docker0)
HOST_IP="$(ip -4 -o addr show docker0 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)"
HOST_IP="${HOST_IP:-172.17.0.1}"

export SIMULADOR_LOG="$PROVAS_SAIDA/simulador.jsonl"
export SIMULADOR_PORTA="$PORTA"
: > "$SIMULADOR_LOG"
node "$RAIZ/scripts/alertas/simulador.mjs" &
SIM=$!
PREVIEW=""
encerrar() {
  kill "$SIM" 2>/dev/null || true
  [ -n "$PREVIEW" ] && kill "$PREVIEW" 2>/dev/null || true
  [ -n "${E2E_MANTER_STACK:-}" ] || bash "$RAIZ/scripts/e2e/stack.sh" parar > /dev/null 2>&1 || true
}
trap encerrar EXIT

# valores fictícios: não são segredo, e só valem nesta stack
cat > "$E2E_WORKDIR/segredos-alertas.toml" <<EOF
ALERTA_EMAIL = "dono@exemplo.invalid"
RESEND_API_KEY = "re_simulado_so_na_stack_local"
RESEND_FROM_EMAIL = "alertas@exemplo.invalid"
RESEND_API_URL = "http://${HOST_IP}:${PORTA}"
EOF
export E2E_SECRETS_EXTRA="$E2E_WORKDIR/segredos-alertas.toml"

bash "$RAIZ/scripts/e2e/stack.sh" subir
echo "$E2E_RUN_ID" > "$E2E_WORKDIR/run_id"
bash "$RAIZ/scripts/e2e/banco.sh"

# shellcheck disable=SC1091
set -a; . "$E2E_WORKDIR/local.env"; set +a
export VITE_ERROR_REPORT_URL="${E2E_API_URL}/functions/v1/registrar-erro"
bash "$RAIZ/scripts/e2e/front.sh"

(cd "$RAIZ/app" && exec npx vite preview --outDir dist-e2e --port 4173 --host 127.0.0.1 --strictPort > "$PROVAS_SAIDA/preview.log" 2>&1) &
PREVIEW=$!
for _ in $(seq 1 60); do curl -fsS -o /dev/null http://127.0.0.1:4173/ && break; sleep 1; done

# o front da Etapa 4 manda release, papel e correlation_id; o anterior
# só mensagem/pilha/origem/rota. A P4 confere os campos novos quando o
# front que está no checkout já os manda.
if grep -q "correlation_id" "$RAIZ/app/src/shared/lib/observabilidade.js"; then
  export PROVA_CONTEXTO_COMPLETO=1
fi

export PROVAS_HC_BASE="http://${HOST_IP}:${PORTA}/hc"
node "$RAIZ/scripts/alertas/provas.mjs"
