#!/usr/bin/env bash
# ============================================================
# ETAPA 6 — backup lógico cifrado de um projeto (só LEITURA na origem)
# ------------------------------------------------------------
# Uso: BACKUP_PROJETO=prod|demo|sintetico BACKUP_DB_URL=… \
#      BACKUP_PASSPHRASE=… [BACKUP_REF_ESPERADO=…] [BACKUP_SAIDA=dir] \
#      [PG_BIN=/usr/lib/postgresql/17/bin] bash scripts/backup/dump.sh
#
#  1. despejar.mjs: confere que a URL é do projeto pedido, abre uma
#     transação só de leitura, tira o retrato (versão, ledger, contagens,
#     estrutura, cron, event triggers) e roda o pg_dump no MESMO
#     snapshot. Schemas: public, app, demo (se existir),
#     supabase_migrations e auth (sem sessões e tokens de uso único);
#  2. confere o índice do dump: tem de ter dados da aplicação e de
#     auth.users (toc.mjs);
#  3. empacota dump + manifesto interno num .tar e cifra com gpg
#     (AES-256, senha em S2K SHA-512 com contagem máxima). O texto claro
#     não sai do runner;
#  4. decifra de volta e compara o SHA-256: backup que não abre com a
#     senha cadastrada reprova aqui, não no dia do desastre;
#  5. grava o manifesto público (.json) e o resumo do job: data com fuso,
#     versão do Postgres, última migration, tamanho e SHA-256.
#
# Qualquer falha reprova (set -e, pipefail, e cada passo confere o seu
# resultado). Nada é impresso da URL: host, usuário e senha são
# mascarados no log do Actions antes do primeiro comando.
# Saída publicável em $BACKUP_SAIDA/publicar/: SÓ o .tar.gpg e o .json.
# ============================================================
set -euo pipefail
umask 077

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
: "${BACKUP_PROJETO:?defina BACKUP_PROJETO (prod, demo ou sintetico)}"
SAIDA="${BACKUP_SAIDA:-$RAIZ/backup-saida}"

falhar() { echo "::error::$*" >&2; exit 1; }

[ -n "${BACKUP_DB_URL:-}" ] || falhar "BACKUP_DB_URL vazio: o secret de ${BACKUP_PROJETO} não está cadastrado no environment backup (docs/operacao/backup-e-restauracao.md)"
[ -n "${BACKUP_PASSPHRASE:-}" ] || falhar "BACKUP_PASSPHRASE vazio: sem senha não há cifra, e sem cifra o dump não sai do job"
# O artefato fica 30 dias num repositório PÚBLICO e qualquer conta do
# GitHub baixa. A senha é a única coisa entre o arquivo e o dado.
[ "${#BACKUP_PASSPHRASE}" -ge 32 ] || falhar "BACKUP_PASSPHRASE com menos de 32 caracteres: gere uma aleatória (ver o doc)"

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  node -e '
    const u = new URL(process.env.BACKUP_DB_URL);
    const usuario = decodeURIComponent(u.username);
    // A stack local do ensaio usa usuário e senha "postgres": nada ali é
    // segredo, e mascarar a palavra a apagaria do log inteiro (run
    // 36263340832). Fora da máquina, host, usuário do pooler e senha.
    if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(u.hostname))
      for (const v of [u.hostname, usuario === "postgres" ? "" : usuario, decodeURIComponent(u.password)])
        if (v && v.length > 3) console.log("::add-mask::" + v);'
fi

command -v gpg >/dev/null || falhar "gpg ausente"
PG_RESTORE="${PG_BIN:+$PG_BIN/}pg_restore"

carimbo_utc="$(date -u +%Y%m%dT%H%M%SZ)"
data_utc="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
data_local="$(TZ=America/Sao_Paulo date +%Y-%m-%dT%H:%M:%S%:z)"
nome="triliva-${BACKUP_PROJETO}-${carimbo_utc}"

rm -rf "$SAIDA/publicar" "$SAIDA/claro"
mkdir -p "$SAIDA/publicar" "$SAIDA/claro/$nome"
CLARO="$SAIDA/claro"
# o texto claro some no fim, mesmo em erro
trap 'rm -rf "$CLARO"; gpgconf --kill gpg-agent >/dev/null 2>&1 || true' EXIT
export GNUPGHOME="$SAIDA/.gnupg"
mkdir -p "$GNUPGHOME"

echo "▶ dump de ${BACKUP_PROJETO} (${data_local})"
resumo="$(node "$RAIZ/scripts/backup/despejar.mjs" "$CLARO/$nome")" || falhar "dump de ${BACKUP_PROJETO} falhou"

echo "▶ índice do dump"
"$PG_RESTORE" --list "$CLARO/$nome/dump.pgcustom" > "$CLARO/toc.txt" || falhar "pg_restore não lê o dump"
node "$RAIZ/scripts/backup/toc.mjs" "$CLARO/toc.txt" "$CLARO/toc" || falhar "dump sem os dados esperados"
(cd "$CLARO/$nome" && sha256sum dump.pgcustom manifesto-interno.json > SHA256SUMS)

echo "▶ pacote e cifra"
tar -C "$CLARO" -cf "$CLARO/$nome.tar" "$nome"
sha_tar="$(sha256sum "$CLARO/$nome.tar" | cut -d' ' -f1)"
GPG=(gpg --batch --yes --quiet --no-tty --pinentry-mode loopback --no-symkey-cache --passphrase-fd 3)
"${GPG[@]}" --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
  --compress-algo none --output "$SAIDA/publicar/$nome.tar.gpg" "$CLARO/$nome.tar" \
  3< <(printf '%s' "$BACKUP_PASSPHRASE") || falhar "gpg não cifrou"

echo "▶ prova de que abre: decifra e compara"
sha_volta="$("${GPG[@]}" --decrypt "$SAIDA/publicar/$nome.tar.gpg" 3< <(printf '%s' "$BACKUP_PASSPHRASE") | sha256sum | cut -d' ' -f1)"
[ "$sha_volta" = "$sha_tar" ] || falhar "o arquivo cifrado não volta ao mesmo pacote (SHA-256 diverge)"

arquivo="$SAIDA/publicar/$nome.tar.gpg"
tamanho="$(stat -c %s "$arquivo")"
sha="$(sha256sum "$arquivo" | cut -d' ' -f1)"

RESUMO="$resumo" ARQ="$nome.tar.gpg" TAM="$tamanho" SHA="$sha" SHA_TAR="$sha_tar" \
DATA_UTC="$data_utc" DATA_LOCAL="$data_local" node -e '
  const r = JSON.parse(process.env.RESUMO);
  const m = {
    projeto: process.env.BACKUP_PROJETO,
    data_local: process.env.DATA_LOCAL, fuso: "America/Sao_Paulo", data_utc: process.env.DATA_UTC,
    postgres: r.postgres, pg_dump: r.pg_dump,
    ultima_migration: r.ultima_migration, ledger_linhas: r.ledger_linhas,
    schemas: r.schemas,
    arquivo: process.env.ARQ, tamanho_bytes: Number(process.env.TAM), sha256: process.env.SHA,
    sha256_pacote_claro: process.env.SHA_TAR, dump_bytes: r.dump_bytes,
    cifra: "gpg simétrico, AES-256, S2K SHA-512 iterado (65011712), MDC",
    execucao: process.env.GITHUB_RUN_ID ? {
      run_id: process.env.GITHUB_RUN_ID, tentativa: process.env.GITHUB_RUN_ATTEMPT,
      commit: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF } : null,
  };
  require("fs").writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + "\n");
' "$SAIDA/publicar/$nome.json"

mig="$(node -pe 'const m=JSON.parse(process.argv[1]).ultima_migration; m ? `${m.name ?? "(sem nome)"} (${m.version})` : "ledger vazio"' "$resumo")"
pgv="$(node -pe 'JSON.parse(process.argv[1]).postgres' "$resumo")"
tabela="| Projeto | Data (Brasília) | Postgres | Última migration (ledger) | Arquivo | Tamanho | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| ${BACKUP_PROJETO} | ${data_local} | ${pgv} | ${mig} | \`${nome}.tar.gpg\` | ${tamanho} bytes | \`${sha}\` |"
echo "$tabela"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  { echo "### Backup ${BACKUP_PROJETO}"; echo; echo "$tabela"; echo; } >> "$GITHUB_STEP_SUMMARY"
fi
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  { echo "nome=$nome"; echo "sha256=$sha"; } >> "$GITHUB_OUTPUT"
fi
echo "✔ backup de ${BACKUP_PROJETO}: $SAIDA/publicar/$nome.tar.gpg"
