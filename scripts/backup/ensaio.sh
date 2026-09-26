#!/usr/bin/env bash
# ============================================================
# ETAPA 6 — ENSAIO DE RESTORE na stack local da E3
# ------------------------------------------------------------
# Dois modos:
#   • sintético (padrão, sem RESTAURO_ARQUIVO): sobe a stack, aplica
#     migrations e seeds (banco.sh da E3), cria contas no Auth local,
#     o job da virada e um schema demo mínimo (semear-sintetico.mjs),
#     tira o backup com o MESMO dump.sh do workflow (senha aleatória,
#     descartada no fim), DERRUBA a stack e apaga o volume;
#   • real (RESTAURO_ARQUIVO + RESTAURO_PASSPHRASE [+ RESTAURO_MANIFESTO]):
#     o .tar.gpg de uma execução do workflow Backup.
# Depois, nos dois: stack NOVA e vazia, restaurar.sh, marcador do
# ensaio, e as conferências:
#   1. restaurar.sh: origem × destino (estrutura, ACLs, contagens,
#      ledger, cron, event triggers);
#   2. conferir-restauro.mjs: login, escola, aluno, vínculos, progresso,
#      RPC, event trigger, cron sem disparo externo;
#   3. contrato de RPCs do front (scripts/manifesto-rpcs.mjs);
#   4. a matriz de autorização inteira (camada banco) sobre o banco
#      restaurado.
# Mede o tempo de cada fase e grava $ENSAIO_SAIDA/ensaio-restauro.{json,md}.
# Nada sai da máquina: a trava da E3 (host local) vale em todo passo que
# escreve, e a stack cai no fim, mesmo em erro (salvo E2E_MANTER_STACK).
#
# Requer o que o e2e-local requer: Docker, CLI do Supabase fixada, psql
# e pg_dump/pg_restore 17 (PG_BIN), Node 22, `npm ci` em app/ e tests/.
# ============================================================
set -euo pipefail
umask 077
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
export E2E_WORKDIR="${E2E_WORKDIR:-${RUNNER_TEMP:-/tmp}/triliva-e2e-stack}"
SAIDA="${ENSAIO_SAIDA:-$RAIZ/ensaio-restauro}"
PSQL="${PG_BIN:+$PG_BIN/}psql"
mkdir -p "$SAIDA"
TMP="$(mktemp -d "${RUNNER_TEMP:-/tmp}/ensaio.XXXXXX")"
sufixo="${GITHUB_RUN_ID:+gh-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT:-1}}"
sufixo="${sufixo:-local-$(date +%Y%m%d%H%M%S)}"

parar() {
  [ -n "${E2E_MANTER_STACK_FINAL:-}" ] || bash "$RAIZ/scripts/e2e/stack.sh" parar > /dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap parar EXIT

declare -A T
agora() { date +%s%3N; }
marca() { T[$1]=$(( $(agora) - $2 )); echo "  ${T[$1]} ms"; }

# ── origem ────────────────────────────────────────────────────
if [ -z "${RESTAURO_ARQUIVO:-}" ]; then
  MODO=sintetico
  echo "▶ origem sintética na stack da E3"
  t=$(agora)
  export E2E_RUN_ID="ensaio-origem-$sufixo"
  bash "$RAIZ/scripts/e2e/stack.sh" subir
  echo "$E2E_RUN_ID" > "$E2E_WORKDIR/run_id"
  bash "$RAIZ/scripts/e2e/banco.sh"
  node "$RAIZ/scripts/backup/semear-sintetico.mjs"
  marca origem "$t"
  # shellcheck disable=SC1091
  ORIGEM_URL="$(. "$E2E_WORKDIR/local.env"; echo "$E2E_DB_URL")"

  echo "▶ backup sintético (o mesmo dump.sh do workflow)"
  t=$(agora)
  SENHA="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
  BACKUP_PROJETO=sintetico BACKUP_DB_URL="$ORIGEM_URL" BACKUP_PASSPHRASE="$SENHA" BACKUP_SAIDA="$TMP/backup" \
    GITHUB_STEP_SUMMARY="" GITHUB_OUTPUT="" bash "$RAIZ/scripts/backup/dump.sh"
  marca backup "$t"
  RESTAURO_ARQUIVO="$(ls "$TMP"/backup/publicar/*.tar.gpg)"
  RESTAURO_MANIFESTO="$(ls "$TMP"/backup/publicar/*.json)"
  RESTAURO_PASSPHRASE="$SENHA"
  cp "$RESTAURO_MANIFESTO" "$SAIDA/manifesto-backup-sintetico.json"

  echo "▶ derruba a origem (volume apagado): o destino nasce do zero"
  bash "$RAIZ/scripts/e2e/stack.sh" parar
else
  MODO=real
  : "${RESTAURO_PASSPHRASE:?defina RESTAURO_PASSPHRASE}"
  export RESTAURO_REDIGIR=1
fi

# ── destino: stack nova ───────────────────────────────────────
echo "▶ stack nova e vazia (destino)"
t=$(agora)
bash "$RAIZ/scripts/e2e/stack.sh" subir
marca stack_destino "$t"
set -a
# shellcheck disable=SC1091
. "$E2E_WORKDIR/local.env"
set +a
export ENSAIO_RUN_ID="ensaio-restauro-$sufixo"

echo "▶ restore"
RESTAURO_ARQUIVO="$RESTAURO_ARQUIVO" RESTAURO_PASSPHRASE="$RESTAURO_PASSPHRASE" \
  RESTAURO_MANIFESTO="${RESTAURO_MANIFESTO:-}" RESTAURO_DB_URL="$E2E_DB_URL" RESTAURO_ALVO=local \
  RESTAURO_CRON=inativo RESTAURO_RELATORIO="$SAIDA/restauro.json" bash "$RAIZ/scripts/backup/restaurar.sh"
unset RESTAURO_PASSPHRASE SENHA

# marcador do ensaio: a matriz e o conferir-restauro recusam banco sem ele
"$PSQL" "$E2E_DB_URL" -X -q -v ON_ERROR_STOP=1 \
  -c "create schema ensaio_restauro" \
  -c "revoke all on schema ensaio_restauro from public, anon, authenticated" \
  -c "create table ensaio_restauro.execucao (run_id text primary key, criado_em timestamptz not null default now())" \
  -c "insert into ensaio_restauro.execucao (run_id) values ('$ENSAIO_RUN_ID')"

echo "▶ conferências funcionais"
t=$(agora)
[ "$MODO" = sintetico ] && export ENSAIO_SENHA="e2e-local-Triliva-2026"
node "$RAIZ/scripts/backup/conferir-restauro.mjs" "$SAIDA/conferencias.json"
marca conferencias "$t"

echo "▶ contrato de RPCs do front no banco restaurado"
t=$(agora)
SUPABASE_DB_URL="$E2E_DB_URL" node "$RAIZ/scripts/manifesto-rpcs.mjs" > "$TMP/rpcs.txt" 2>&1 \
  || { tail -30 "$TMP/rpcs.txt"; echo "::error::contrato de RPCs quebrado no banco restaurado"; exit 1; }
tail -3 "$TMP/rpcs.txt"
marca rpcs "$t"

echo "▶ matriz de autorização (camada banco) no banco restaurado"
t=$(agora)
eval "$(node -e '
  const u = new URL(process.argv[1]);
  console.log(`export PGHOST=${u.hostname} PGPORT=${u.port} PGUSER=${u.username} PGPASSWORD=${u.password} PGDATABASE=${u.pathname.slice(1)}`);
' "$E2E_DB_URL")"
(
  cd "$RAIZ/tests"
  set -o pipefail
  MATRIZ_ENSAIO_RESTAURO="$ENSAIO_RUN_ID" node --test --test-reporter=tap e2-matriz-autorizacao-db.test.mjs > "$TMP/matriz.tap" 2>&1
) || { grep -E "^not ok|# (pass|fail)" "$TMP/matriz.tap" | head -20; echo "::error::matriz de autorização reprovou no banco restaurado"; exit 1; }
conta() { sed -n "s/^# $1 \([0-9]\+\)$/\1/p" "$TMP/matriz.tap" | tail -1; }
MATRIZ="pass $(conta pass), fail $(conta fail), skipped $(conta skipped)"
[ "$(conta fail)" = 0 ] && [ "$(conta skipped)" = 0 ] && [ "$(conta pass)" -ge 7 ] || { echo "::error::matriz: $MATRIZ"; exit 1; }
echo "  matriz: $MATRIZ"
marca matriz "$t"

# ── relatório ─────────────────────────────────────────────────
TEMPOS="$(for k in "${!T[@]}"; do echo "$k=${T[$k]}"; done)" MODO="$MODO" MATRIZ="$MATRIZ" \
  RPCS="$(grep -E 'contrato' "$TMP/rpcs.txt" | tail -1)" node "$RAIZ/scripts/backup/relatorio-ensaio.mjs" "$SAIDA"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$SAIDA/ensaio-restauro.md" >> "$GITHUB_STEP_SUMMARY"
echo "✔ ensaio de restore ($MODO) aprovado: $SAIDA/ensaio-restauro.md"
