#!/usr/bin/env bash
# ============================================================
# ETAPA 3 — stack Supabase LOCAL e descartável para o E2E
# ------------------------------------------------------------
# Uso:  bash scripts/e2e/stack.sh subir | parar | env
#
# Sobe Postgres, Auth, PostgREST, Kong, Edge Runtime e o capturador de
# e-mail (Mailpit) com a CLI do Supabase, num diretório de trabalho
# TEMPORÁRIO. Nenhum projeto hospedado entra aqui: não há `supabase
# link`, não há token de nuvem, e a trava (scripts/e2e/trava.mjs)
# recusa qualquer *.supabase.co.
#
# Por que diretório temporário com `migrations/` vazio: o repositório
# tem dois arquivos com prefixo 0047 (já aplicados nos dois ambientes
# hospedados, com nomes distintos no ledger). A CLI usa o prefixo como
# chave do ledger local e para na segunda 0047. A cadeia é aplicada
# depois, por psql, na mesma ordem do tests/reset-db.sh
# (scripts/e2e/banco.sh).
#
# Versões fixadas: a CLI (SUPABASE_CLI_VERSION, instalada pelo CI) fixa
# as imagens; o major do Postgres vem de supabase/config.toml (17, o
# mesmo do remoto).
# ============================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
W="${E2E_WORKDIR:-${RUNNER_TEMP:-/tmp}/triliva-e2e-stack}"
SUPA="${SUPABASE_BIN:-supabase}"
ENV_OUT="$W/local.env"
# nome dos containers: supabase_<serviço>_<project_id do config.toml>
PROJETO="$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' "$RAIZ/supabase/config.toml" | head -1)"

preparar_workdir() {
  rm -rf "$W/supabase"
  mkdir -p "$W/supabase/migrations"
  cp "$RAIZ/supabase/config.toml" "$W/supabase/config.toml"
  cp -r "$RAIZ/supabase/functions" "$W/supabase/functions"
  # Segredos LOCAIS das Edge Functions, só no config do diretório
  # temporário. Nada de chave de produção ou do demo: SUPABASE_URL e a
  # chave de serviço são as da própria stack (a CLI injeta), e
  # RESEND_API_KEY não existe aqui, então nenhum e-mail sai (a função
  # marca o envio como pendente). ALLOWED_ORIGINS é a origem do front
  # servido no runner; o link de redefinição volta para ele.
  {
    echo ""
    echo "[edge_runtime.secrets]"
    echo "ALLOWED_ORIGINS = \"${E2E_FRONT_ORIGIN:-http://127.0.0.1:4173}\""
    echo "PASSWORD_RESET_REDIRECT_URL = \"${E2E_FRONT_ORIGIN:-http://127.0.0.1:4173}/redefinir-senha\""
    echo "VERCEL_PREVIEW_PREFIXES = \"e2e-local-sem-preview\""
    if [ -n "${E2E_EXTRA_CA:-}" ]; then
      # só para máquinas atrás de proxy com TLS próprio (ex.: sandbox de
      # desenvolvimento): o Deno baixa os módulos das funções do jsr.io
      mkdir -p "$W/supabase/functions/.ca"
      cp "$E2E_EXTRA_CA" "$W/supabase/functions/.ca/ca.crt"
      echo "DENO_CERT = \"$W/supabase/functions/.ca/ca.crt\""
      echo "DENO_TLS_CA_STORE = \"system\""
      echo "SSL_CERT_FILE = \"$W/supabase/functions/.ca/ca.crt\""
    fi
  } >> "$W/supabase/config.toml"
}

esperar() { # esperar <descrição> <comando...> — prontidão real, não tempo fixo
  local desc="$1"; shift
  for i in $(seq 1 90); do
    if "$@" >/dev/null 2>&1; then echo "pronto: $desc (${i}s)"; return 0; fi
    sleep 1
  done
  echo "::error::stack local: $desc não ficou pronto em 90s" >&2
  return 1
}

gravar_env() {
  "$SUPA" status --workdir "$W" -o env > "$W/status.env"
  # só o que o E2E usa; nada disto é segredo (chaves de demonstração da
  # CLI, válidas apenas nesta stack), mas nada é impresso no log.
  # shellcheck disable=SC1091
  set -a; . "$W/status.env"; set +a
  {
    echo "E2E_API_URL=${API_URL}"
    echo "E2E_DB_URL=${DB_URL}"
    echo "E2E_ANON_KEY=${ANON_KEY}"
    echo "E2E_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
    echo "E2E_MAIL_URL=${INBUCKET_URL:-${MAILPIT_URL:-http://127.0.0.1:54324}}"
    echo "E2E_FUNCTIONS_URL=${API_URL}/functions/v1"
    # Os nomes do E2E antigo, se algum script ainda os ler, recebem os
    # valores GERADOS por esta stack, nunca um secret do GitHub. A trava
    # confere E2E_SUPABASE_URL como qualquer outra URL.
    echo "E2E_SUPABASE_URL=${API_URL}"
    echo "E2E_SUPABASE_ANON_KEY=${ANON_KEY}"
    # O Edge Runtime direto, sem o Kong: o Kong local responde o preflight
    # com CORS "*" antes do código das funções, e o caso H.edge.options_cors
    # precisa da resposta DELAS. O IP é o do container desta stack, na
    # rede do Docker, e entra como host interno declarado para a trava.
    local ip_edge
    ip_edge="$(docker inspect "supabase_edge_runtime_${PROJETO}" \
      --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null | head -c 64)"
    if [ -n "$ip_edge" ]; then
      echo "E2E_EDGE_URL=http://${ip_edge}:8081"
      echo "E2E_HOSTS_INTERNOS=${ip_edge}"
    fi
  } > "$ENV_OUT"
  rm -f "$W/status.env"
  echo "ambiente da stack: $ENV_OUT"
}

case "${1:-}" in
  subir)
    preparar_workdir
    # a saída do start traz as chaves locais de demonstração da CLI: vai
    # para um arquivo, não para o log
    if ! "$SUPA" start --workdir "$W" > "$W/start.log" 2>&1; then
      grep -v -i -E "key|secret|jwt" "$W/start.log" | tail -40 >&2
      exit 1
    fi
    grep -v -i -E "key|secret|jwt" "$W/start.log" | tail -5
    gravar_env
    # shellcheck disable=SC1090
    set -a; . "$ENV_OUT"; set +a
    esperar "Postgres" pg_isready -d "$E2E_DB_URL"
    esperar "Auth (GoTrue)" curl -fsS "$E2E_API_URL/auth/v1/health" -H "apikey: $E2E_ANON_KEY"
    esperar "API (PostgREST)" curl -fsS "$E2E_API_URL/rest/v1/" -H "apikey: $E2E_ANON_KEY"
    esperar "capturador de e-mail" curl -fsS "$E2E_MAIL_URL/api/v1/messages"
    # a primeira requisição compila as funções: espera responderem de fato
    esperar "Edge Functions" curl -fsS -X OPTIONS "$E2E_FUNCTIONS_URL/gerar-meta"
    ;;
  parar)
    "$SUPA" stop --workdir "$W" --no-backup || true
    ;;
  env)
    gravar_env
    ;;
  *)
    echo "uso: $0 subir | parar | env" >&2; exit 2 ;;
esac
