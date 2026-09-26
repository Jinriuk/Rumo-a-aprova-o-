#!/usr/bin/env bash
# ============================================================
# ETAPA 3 — prova de que configuração local ERRADA falha
# ------------------------------------------------------------
# Roda no CI antes de subir a stack. Cada caso tem de FALHAR; o controle
# (configuração certa) tem de passar. Se um caso errado passar, o job
# reprova. Nada aqui abre conexão: a trava recusa antes.
# ============================================================
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
erros=0

# ambiente certo, sem local.env (workdir vazio): só o que vai na linha
LOCAL=(E2E_WORKDIR="$TMP/sem-stack" E2E_RUN_ID=gh-prova-1
  E2E_API_URL=http://127.0.0.1:54321 E2E_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
  E2E_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1 E2E_MAIL_URL=http://127.0.0.1:54324)

deve_falhar() {
  local desc="$1"; shift
  if "$@" > "$TMP/saida" 2>&1; then
    echo "::error::prova negativa NÃO falhou: $desc"; erros=$((erros + 1))
  else
    echo "falhou, como devia: $desc — $(grep -o 'trava E2E:.*\|::error::.*' "$TMP/saida" | head -1 | cut -c1-140)"
  fi
}
deve_passar() {
  local desc="$1"; shift
  if "$@" > "$TMP/saida" 2>&1; then echo "passou, como devia: $desc"
  else echo "::error::controle falhou: $desc"; cat "$TMP/saida"; erros=$((erros + 1)); fi
}
trava() { env "${LOCAL[@]}" "$@" node "$RAIZ/scripts/e2e/trava.mjs" destino; }

deve_passar "controle: configuração local" trava
deve_falhar "API apontando para projeto hospedado" trava E2E_API_URL=https://abcdefghijklmnopqrst.supabase.co
deve_falhar "banco apontando para o pooler hospedado" trava E2E_DB_URL=postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
deve_falhar "E2E_SUPABASE_URL com valor de projeto hospedado" trava E2E_SUPABASE_URL=https://zckyhihxjjbnqjqilymn.supabase.co
deve_falhar "hospedado declarado como interno" trava E2E_API_URL=https://bdjkgrzfzoamchdpobbl.supabase.co E2E_HOSTS_INTERNOS=bdjkgrzfzoamchdpobbl.supabase.co
deve_falhar "host que não é local nem interno" trava E2E_MAIL_URL=http://10.0.0.8:54324
deve_falhar "sem id de execução" trava E2E_RUN_ID=

mkdir -p "$TMP/bundle-demo" "$TMP/bundle-sem-url" "$TMP/bundle-ok"
echo 'const u="https://bdjkgrzfzoamchdpobbl.supabase.co"' > "$TMP/bundle-demo/index.js"
echo 'const u="http://127.0.0.1:9999"' > "$TMP/bundle-sem-url/index.js"
echo 'const u="http://127.0.0.1:54321"' > "$TMP/bundle-ok/index.js"
deve_passar "controle: bundle com a URL local" bash "$RAIZ/scripts/e2e/conferir-bundle.sh" "$TMP/bundle-ok" http://127.0.0.1:54321
deve_falhar "bundle que cita o projeto do demo" bash "$RAIZ/scripts/e2e/conferir-bundle.sh" "$TMP/bundle-demo" http://127.0.0.1:54321
deve_falhar "bundle sem a URL local" bash "$RAIZ/scripts/e2e/conferir-bundle.sh" "$TMP/bundle-sem-url" http://127.0.0.1:54321

if [ "$erros" -gt 0 ]; then echo "::error::$erros prova(s) negativa(s) não se comportaram"; exit 1; fi
echo "provas negativas: todas ok"
