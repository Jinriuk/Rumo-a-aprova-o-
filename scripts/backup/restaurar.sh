#!/usr/bin/env bash
# ============================================================
# ETAPA 6 — restaura um backup cifrado num projeto Supabase VAZIO
# ------------------------------------------------------------
# Uso: RESTAURO_ARQUIVO=triliva-prod-….tar.gpg RESTAURO_PASSPHRASE=… \
#      RESTAURO_DB_URL=postgresql://… [RESTAURO_ALVO=local|<ref novo>] \
#      [RESTAURO_CRON=inativo|ativo] [RESTAURO_MANIFESTO=….json] \
#      [RESTAURO_RELATORIO=relatorio.json] [RESTAURO_REDIGIR=1] \
#      [PG_BIN=…] bash scripts/backup/restaurar.sh
#
# Fases (cada uma cronometrada, qualquer erro reprova):
#   0. trava (alvo.mjs): destino local, ou o projeto NOVO cujo ref foi
#      declarado; e vazio (auth.users sem linha, nenhuma tabela da
#      aplicação). Não restaura por cima de banco com dado;
#   1. integridade e decifra: SHA-256 do .gpg contra o manifesto público
#      (quando dado), gpg, e o SHA256SUMS de dentro do pacote;
#   2. estrutura + dados da aplicação (public, app, demo,
#      supabase_migrations), numa transação só;
#   3. ACLs: zera o que os privilégios padrão do destino deram a
#      PUBLIC/anon/authenticated/service_role nos objetos restaurados e
#      aplica as ACLs do dump. Sem isso, anon ganha EXECUTE em toda
#      função do public (ensaiado: 66 funções);
#   4. dados do Auth (usuários, identidades, fatores), com
#      session_replication_role = replica, numa transação;
#   5. o que o dump por schema não traz: event triggers da aplicação e
#      jobs do cron (desligados, salvo RESTAURO_CRON=ativo), ANALYZE e
#      recarga do cache do PostgREST;
#   6. conferência: retrato do destino × manifesto interno da origem
#      (comparar.mjs). Diferença reprova.
# ============================================================
set -euo pipefail
umask 077
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
: "${RESTAURO_ARQUIVO:?defina RESTAURO_ARQUIVO (.tar.gpg)}"
: "${RESTAURO_PASSPHRASE:?defina RESTAURO_PASSPHRASE}"
: "${RESTAURO_DB_URL:?defina RESTAURO_DB_URL (destino)}"
export RESTAURO_ALVO="${RESTAURO_ALVO:-local}"
CRON="${RESTAURO_CRON:-inativo}"
case "$CRON" in inativo|ativo) ;; *) echo "::error::RESTAURO_CRON é inativo ou ativo" >&2; exit 2 ;; esac
PSQL="${PG_BIN:+$PG_BIN/}psql"
PG_RESTORE="${PG_BIN:+$PG_BIN/}pg_restore"

falhar() { echo "::error::$*" >&2; exit 1; }
W="$(mktemp -d "${RUNNER_TEMP:-/tmp}/restauro.XXXXXX")"
export GNUPGHOME="$W/.gnupg"; mkdir -p "$GNUPGHOME"
trap 'rm -rf "$W"; gpgconf --kill gpg-agent >/dev/null 2>&1 || true' EXIT

declare -A T
fase() { # fase <nome> <comando…> — cronometra em milissegundos
  local nome="$1"; shift
  local t0; t0=$(date +%s%3N)
  echo "▶ $nome"
  "$@"
  T[$nome]=$(( $(date +%s%3N) - t0 ))
  echo "  ${T[$nome]} ms"
}
psql_dst() { PGOPTIONS="-c client_min_messages=warning" "$PSQL" "$RESTAURO_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

trava() { node "$RAIZ/scripts/backup/alvo.mjs"; }

decifrar() {
  local sha
  sha="$(sha256sum "$RESTAURO_ARQUIVO" | cut -d' ' -f1)"
  if [ -n "${RESTAURO_MANIFESTO:-}" ]; then
    local esperado
    esperado="$(node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sha256' "$RESTAURO_MANIFESTO")"
    [ "$sha" = "$esperado" ] || falhar "SHA-256 do arquivo ($sha) não confere com o manifesto ($esperado): arquivo corrompido ou trocado"
    echo "  SHA-256 confere com o manifesto público"
  fi
  SHA_ARQUIVO="$sha"
  gpg --batch --quiet --no-tty --pinentry-mode loopback --no-symkey-cache --passphrase-fd 3 \
    --decrypt "$RESTAURO_ARQUIVO" 3< <(printf '%s' "$RESTAURO_PASSPHRASE") | tar -C "$W" -xf - \
    || falhar "não decifrou: senha errada ou arquivo corrompido"
  PACOTE="$(find "$W" -mindepth 1 -maxdepth 1 -type d -name 'triliva-*' | head -1)"
  [ -n "$PACOTE" ] || falhar "pacote sem a pasta triliva-*"
  (cd "$PACOTE" && sha256sum --quiet -c SHA256SUMS) || falhar "SHA256SUMS de dentro do pacote não confere"
  "$PG_RESTORE" --list "$PACOTE/dump.pgcustom" > "$W/toc.txt"
  node "$RAIZ/scripts/backup/toc.mjs" "$W/toc.txt" "$W/toc" \
    "$(node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).schemas.join(",")' "$PACOTE/manifesto-interno.json")"
}

versao() {
  local origem destino
  origem="$(node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).postgres.major' "$PACOTE/manifesto-interno.json")"
  destino="$(psql_dst -Atc "select current_setting('server_version_num')::int / 10000")"
  [ "$destino" -ge "$origem" ] || falhar "destino Postgres $destino é mais velho que a origem ($origem)"
}

estrutura() {
  "$PG_RESTORE" --dbname="$RESTAURO_DB_URL" --no-owner --exit-on-error --single-transaction \
    --use-list="$W/toc-estrutura.txt" "$PACOTE/dump.pgcustom"
}

acls() {
  {
    cat <<'SQL'
do $$
declare s text;
begin
  foreach s in array array['public', 'app', 'demo', 'supabase_migrations'] loop
    continue when not exists (select 1 from pg_namespace where nspname = s);
    execute format('revoke all on all tables in schema %I from public, anon, authenticated, service_role', s);
    execute format('revoke all on all sequences in schema %I from public, anon, authenticated, service_role', s);
    execute format('revoke all on all routines in schema %I from public, anon, authenticated, service_role', s);
    -- o default do Postgres para função é EXECUTE para PUBLIC; as ACLs
    -- do dump são diferenças contra esse default
    execute format('grant execute on all routines in schema %I to public', s);
  end loop;
end $$;
SQL
    "$PG_RESTORE" --no-owner --use-list="$W/toc-acl.txt" --file=- "$PACOTE/dump.pgcustom"
  } | psql_dst -1
}

auth_dados() {
  {
    echo "set session_replication_role = replica;"
    "$PG_RESTORE" --data-only --use-list="$W/toc-auth.txt" --file=- "$PACOTE/dump.pgcustom"
  } | psql_dst -1
}

pos() {
  node "$RAIZ/scripts/backup/pos-restauro.mjs" "$PACOTE/manifesto-interno.json" --cron "$CRON" > "$W/pos.sql"
  psql_dst -1 -f "$W/pos.sql"
  psql_dst -c "analyze" -c "notify pgrst, 'reload schema'"
}

conferir() {
  node "$RAIZ/scripts/backup/metadados.mjs" "$RESTAURO_DB_URL" "$W/destino.json"
  local extra=()
  [ -n "${RESTAURO_REDIGIR:-}" ] && extra+=(--redigir)
  node "$RAIZ/scripts/backup/comparar.mjs" "$PACOTE/manifesto-interno.json" "$W/destino.json" \
    --cron "$CRON" --saida "$W/comparacao.json" "${extra[@]}"
}

inicio=$(date +%s%3N)
fase trava trava
fase decifrar decifrar
fase versao versao
fase estrutura estrutura
fase acl acls
fase auth auth_dados
fase pos pos
restauro_ms=$(( $(date +%s%3N) - inicio ))
echo "restore concluído em ${restauro_ms} ms (sem a conferência)"
t0=$(date +%s%3N)
echo "▶ conferencia"
set +e
conferir
ok=$?
set -e
T[conferencia]=$(( $(date +%s%3N) - t0 ))

if [ -n "${RESTAURO_RELATORIO:-}" ]; then
  CRON_MODO="$CRON" TEMPOS="$(for k in "${!T[@]}"; do echo "$k=${T[$k]}"; done)" RESTAURO_MS="$restauro_ms" SHA="$SHA_ARQUIVO" OK="$ok" \
  node -e '
    const fs = require("fs");
    const [pacote, comp, saida] = process.argv.slice(1);
    const m = JSON.parse(fs.readFileSync(pacote + "/manifesto-interno.json", "utf8"));
    const tempos = Object.fromEntries(process.env.TEMPOS.trim().split("\n").map((l) => l.split("=")).map(([k, v]) => [k, Number(v)]));
    const r = {
      arquivo_sha256: process.env.SHA, projeto: m.projeto, origem_postgres: m.postgres.versao,
      ultima_migration: m.ultima_migration, restauro_ms: Number(process.env.RESTAURO_MS), tempos_ms: tempos,
      cron: process.env.CRON_MODO, conferencia_ok: process.env.OK === "0",
      comparacao: fs.existsSync(comp) ? JSON.parse(fs.readFileSync(comp, "utf8")) : null,
    };
    fs.writeFileSync(saida, JSON.stringify(r, null, 1) + "\n");
  ' "$PACOTE" "$W/comparacao.json" "$RESTAURO_RELATORIO"
fi
[ "$ok" = 0 ] || falhar "o destino restaurado diverge da origem (ver acima)"
echo "✔ restore conferido: ${restauro_ms} ms"
