# Runbook — Migrations do Supabase (Rumo à Aprovação)

> Objetivo: evitar que o operador use o comando errado e crie divergência
> entre repositório e banco. Leia **antes** de aplicar qualquer migration.
> Projeto: `bdjkgrzfzoamchdpobbl`. Criado na DB2 (2026-06-21).

## 0. Regra de ouro

**NÃO use `supabase db push` cegamente neste projeto.**

As migrations do repositório usam prefixo de **4 dígitos**
(`0001_…`, `0028_…`), **não** o timestamp que o Supabase CLI espera
(`<YYYYMMDDHHMMSS>_…`). O `db push` compara por `version` (o prefixo) e
**interpretaria todas as nossas migrations como não aplicadas**, tentando
reaplicar tudo do zero → conflito massivo em produção. O deploy real é
feito via **MCP `apply_migration`** (ou pipeline equivalente), que grava
no ledger `supabase_migrations.schema_migrations` com `version` = timestamp
e `name` = nome do arquivo.

## 1. Como comparar local × remoto

A guarda oficial compara por **NOME** (não por version):

```bash
cd tests   # tem o pacote `pg`
SUPABASE_DB_URL="postgresql://postgres:SENHA@HOST:5432/postgres" \
  node ../scripts/checar-migrations.mjs
```

Saída e exit codes:
- `0` = repo e banco em dia (paridade de nomes).
- `1` = **faltam** migrations no banco (no repo, não no banco) → NÃO publique o front.
- `2` = erro de conexão/uso.

Também acusa **drift** (no banco, não no repo) — investigar sempre.

> A string de conexão **nunca** entra no repositório. Use variável de
> ambiente local/secret.

## 2. Como validar o ledger diretamente

Via MCP (read-only) ou psql:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
-- conferir que o último nome == última migration do repo
```

## 3. Como aplicar uma migration segura

1. Escreva `supabase/migrations/00NN_descricao.sql` (próximo número livre,
   4 dígitos, contínuo).
2. **Teste local primeiro**: `bash tests/reset-db.sh` (aplica tudo +
   seed 2×) e `cd tests && node --test` (suíte verde).
3. Prefira DDL **idempotente** (`create index if not exists`,
   `drop policy if exists` + `create policy`, `create or replace function`).
4. Aplique ao remoto via MCP `apply_migration` com `name = "00NN_descricao"`
   (o mesmo nome do arquivo — isso mantém a paridade da guarda).
5. Rode `get_advisors` (security + performance) depois de DDL.
6. Confirme a paridade (passo 1/2).

## 4. Se o remoto tiver numeração diferente / migration aplicada sob outro nome

Foi o caso real do motor de progresso: aplicado como `0022_motor_progresso`
mas versionado no repo como `0024_motor_progresso` — a guarda ficava
vermelha (falso "falta migration"). **Reconciliação não destrutiva**
(só metadado, alinha o ledger ao repo, que é a fonte canônica):

```sql
-- ver scripts/reconciliar-ledger-0024-motor-progresso.sql (guardado/idempotente)
update supabase_migrations.schema_migrations
   set name = '<nome-canônico-do-repo>'
 where name = '<nome-antigo-no-banco>';
```

Só faça isso quando **provar** que o schema já está aplicado (objetos
existem) e que a diferença é apenas de nome/numeração. Nunca reaplique o
DDL por cima.

## 5. Checklist antes / depois

**Antes:**
- [ ] número da migration é o próximo contínuo (4 dígitos)?
- [ ] DDL é idempotente?
- [ ] não há `drop table`/`truncate`/`delete`/`drop column`/`rename` sem autorização explícita?
- [ ] testado em `reset-db.sh` + suíte verde?

**Depois:**
- [ ] `apply_migration` retornou sucesso?
- [ ] `get_advisors` sem novos ERRORs/WARNs inesperados?
- [ ] paridade nome repo == ledger?
- [ ] RLS intacta (escola suspensa ainda bloqueia; aluno/responsável/coordenação/superadmin ok)?

## 6. Rollback básico

- DDL aditivo (índice/policy/comment): reverter com a operação inversa
  numa nova migration (`drop index if exists`, recriar policy anterior).
  **Não** edite migrations já aplicadas — crie uma nova.
- Para mudanças de policy, mantenha o SQL da policy anterior no relatório
  da fase (ex.: `docs/auditoria/db2/01-policies-duplicadas.md`) para
  recriação rápida.
- Mudança destrutiva (drop/truncate) **exige** backup válido antes —
  ver pendência de backup (plano free não tem backup automático).

## 7. Quem pode executar

- Migrations de produção: **dono/operador** com credencial de serviço.
- Nunca expor `service_role` no front (já garantido: o front usa só a
  chave `anon`).
- O super admin de produto opera via RPCs `backoffice_*` (gate
  `eh_super_admin` no banco), **não** via SQL direto.
