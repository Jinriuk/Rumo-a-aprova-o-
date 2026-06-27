# DB1-B — Auditoria de Migrations

> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`.

## 1. Como o projeto realmente versiona o banco

- Migrations versionadas no repo: `supabase/migrations/000N_nome.sql`
  (prefixo de **4 dígitos**, não timestamp).
- A guarda `scripts/checar-migrations.mjs` compara o **conjunto de NOMES**
  de `supabase/migrations/*.sql` contra `supabase_migrations.schema_migrations.name`.
- O deploy ao banco **não usa `supabase db push`** com nomes timestamp:
  as migrations foram aplicadas via MCP/pipeline, que registra cada uma
  com `version` = timestamp e `name` = nome do arquivo.

## 2. Comparação local × remoto (antes da DB1)

Repo (28 arquivos): `0001`…`0028` (após a DB1) — antes da DB1 eram 27
(`0001`…`0027`, com `0022_logs_coordenacao` e `0024_motor_progresso`).

Ledger remoto (27 linhas, por nome): idêntico **exceto** um par:

| Repo (arquivo) | Ledger remoto (name) | version | Situação |
|---|---|---|---|
| `0024_motor_progresso` | `0022_motor_progresso` | 20260619004620 | **divergência de NOME** |
| `0022_logs_coordenacao` | `0022_logs_coordenacao` | 20260619021050 | ok |
| `0023_indices_escala_coordenacao` | `0023_indices_escala_coordenacao` | 20260619021105 | ok |

### O que isso causava

`checar-migrations.mjs` (comparação por nome) reportava:

- **FALTANDO no banco**: `0024_motor_progresso` → **`exit 1` / "NÃO publique o front"**
- **DRIFT no banco**: `0022_motor_progresso`

…apesar de o schema do motor de progresso estar **100% aplicado**
(`aluno_eventos_progresso` com 991 linhas; funções/triggers presentes).
Ou seja: a guarda de paridade estava **vermelha por um falso negativo**,
o que (a) bloqueia publicações legítimas e (b) treina o operador a
ignorar a guarda — mascarando drift **real** no futuro. É exatamente a
"armadilha de `db push`" apontada na auditoria anterior, **ainda
presente** no início da DB1.

> Causa raiz provável: o motor de progresso foi aplicado primeiro como
> `0022_motor_progresso` (2026-06-19 00:46), e depois renumerado no
> repositório para `0024` quando `0022_logs_coordenacao` e `0023_indices`
> entraram. O ledger nunca foi alinhado.

## 3. Classificação da divergência

| Divergência | Classe | Risco |
|---|---|---|
| `0024_motor_progresso` (repo) vs `0022_motor_progresso` (ledger) | **precisa migration de reconciliação** | guarda vermelha + risco de drift mascarado; **não** é risco de schema (objeto já aplicado) |
| `supabase db push` como caminho de deploy | **risco conhecido** | os arquivos `000N_*` não são timestamp; `db push` interpretaria todos como não aplicados → **NÃO usar `db push`**; manter MCP/pipeline + a guarda de nome |

Nenhuma migration ausente de schema, nenhuma migration destrutiva
pendente, nenhum objeto faltando.

## 4. Resolução aplicada na DB1 (não destrutiva)

Reconciliação **somente de metadado** do ledger (nenhum schema/dado
tocado), idempotente e guardada:

```sql
update supabase_migrations.schema_migrations
   set name = '0024_motor_progresso'
 where name = '0022_motor_progresso';
```

Script versionado: `scripts/reconciliar-ledger-0024-motor-progresso.sql`.
**Aplicado ao projeto remoto em 2026-06-21.**

### Verificação pós-reconciliação

- Ledger agora contém `0024_motor_progresso` (e não mais
  `0022_motor_progresso`).
- **Paridade total**: 28 nomes no repo == 28 nomes no ledger (incluindo a
  nova `0028_db1_indices_multitenant`).
- `checar-migrations.mjs` passaria verde (não executável aqui por não
  haver `SUPABASE_DB_URL` de produção no contêiner de auditoria; a
  paridade foi confirmada por consulta direta ao ledger via MCP).

## 5. Recomendações

- **P1 (operacional):** documentar em runbook que o deploy de migrations
  é via MCP/pipeline e que **`supabase db push` não deve ser usado** com
  o esquema de nomes `000N_*` atual. Alternativa de longo prazo (DB2/S2):
  migrar para o padrão `<timestamp>_nome.sql` do Supabase CLI para
  destravar `db push` com segurança — **mudança maior, fora do escopo DB1.**
- Manter `checar-migrations.mjs` como gate de pré-publicação.
