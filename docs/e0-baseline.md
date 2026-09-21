# Etapa 0 — Baseline do Triliva

**Data da coleta:** 21/09/2026 (todas as consultas entre 15:02 e 15:35 UTC).
**SHA de referência:** `824024cfb879deffe5ad14e11b154ed87a34dabd`.
**Natureza:** inventário. Não corrige, não refatora, não implementa.

## Regra de evidência

Cada item traz a consulta usada, a saída, o caminho de arquivo com linha ou o ID.
Item sem evidência entra como **NÃO VERIFICADO** e não vale como fato. Contagem
antiga não foi copiada: tudo foi reconferido nesta data.

## Travas respeitadas

- Banco: somente leitura nos dois ambientes. Nenhum `apply_migration`, `db push`,
  `db reset`, DDL, DML ou seed. Todo SQL emitido aqui é `SELECT`.
- Produção: nenhuma alteração de qualquer natureza.
- Nenhum valor de secret neste documento. Nome, ambiente, consumidor e
  presença/ausência: sim. Valor: nunca.
- A migration `0051` **não** foi aplicada em lugar nenhum.

## Acesso desta sessão

| Ferramenta | Escopo alcançado | Evidência |
| --- | --- | --- |
| MCP Supabase | Org `ddsfpmyxbitaghvhadov` listada; projeto de produção `zckyhihxjjbnqjqilymn` (org `eerbpzacxolwlwsltynb`) **alcançável por ID direto** | `list_organizations` devolve só `ddsfpmyxbitaghvhadov`; `get_project(zckyhihxjjbnqjqilymn)` devolve `organization_id: eerbpzacxolwlwsltynb`, `status: ACTIVE_HEALTHY` |
| MCP Vercel | Team `team_HGbYWWgqoeNAnijAuJuThqLA` ("Jinriuk's projects", plano `hobby`); os dois projetos | `list_teams`, `list_projects` |
| MCP GitHub | `Jinriuk/Rumo-a-aprova-o-` | `list_pull_requests`, `actions_list`, `get_file_contents` |

**O `list_projects` do MCP Supabase não lista o projeto de produção, mas
`get_project`, `list_migrations`, `list_edge_functions`, `execute_sql`,
`get_advisors` e `query_logs` por ID respondem normalmente.** Não confiar no
`list_projects` como inventário: ele mede a organização conectada, não o alcance
do token.

### O que esta sessão NÃO alcança

| Item | Por quê | Consequência |
| --- | --- | --- |
| Valores e presença dos secrets do GitHub Actions | Não há ferramenta de leitura de secrets no MCP GitHub, e ler valor é proibido pela trava 3 | A presença foi deduzida do **log de execução**, não da listagem — ver Bloco 3 |
| Variáveis de ambiente das Edge Functions do Supabase | Não expostas por nenhuma ferramenta do MCP | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` consumidas por `capture-oidc-20260919` ficam como **NÃO VERIFICADO** quanto à presença |
| Autoria da Edge Function `capture-oidc-20260919` | O audit log da organização Supabase não é exposto por MCP | "Quem criou" no Bloco 4 é inferência a partir do código, não registro |

---

# Bloco 1 — Ponto de partida

## Branch, SHA, working tree

| Item | Valor | Evidência |
| --- | --- | --- |
| Branch local | `claude/triliva-e0-baseline-izhpmg` | `git branch --show-current` |
| SHA | `824024cfb879deffe5ad14e11b154ed87a34dabd` | `git rev-parse HEAD` |
| `main` remota | `824024cfb879deffe5ad14e11b154ed87a34dabd` (mesmo SHA) | `git ls-remote --heads origin` |
| Working tree | limpo antes desta etapa | `git status --porcelain` sem saída |
| Remote | `https://github.com/Jinriuk/Rumo-a-aprova-o-` | `git remote -v` |

Último commit: `824024c` — "Corrige a Trilha do Concurso, morta desde a Onda 5 por
coluna inexistente (#117)".

## Branches remotas

| Branch | SHA |
| --- | --- |
| `main` | `824024cf…` |
| `claude/claude-code-next-steps-uqxhw8` | `eb651a0b…` |
| `claude/corrige-trilha-coluna-inexistente` | `62abef27…` |
| `dependabot/npm_and_yarn/app/app-deps-cf0c566b26` | `37049e28…` |
| `tmp/triliva-pack-build-20260919` | `d4b03d7b…` |

`tmp/triliva-pack-build-20260919` **continua existindo**. É a branch que a
`capture-oidc-20260919` aceita na claim `ref` — ver Bloco 4.

## PRs abertos

| # | Título | Autor | Head | CI |
| --- | --- | --- | --- | --- |
| 118 | `deps(app): bump the app-deps group across 1 directory with 8 updates` | `dependabot[bot]` | `37049e28…` | **failure** |

Evidência do CI: run `35548719180` (event `pull_request`) e `35548716648` (event
`push`), ambos `conclusion: failure`. O mesmo commit quebra o build nos dois
projetos Vercel: deployment `dpl_D4NRVfUYNqyrJTvWiQhYvVJyQC9Y` com
`errorCode: module_not_found`, `errorMessage: Command "cd app && npm install && npm run build" exited with 1`.

Este PR sobe 8 pacotes de uma vez, incluindo dois majors (`eslint` 9→10,
`@eslint/js` 9→10). Não é escopo da Etapa 0 resolver; fica registrado.

## Workflows

| Arquivo | Gatilho | Depende de secret? | Estado observado |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | `push`, `pull_request`, `workflow_dispatch` | `build-e-unitarios` não; `e2e` sim (`E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY`) | Verde na `main`; job `e2e` **skipped** |
| `.github/workflows/codeql.yml` | `push`/`PR` em `main`, `schedule` seg 04:27 UTC | Não | — |
| `.github/workflows/manter-banco-acordado.yml` | `schedule` diário 06:17 UTC, `workflow_dispatch` | Sim, quatro (ver Bloco 3) | Verde e **inoperante** — ver Bloco 3 |

Não existe template de PR no repositório (`.github/` tem só `dependabot.yml` e
`workflows/`; nenhum `pull_request_template.md` em lugar nenhum).

## Scripts em `scripts/`

Nenhum é chamado por CI. Todos são de operador (rodam na máquina de quem opera) ou
geradores de seed rodados à mão.

| Script | O que faz | Quem chama | Credencial que exige |
| --- | --- | --- | --- |
| `_pg.mjs` | Resolve o pacote `pg` a partir de `tests/node_modules` para os scripts de operador | `checar-migrations.mjs` | — |
| `checar-migrations.mjs` | Compara `supabase/migrations/*.sql` × `supabase_migrations.schema_migrations` e sai com `exit 1` se faltar | Operador, à mão | `SUPABASE_DB_URL` |
| `corrigir-senha-codigo-0093.mjs` | Corrige senha de contas `@codigo.acesso.local` afetadas pelo bug de login-por-código | Operador, à mão | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `criar-coordenacao.mjs` | Provisiona a conta de coordenação de uma escola (Auth + `usuarios`) | Operador, à mão | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `criar-super-admin.mjs` | Cria/atualiza `SUPER_ADMIN` do backoffice (Auth + `internal_admins`) | Operador, à mão | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `fingerprint-schema.sql` | Fingerprint de schema (12 categorias + TOTAL) para paridade real entre ambientes | Operador, via `psql` | Conexão de leitura |
| `gerar-seed-espcex-ped2-r3.mjs` | Gera `supabase/seed/19_espcex_ped2_r3.sql` da fonte JSON | Operador, à mão | — (offline) |
| `gerar-seed-maturidade.mjs` | Gera `supabase/seed/18_maturidade_concursos.sql` de `app/src/modules/conteudo/maturidade.js` | Operador, à mão | — (offline) |
| `gerar-seed-trilha-espcex.mjs` | Gera `supabase/seed/20_trilha_espcex.sql` | Operador, à mão | — (offline) |
| `gerar-seed-trilha.mjs` | Gera `supabase/seed/02_trilha_cn.sql` | Operador, à mão | — (offline) |
| `reconciliar-ledger-0024-motor-progresso.sql` | Reconciliação pontual de ledger (0024) | Operador, via `psql` | Conexão de escrita |
| `seed-auth-usuarios.mjs` | Cria contas de Auth correspondentes ao seed SQL. Cabeçalho diz "NÃO rodar contra produção real" | Operador, à mão | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `validar-conteudo.mjs` | Valida maturidade × conteúdo real dos seeds, offline, `exit 1` em furo | Operador, à mão | — (offline) |

**Consequência para a Etapa 1:** `checar-migrations.mjs` compara repo × ledger — o
que o banco *diz* que rodou. `fingerprint-schema.sql` compara schema × schema — o
que o banco *é*. Os dois são necessários, e por motivos diferentes, como o Bloco 2
demonstra.

---

# Bloco 2 — Matriz de ambientes

## Identidade e disponibilidade

| | DEMO / VITRINE | PRODUÇÃO |
| --- | --- | --- |
| Projeto Supabase | `bdjkgrzfzoamchdpobbl` — "Rumo à Aprovação — Teste e Vitrine" | `zckyhihxjjbnqjqilymn` — "Rumo a aprovação produção" |
| Organização | `ddsfpmyxbitaghvhadov` | `eerbpzacxolwlwsltynb` |
| Região | `us-east-1` | `sa-east-1` |
| Status | `ACTIVE_HEALTHY` | `ACTIVE_HEALTHY` |
| Criado em | 2026-06-10T21:37:43Z | 2026-09-03T14:50:42Z |
| Versão do Postgres (painel) | `17.6.1.127` | `17.6.1.166` |
| `select version()` | `PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit` | idem (engine 17, canal `ga`) |
| Projeto Vercel | `rumo-a-aprova-o` (`prj_Q7tcLOOTptRgdTrfIUoDFWJDx0oO`) | `triliva-producao` (`prj_MtYFKuo7VT0cO6vGAYmtoNwUXdfC`) |

Evidência: `list_projects`, `get_project` (Supabase) e `execute_sql` com
`select version()`.

As duas instâncias rodam builds **menores** que 17.6.1.166 no demo. Diferença de
patch, mesmo engine. Registrado, não é achado.

## Ledger de migrations

| | DEMO | PRODUÇÃO |
| --- | --- | --- |
| Linhas no ledger | **52** | **52** |
| Linhas com `statements` preenchido | **52** | **6** |
| Linhas com `statements` vazio/nulo | **0** | **46** |
| Primeira `version` | `20260611005028` | `20260903150001` |
| Última `version` | `20260917210946` (`0050_virada_saude_resultado`) | `20260917211007` (`0050_virada_saude_resultado`) |

Consulta usada (idêntica nos dois):

```sql
select count(*) as total_ledger,
       count(*) filter (where statements is null) as sem_statements,
       count(*) filter (where coalesce(array_length(statements,1),0) = 0) as statements_vazio
from supabase_migrations.schema_migrations;
```

Saída demo: `{"total_ledger":52,"sem_statements":0,"statements_vazio":0}`
Saída produção: `{"total_ledger":52,"sem_statements":46,"statements_vazio":46,"bloco_bootstrap_030926":46}`

### As 6 linhas de produção que preservam SQL

| version | name | bytes de SQL |
| --- | --- | --- |
| `20260906182011` | `0046_aluno_pendente_configuracao` | 3569 |
| `20260907125843` | `0047_revogar_execute_rls_auto_enable` | 750 |
| `20260909085121` | `0047_credencial_senha_temporaria` | 1078 |
| `20260913072915` | `0049_backfill_ledger_onda25` | 4405 |
| `20260913084245` | `0049_estado_ciclo` | 3379 |
| `20260917211007` | `0050_virada_saude_resultado` | 2662 |

### Por que 46 linhas de produção não têm SQL

A migration `0049_backfill_ledger_onda25` (só produção) é um `INSERT` de 46 linhas
em `supabase_migrations.schema_migrations`, com `created_by = 'backfill-onda2.5'`.
O próprio cabeçalho dela explica: o projeto de produção foi criado em 03/09 **a
partir do demo — veio o schema e não veio o ledger**. As `version`
`20260903150001`…`20260903150046` são sintéticas; não marcam quando a migration
rodou, marcam a ordem em que foram registradas.

Trecho literal (obtido por `select array_to_string(statements, E'\n') … where version = '20260913072915'`):

```
-- ONDA 2.5 — backfill do ledger de produção.
-- Registra as 46 migrations cujo EFEITO já está no schema mas que nunca
-- entraram em supabase_migrations.schema_migrations: o projeto foi criado
-- em 03/09 a partir do demo, veio o schema e não veio o ledger.
```

**Consequência direta para a Etapa 1:** a reconciliação por *diff de conteúdo* do
ledger funciona no demo (52/52 com SQL) e **não funciona em produção** para as 46
linhas do bootstrap. Lá só existem nome e version. O caminho em produção é
comparação de schema, não de texto.

## Diff: arquivos do repo × ledger

`supabase/migrations/` tem **52** arquivos `.sql`.

| Comparação | Resultado |
| --- | --- |
| Arquivo sem linha no ledger **DEMO** | `0051_proxima_edicao_trilha` |
| Linha no ledger **DEMO** sem arquivo | `0049_normalizar_nome_ledger_onda25` |
| Arquivo sem linha no ledger **PRODUÇÃO** | `0051_proxima_edicao_trilha` |
| Linha no ledger **PRODUÇÃO** sem arquivo | `0049_backfill_ledger_onda25` |
| Diferença DEMO × PRODUÇÃO (nomes) | só essas duas linhas: demo tem `0049_normalizar_nome_ledger_onda25`, produção tem `0049_backfill_ledger_onda25` |

Método: `ls supabase/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//' | sort`
contra a saída de `list_migrations` de cada projeto, comparadas com `comm` e `diff`.

Os dois arquivos ausentes do repo são **operações de ledger**, não de schema:

- `0049_normalizar_nome_ledger_onda25` (demo, `20260913073303`, 624 bytes):
  `update supabase_migrations.schema_migrations set name = '0047_credencial_senha_temporaria' where name = 'credencial_senha_temporaria';`
  Corrige um nome que entrou sem prefixo por ter sido aplicado via
  `apply_migration` do MCP. Não toca schema nem dado.
- `0049_backfill_ledger_onda25` (produção, `20260913072915`, 4405 bytes):
  `INSERT` das 46 linhas descritas acima. Sem DDL.

**Nenhum dos dois deve virar migration de aplicação.** Cada um conserta o ledger
de um ambiente específico, e o ambiente oposto não tem o problema que ele resolve.

O `0051_proxima_edicao_trilha.sql` existe no repo e **não está aplicado em nenhum
dos dois ambientes**.

## Paridade real de schema — fingerprint

`scripts/fingerprint-schema.sql` rodado nos dois bancos nesta data, sem alteração
no script (só `SELECT`), sobre os schemas `public` e `app`:

| categoria | itens | hash (idêntico nos dois) |
| --- | --- | --- |
| `acl_funcoes` | 63 | `91708920aa43aeedbecb13b94107da81` |
| `acl_tabelas` | 49 | `c6aeb858b05593daf95614a35fcae374` |
| `colunas` | 401 | `1b4540774071b1582b5536a2295f4376` |
| `constraints` | 224 | `cea63e91518b02d6a4a826cddcd2d0b5` |
| `event_triggers` | 7 | `a31e20c1bba307e973787d883b05b28b` |
| `funcoes` | 63 | `d42aa5b711732828c087f591a55a94c0` |
| `indices` | 145 | `30e0787123c93612df26d2b5626a343e` |
| `policies` | 85 | `73913face3f2efeac82f4b7558fb678d` |
| `tabelas` | 49 | `50d476584cdfc3256f12ac1e09888a84` |
| `triggers` | 7 | `337a66ef47cea4a8df22e2a72aaeda0c` |
| `views` | 3 | `e367437cf5b16533751c794eb5b20c3d` |
| **TOTAL** | **1096** | **`61c4aa665eec10642718f3b0b9d628ce`** |

**Os 12 hashes batem, categoria por categoria.** Demo e produção têm schema
idêntico em `public` + `app`. A divergência de ledger documentada acima é
contábil, não estrutural.

## `abrir_proximo_ciclo`

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('abrir_proximo_ciclo','estado_ciclo');
```

| Ambiente | Resultado |
| --- | --- |
| DEMO | uma linha: `app.estado_ciclo(p_trilha uuid, p_data date, OUT estado text, OUT semana_numero integer)`. **`abrir_proximo_ciclo` não existe em nenhum schema.** |
| PRODUÇÃO | idêntico. **`abrir_proximo_ciclo` não existe em nenhum schema.** |

O front chama por RPC: `app/src/shared/data/index.js:368` —
`supabase.rpc("abrir_proximo_ciclo", { p_trilha, p_ancora, p_alunos })`.
Chamadores: `app/src/modules/escola/ProximoCiclo.jsx:84` (via
`db.abrirProximoCiclo`).

A `0051` define as duas faces:
`app.abrir_proximo_ciclo(uuid, date)` (`supabase/migrations/0051_proxima_edicao_trilha.sql:61`)
e `public.abrir_proximo_ciclo(uuid, date, uuid[])` (linha 139), sendo esta última
a assinatura de 3 argumentos que o front usa.

**A tela do próximo ciclo está morta nos dois ambientes**, não só no demo.

## Edge Functions publicadas

### DEMO (`bdjkgrzfzoamchdpobbl`) — 8 funções, todas `ACTIVE`

| slug | versão | `verify_jwt` | `updated_at` | `ezbr_sha256` |
| --- | --- | --- | --- | --- |
| `provisionar-aluno` | 7 | `false` | 2026-09-11 | `402c5f3c…` |
| `gerar-meta` | 7 | `false` | 2026-09-11 | `28e7a1cd…` |
| `virar-semana` | 5 | `false` | 2026-09-11 | `deef4ac7…` |
| `lgpd-titular` | 5 | `false` | 2026-09-11 | `79cfb079…` |
| `backoffice-coordenador` | 8 | `false` | 2026-09-11 | `f1cd2e67…` |
| `revogar-responsavel` | 5 | `false` | 2026-09-11 | `6e90f899…` |
| `trocar-senha` | 2 | `false` | 2026-09-11 | `d4313842…` |
| **`capture-oidc-20260919`** | **2** | **`true`** | **2026-09-19** | `d74f6c50…` |

### PRODUÇÃO (`zckyhihxjjbnqjqilymn`) — 7 funções, todas `ACTIVE`

| slug | versão | `verify_jwt` | `ezbr_sha256` |
| --- | --- | --- | --- |
| `backoffice-coordenador` | 4 | `false` | `f1cd2e67…` |
| `provisionar-aluno` | 4 | `false` | `402c5f3c…` |
| `revogar-responsavel` | 3 | `false` | `6e90f899…` |
| `gerar-meta` | 4 | `false` | `28e7a1cd…` |
| `lgpd-titular` | 3 | `false` | `79cfb079…` |
| `virar-semana` | 3 | `false` | `deef4ac7…` |
| `trocar-senha` | 2 | `false` | `d4313842…` |

**Os 7 `ezbr_sha256` de produto batem byte a byte entre os dois ambientes.** Os
números de versão diferem (o demo recebeu mais deploys), o conteúdo publicado não.

A oitava função do demo, `capture-oidc-20260919`, **não existe em produção**. É a
única com `verify_jwt: true` e a única sem contraparte em `supabase/functions/`
no repositório. Triagem no Bloco 4.

## Advisors de segurança

`get_advisors(type: security)` nos dois projetos devolve **exatamente o mesmo
conjunto**:

| lint | nível | count | achados |
| --- | --- | --- | --- |
| `rls_enabled_no_policy` | INFO | 2 | `app.acessos_codigo`, `app.login_tentativas` |
| `authenticated_security_definer_function_executable` | WARN | 11 | 8 `backoffice_*`, `resumo_escola`, `salvar_onboarding_aluno`, `sou_super_admin` |
| `auth_leaked_password_protection` | WARN | 1 | proteção contra senha vazada desligada |

Observado em 2026-09-21T15:13:16Z (demo) e 15:18:36Z (produção).

Nota histórica que o fingerprint torna verificável: o cabeçalho de
`scripts/fingerprint-schema.sql` registra que em 07/09/2026 a RLS em
`app.acessos_codigo` e `app.login_tentativas` estava ligada **só em produção**.
Hoje os dois advisors aparecem nos dois ambientes e o hash de `tabelas` é
idêntico — a assimetria foi fechada.

## Vercel — domínios, proteções, deployment

| | `rumo-a-aprova-o` (DEMO) | `triliva-producao` (PRODUÇÃO) |
| --- | --- | --- |
| ID | `prj_Q7tcLOOTptRgdTrfIUoDFWJDx0oO` | `prj_MtYFKuo7VT0cO6vGAYmtoNwUXdfC` |
| Domínios | `trilivaedu.com.br` (redirect 308 → www), `www.trilivaedu.com.br`, `rumo-a-aprova-o.vercel.app` | `app.trilivaedu.com.br`, `triliva-producao.vercel.app` |
| `passwordProtection` | desligada | desligada |
| `ssoProtection` | **ligada**, `all_except_custom_domains` | **ligada**, `all_except_custom_domains` |
| `trustedIps` | desligado | desligado |
| `nodeVersion` | `24.x` | `24.x` |
| Framework | `null` (build manual via `vercel.json`) | `null` |

`ssoProtection: all_except_custom_domains` significa: o domínio público está
aberto, mas todo preview e todo `*.vercel.app` exige login Vercel.

### Último deployment de produção (target `production`)

| Projeto | Deployment | SHA | Branch | Estado |
| --- | --- | --- | --- | --- |
| `rumo-a-aprova-o` | `dpl_ERNQMTiC3aaaawnhhD15iDqMwc5s` | `824024cfb879deffe5ad14e11b154ed87a34dabd` | `main` | `READY` |
| `triliva-producao` | `dpl_3xvfGR4g3Z6XbsGDgKFbE8NvBBNH` | `824024cfb879deffe5ad14e11b154ed87a34dabd` | `main` | `READY` |

Os dois projetos estão no mesmo SHA, que é o SHA de referência desta auditoria.

### Último deployment de qualquer target

Os dois projetos têm `latestDeployment.readyState: ERROR`:
`dpl_D4NRVfUYNqyrJTvWiQhYvVJyQC9Y` (demo) e `dpl_GrZzpw2vg4wJySgkL92WGbKjs6AU`
(produção), ambos do commit `37049e28…` da branch do Dependabot. `errorCode:
module_not_found`. Produção **servida** continua no `824024cf…`; o que quebrou foi
o preview.

Registro operacional: **os dois projetos constroem preview de toda branch do
repositório**, incluindo branches de bot. Um PR quebrado deixa os dois painéis
vermelhos ao mesmo tempo sem que nada em produção tenha mudado.

### Variáveis de ambiente, por nome

Nenhum valor foi lido (`decrypt` não foi usado; a API devolveu `value: ""` e
`decrypted: false` em todas).

#### DEMO — 2 variáveis

| Nome | Target | Tipo | Consumidor no código |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `preview`, `production` | `sensitive` | `app/src/lib/supabase.js:6` |
| `VITE_SUPABASE_ANON_KEY` | `preview`, `production` | `sensitive` | `app/src/lib/supabase.js:7` |

#### PRODUÇÃO — 8 variáveis

| Nome | Target | Tipo | Consumidor real no código | Avaliação |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `production`, `preview` | `sensitive` | `app/src/lib/supabase.js:6` | correto |
| `VITE_SUPABASE_ANON_KEY` | `production`, `preview` | `sensitive` | `app/src/lib/supabase.js:7` | correto |
| `SUPABASE_URL` | `production`, `preview` | `sensitive`, `visibility: secret` | só `scripts/*.mjs` (operador) — nenhum consumidor no build | escopo indevido |
| `SUPABASE_SERVICE_ROLE_KEY` | `production`, `preview` | `sensitive`, `visibility: secret` | só `scripts/*.mjs` (operador) — `seed-auth-usuarios.mjs:15`, `corrigir-senha-codigo-0093.mjs:30`, `criar-coordenacao.mjs`, `criar-super-admin.mjs` | **escopo indevido** |
| `PGHOST` | `production`, `preview` | `sensitive`, `visibility: secret` | só `tests/` — `tests/reset-db.sh:7`, `tests/identidades.mjs:7` | escopo indevido |
| `PGPORT` | `production`, `preview` | `sensitive`, `visibility: secret` | só `tests/` — `tests/reset-db.sh:8` | escopo indevido |
| `PGUSER` | `production`, `preview` | `sensitive`, `visibility: secret` | só `tests/` — `tests/reset-db.sh:9` | escopo indevido |
| `PGDATABASE` | `production`, `preview` | `sensitive`, `visibility: secret` | só `tests/` — `tests/reset-db.sh:10` | escopo indevido |

O build do Vercel é `cd app && npm install && npm run build` (`vercel.json`). O
Vite só incorpora no bundle variáveis com prefixo `VITE_`; nenhuma das seis
variáveis marcadas acima tem esse prefixo. **Não há vazamento no bundle.** O
problema é que a chave de serviço fica disponível no ambiente de build de todo
deploy, inclusive preview de branch de bot — um passo de build hostil a
alcançaria. É superfície desnecessária, não vazamento consumado.

### `VITE_APP_ENV` — confirmado ausente, e mais amplo que o esperado

| Onde | `VITE_APP_ENV` presente? |
| --- | --- |
| Projeto Vercel demo | **não** |
| Projeto Vercel produção | **não** (correto por desenho) |
| `app/.env.production` (versionado) | **não** |

`app/src/shared/branding/ambiente.js:5` faz
`export const EH_DEMO = import.meta.env.VITE_APP_ENV === "demo";` e o comentário
das linhas 2–4 documenta que a variável "só é definida no projeto Vercel de
demo/vitrine". Ela não está definida em lugar nenhum. **`EH_DEMO` é `false` em
todo build, inclusive na vitrine.**

Com `EH_DEMO` sempre falso, a faixa "AMBIENTE DE DEMONSTRAÇÃO" depende só de
`escolaEhDemo` (`app/src/shared/branding/demoEscola.js`), que classifica pela
**escola carregada do banco**. Duas consequências, as duas já registradas no
próprio código:

1. Antes de haver escola carregada (tela de entrada), não há sinal nenhum.
2. A vitrine tem `status = 'ativa'`, não `'demo'` — a migration `0031` fez isso de
   propósito. A cobertura depende de `categoriaEscola` acertar a classificação.

### Risco de fallback silencioso — achado novo

`app/.env.production` **é versionado** (`.gitignore` tem `!app/.env.production`) e
contém `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` apontando, pelo comentário
do próprio arquivo, para **o projeto de demo `bdjkgrzfzoamchdpobbl`**.

Hoje isso não causa dano: variáveis `VITE_*` presentes em `process.env` têm
precedência sobre `.env.production` no Vite, e o projeto `triliva-producao` define
as duas. Mas o default do repositório é o banco de demo. Se as duas variáveis
sumirem do projeto Vercel de produção, o build de produção passa a apontar para o
banco da vitrine **sem erro, sem aviso e sem falhar o build** — `supabase.js:11`
só lança quando as duas estão vazias, e elas não estariam.

Classificação: dependência da Etapa 1/2. Não corrigido aqui.

### CSP

`vercel.json` fecha `connect-src 'self' https://*.supabase.co wss://*.supabase.co`.
Qualquer coletor de erro externo é bloqueado pelo navegador. O gancho já existe em
`app/src/shared/lib/observabilidade.js:9` (`VITE_ERROR_REPORT_URL`) e está
desligado. Registrado como **dependência da Etapa 4**. Não corrigido aqui.

---

# Bloco 3 — Disponibilidade e sinal

## Estado dos projetos Supabase

| Projeto | Status | Evidência |
| --- | --- | --- |
| `bdjkgrzfzoamchdpobbl` (demo) | `ACTIVE_HEALTHY` | `get_project` em 21/09/2026 15:0x UTC |
| `zckyhihxjjbnqjqilymn` (produção) | `ACTIVE_HEALTHY` | `get_project` em 21/09/2026 15:0x UTC |

Os outros dois projetos da org `ddsfpmyxbitaghvhadov` (`barbearia-saas`,
`pool-poker`) estão `INACTIVE`. Não são do Triliva; registrados só para o
inventário ficar fechado.

## O keepalive está verde e não faz nada

`manter-banco-acordado.yml` tem 10 execuções, **todas com `conclusion: success`**.
O sucesso é enganoso.

Log do run mais recente (`35601170221`, job `106337364029`, 21/09/2026 12:43:18Z):

```
env:
  URL:
  ANON:
##[warning]PULADO — sem PROD_SUPABASE_URL / PROD_SUPABASE_ANON_KEY. O projeto de
produção NÃO está sendo mantido acordado, e pode pausar após 7 dias sem uso.
...
env:
  URL:
  ANON:
##[warning]PULADO — sem DEMO_SUPABASE_URL / DEMO_SUPABASE_ANON_KEY. A VITRINE não
está sendo mantida acordada, e pode pausar após 7 dias sem uso.
```

Os dois steps começam e terminam em `2026-09-21T12:43:18Z` — zero segundo, nenhum
`curl` emitido.

**Os quatro secrets não existem.** Nem produção, nem demo estão sendo mantidos
acordados. O workflow reporta verde porque o caminho de "PULADO" sai com
`exit 0` — exatamente como o próprio arquivo documenta (linhas 73–78 e 125–130):
ele avisa em vez de falhar, de propósito. O aviso só aparece dentro do log.

| Secret esperado | Consumidor | Escopo onde precisa existir | Presente? |
| --- | --- | --- | --- |
| `PROD_SUPABASE_URL` | `manter-banco-acordado.yml:68` | Repositório (`Settings → Secrets and variables → Actions`) | **não** |
| `PROD_SUPABASE_ANON_KEY` | `manter-banco-acordado.yml:69` | idem | **não** |
| `DEMO_SUPABASE_URL` | `manter-banco-acordado.yml:120` | idem | **não** |
| `DEMO_SUPABASE_ANON_KEY` | `manter-banco-acordado.yml:121` | idem | **não** |

O job não declara `environment:`, então os secrets precisam ser visíveis no escopo
de repositório — como *repository secrets* diretos, ou herdados de *organization
secrets* se o dono for organização. Não há caminho por *environment secret* sem
mudar o workflow.

**Valores não foram lidos e não devem ser trazidos por este canal.** A presença foi
determinada pelo log, não pela listagem.

## O E2E também é pulado

`ci.yml:135` — `if: needs.e2e-guard.outputs.isolado == 'true'`.

Run `35483042364` na `main` (SHA de referência), jobs:

| job | conclusion |
| --- | --- |
| `e2e-guard` | `success` |
| `build-e-unitarios` | `success` |
| `e2e` | **`skipped`** |

O run inteiro fica `success`. Job pulado conta como sucesso em required check —
se `e2e` estiver na lista de checks obrigatórios do branch protection, ele não
protege nada. `E2E_SUPABASE_URL` não existe.

O gate que de fato roda é `build-e-unitarios`: lint, build, `reset-db.sh` duas
vezes, suíte `node --test`, mais a guarda anti-"verde vazio" que falha abaixo de
200 testes (`ci.yml:96-104`). Esse é o único gate real hoje, e ele é honesto.

## Prazo de validade do próprio seguro

`manter-banco-acordado.yml:22-27` registra que o GitHub desativa workflows
agendados após 60 dias sem atividade no repositório. Como o keepalive hoje é um
no-op, o risco composto é: projeto free pausa por 7 dias sem atividade de API, e o
workflow que existe para evitar isso está desligado de fato há pelo menos 10
execuções.

---

# Bloco 4 — Triagem da `capture-oidc-20260919`

**Escopo: diagnóstico. A retirada é da Etapa 2. Nada foi alterado.**

## Identidade

| Campo | Valor |
| --- | --- |
| ID | `476d325a-8b13-4368-8d14-c7d8e4a87e29` |
| Slug | `capture-oidc-20260919` |
| Projeto | `bdjkgrzfzoamchdpobbl` (demo). **Não existe em produção.** |
| Status | `ACTIVE`, versão `2` |
| `verify_jwt` | `true` |
| Criada em | 2026-09-19 (epoch `1789847997895`) |
| Atualizada em | 2026-09-19 (epoch `1789849294204`) |
| `ezbr_sha256` | `d74f6c5077ffc94acfda2a8926649fede5c184a338821dacc36d488e129bca20` |

## Quem criou

**NÃO VERIFICADO como registro.** O audit log da organização Supabase não é
exposto por MCP. O que o código permite afirmar:

- Foi escrita para um pipeline de captura de telas/artefatos do Triliva em
  19/09/2026 (o sufixo da data e a branch `tmp/` dizem isso).
- Não tem contraparte em `supabase/functions/` no repositório. `grep -rn
  "capture-oidc\|tmp-capture\|triliva-capture\|triliva-pack-build"` na árvore em
  `824024cf…` não devolve nada. Foi publicada fora do fluxo do repositório.

## O que ela faz

Código completo obtido por `get_edge_function`. Em ordem:

1. Recusa tudo que não for `POST` (405).
2. Exige o header `x-capture-oidc` (401 se ausente).
3. Verifica esse header como JWT OIDC do GitHub Actions contra o JWKS de
   `https://token.actions.githubusercontent.com`, com `audience: "triliva-capture-20260919"`.
4. Exige, nas claims: `repository == "Jinriuk/Rumo-a-aprova-o-"`,
   `ref == "refs/heads/tmp/triliva-pack-build-20260919"`, `event_name == "push"`,
   e `workflow_ref` contendo `.github/workflows/tmp-capture-triliva.yml@`.
5. Aceita um `profile` do corpo, mapeado para um de **cinco e-mails fixos** de
   demo (coordenação, um responsável e três alunos da escola Meridiano).
6. Instancia um cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY`.
7. Chama `auth.admin.generateLink({ type: "magiclink", email })` e **devolve o
   `hashed_token`** no corpo da resposta.

Em uma frase: **é um emissor de sessão que troca um token OIDC do GitHub por um
magic link válido para cinco contas do demo, usando a chave de serviço.**

## Alguma coisa ainda depende dela?

| Verificação | Resultado |
| --- | --- |
| Referências no repositório em `824024cf…` | **nenhuma** (`grep` em toda a árvore, exceto `.git`) |
| Workflow `.github/workflows/tmp-capture-triliva.yml` na branch `tmp/triliva-pack-build-20260919` | **não existe mais**. A branch tem só `ci.yml`, `codeql.yml`, `manter-banco-acordado.yml` e `tmp-export-triliva-dist.yml` |
| `tmp-export-triliva-dist.yml` chama a função? | **não**. Faz checkout do SHA `1ac7c642…`, `npm ci`, build com `app/.env.production`, empacota `dist` e sobe artefato com retenção de 1 dia |
| Invocações nas últimas 24h | **0** (`query_logs` em `function_edge_logs` filtrando `function_id = '476d325a-…'`, janela 20/09 15:00Z → 21/09 15:00Z; `max(timestamp)` devolve o sentinela `1970-01-01`) |

**Nada depende dela hoje.** Mas a trava de `workflow_ref` só vale enquanto o
arquivo `tmp-capture-triliva.yml` não voltar a existir — e a branch
`tmp/triliva-pack-build-20260919` **continua no remoto** (`d4b03d7b…`). Quem tem
push no repositório pode recriar o arquivo nessa branch e voltar a emitir sessões
para as cinco contas. A função não é alcançável hoje; ela é *rearmável*.

## O que precisa ser verificado antes da retirada (Etapa 2)

### 1. Sessões emitidas — existem, e não expiram sozinhas

```sql
select u.email, count(s.id) as sessoes, count(r.id) filter (where not r.revoked) as tokens_vivos
from auth.users u
left join auth.sessions s on s.user_id = u.id
left join auth.refresh_tokens r on r.session_id = s.id
group by 1;
```

| Conta (demo) | Sessões ativas | Refresh tokens não revogados | `last_sign_in_at` |
| --- | --- | --- | --- |
| `coordenacao@meridiano.demo` | 6 | 6 | 2026-09-19 21:29:06Z |
| `merihele2027@codigo.acesso.local` | 7 | 7 | 2026-09-19 21:29:06Z |
| `meriresp2027@codigo.acesso.local` | 6 | 6 | 2026-09-19 21:29:06Z |
| `merialun0003@codigo.acesso.local` | 0 | 0 | nunca |
| `merialun0007@codigo.acesso.local` | 0 | 0 | nunca |

19 sessões criadas em 2026-09-19 entre 15:58Z e 21:29Z. Uma vigésima sessão, de
`piloto2026a01@codigo.acesso.local`, é de 2026-06-24 e não tem relação com a
captura.

**Todas as 20 sessões têm `not_after = null`.** Não há expiração de sessão
configurada: elas ficam válidas indefinidamente enquanto o refresh token não for
revogado.

**Consequência para a Etapa 2:** apagar a Edge Function **não revoga nada**. A
retirada precisa de dois passos independentes:

1. remover a função (fecha a emissão de *novas* sessões);
2. revogar as sessões e os refresh tokens já emitidos (fecha o acesso *já
   concedido*).

Fazer só o passo 1 deixa três contas de demo — incluindo a **coordenação**, que é
o papel de maior privilégio da escola — com sessão viva e renovável por tempo
indeterminado.

### 2. Validade residual dos JWTs

**NÃO VERIFICADO.** O tempo de vida do access token (`JWT expiry`) é configuração
de projeto do Supabase Auth e não é exposto por nenhuma ferramenta deste MCP. Sem
esse número não dá para afirmar por quanto tempo um access token já emitido
continua aceito depois de a sessão ser revogada. Precisa ser lido no painel do
projeto antes da Etapa 2.

O que **está** verificado: com `not_after = null` e refresh token não revogado, a
sessão se renova indefinidamente, então a validade residual do access token é o
menor dos problemas — a renovação é o problema.

### 3. Ordem segura sugerida para a Etapa 2

Não é decisão desta etapa; fica o que o inventário sustenta:

1. Ler o `JWT expiry` do projeto demo no painel (fecha o item NÃO VERIFICADO).
2. Revogar as 19 sessões e os refresh tokens das cinco contas.
3. Remover a Edge Function `capture-oidc-20260919`.
4. Apagar a branch `tmp/triliva-pack-build-20260919`, que é a claim `ref` que a
   função exigia e a única coisa que a torna rearmável.
5. Confirmar se `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` seguem configuradas
   como variáveis de Edge Function no projeto demo e se alguma outra função
   precisa delas (hoje **NÃO VERIFICADO** — o MCP não lista variáveis de função).

---

# Apêndice — Reconferência dos achados (a) a (i)

| Achado | Veredito | O que a evidência mostra |
| --- | --- | --- |
| (a) `abrir_proximo_ciclo` não existe no demo; front chama em `index.js:368`; 0051 no repo; última aplicada é a 0050 | **Confirmado, e maior** | Confirmado no demo. **Também não existe em produção.** A última aplicada é a `0050` nos dois (`20260917210946` no demo, `20260917211007` em produção). A tela está morta nos dois ambientes, não só na vitrine. |
| (b) O ledger preserva o SQL; a reconciliação pode ser por diff de conteúdo | **Confirmado no demo, FALSO em produção** | Demo: 52/52 com `statements`. Produção: **46 das 52 linhas têm `statements` vazio** — são o backfill de 13/09. Diff de conteúdo não é caminho viável em produção. |
| (c) `0049_normalizar_nome_ledger_onda25` é `UPDATE` de metadado; não deve virar migration de aplicação | **Confirmado, com correção de escopo** | Confirmado, e o SQL foi lido na íntegra. **Mas essa migration só existe no demo.** Produção tem, na mesma posição, `0049_backfill_ledger_onda25` (`20260913072915`), que é outra coisa: um `INSERT` de 46 linhas. Os dois ambientes têm remendos de ledger *diferentes*. |
| (d) `if: needs.e2e-guard.outputs.isolado == 'true'`; job pulado conta como sucesso | **Confirmado** | `ci.yml:135`. Run `35483042364`: `e2e` com `conclusion: skipped`, run `success`. |
| (e) Produção tem `SUPABASE_SERVICE_ROLE_KEY`, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` em production+preview; Vite não incorpora; escopo indevido | **Confirmado, e há uma sexta** | As cinco confirmadas, mais `SUPABASE_URL` no mesmo caso. São **6** variáveis sem consumidor no build, não 5. Nenhuma tem prefixo `VITE_`; não há vazamento no bundle. |
| (f) Demo não tem `VITE_APP_ENV`; `EH_DEMO=false` na vitrine | **Confirmado, e mais amplo** | Não está no projeto Vercel de demo, nem no de produção, **nem em `app/.env.production`**. `EH_DEMO` é `false` em todo build existente. |
| (g) CSP fecha `connect-src`; coletor externo bloqueado | **Confirmado** | `vercel.json`, header `Content-Security-Policy`. Dependência da Etapa 4, não corrigida aqui. |
| (h) Step do demo sem `if: always()`; pulado se o de produção sair com `exit 1` | **Confirmado no código, sem efeito prático hoje** | `manter-banco-acordado.yml:112` não tem `if:`. Mas o step de produção hoje sai por `exit 0` (caminho "PULADO"), então nunca chega no `exit 1` da linha 110. A trava só vale quando os secrets existirem. Corrigido no PR 2 como endurecimento, não como conserto de sintoma ativo. |
| (i) `capture-oidc-20260919` ACTIVE no demo, versão 2, `verify_jwt` true | **Confirmado** | `list_edge_functions`. Detalhamento no Bloco 4. |

## Achados novos, fora da lista (a)–(i)

1. **Produção é alcançável por este MCP.** O `list_projects` não a mostra, mas
   todas as ferramentas de leitura respondem por ID. Nenhum item deste documento
   ficou PENDENTE por falta de acesso ao banco.
2. **Demo e produção têm schema idêntico.** Fingerprint de 12 categorias, 1096
   itens, TOTAL `61c4aa665eec10642718f3b0b9d628ce` nos dois. A divergência de
   ledger é contábil.
3. **O keepalive nunca protegeu nada.** Os quatro secrets não existem; 10
   execuções verdes, todas no-op.
4. **`app/.env.production` versionado aponta para o banco de demo.** Se as
   variáveis `VITE_*` sumirem do projeto Vercel de produção, o build de produção
   passa a falar com a vitrine sem erro e sem aviso.
5. **Os dois projetos Vercel constroem preview de toda branch**, incluindo as de
   bot — e é nesse ambiente de build que a `SUPABASE_SERVICE_ROLE_KEY` está
   disponível.
6. **PR #118 (Dependabot) está vermelho** em CI e nos dois builds de preview:
   `module_not_found`. Sobe 8 pacotes, dois deles majors.
7. **Os 7 `ezbr_sha256` das Edge Functions de produto batem** entre demo e
   produção. O código publicado é o mesmo; só o contador de versão difere.
