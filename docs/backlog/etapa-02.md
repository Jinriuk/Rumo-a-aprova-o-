# Backlog — Etapa 2 (Inventário e posse profissional da infraestrutura)

**Atualizado em:** 02/09/2026

---

## BKL-001: Ambiguidade dos projetos Supabase restaurados

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** concluído
- **Evidência:** três projetos na organização `ddsfpmyxbitaghvhadov`. `bdjkgrzfzoamchdpobbl` ("Teste e Vitrine", `us-east-1`, ACTIVE_HEALTHY) é o único ligado ao Rumo. `barbearia-saas` (INACTIVE) e `pool-poker` (ACTIVE_HEALTHY) não têm relação com o Rumo. Não existe projeto do GrinderBank aqui.

## BKL-006: Papel da organização Supabase nova (`eerbpzacxolwlwsltynb`)

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** concluído
- **Evidência:** organização sem nenhum projeto criado ainda. Ver ADR-0001: reservada para produção dedicada, só populada após o Gate G2.

## BKL-003: Fonte da "auditoria independente de 25/08"

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** validado
- **Evidência:** documento fornecido por Gabriel (`auditoria-rumo-aprovacao-2026-08-25.md`). Confirma "558 passaram, 0 falharam, 0 pulados, 69 arquivos de teste, ~3,5s", auditado no commit `8c8a808`.
- **Resíduo (baixo esforço):** o arquivo ainda não está commitado em `docs/auditoria/` no repositório.

## BKL-004: Achados de segurança do banco (SECURITY DEFINER e Auth)

- **Frente:** engenharia
- **Responsável:** técnico (Opus, conforme papéis do plano)
- **Prioridade:** Média
- **Prazo:** antes do Gate G3
- **Estado:** concluído (migration mergeada em `main`, PR #85, squash `fe2d053`)
- **Evidência:**
  - Funções `backoffice_*`, `resumo_escola`, `salvar_onboarding_aluno`: guarda interna correta (`eh_super_admin()`), confirmado nas migrations 0019/0021/0025/0032. Aviso do linter é ruído, sem ação necessária.
  - `rls_auto_enable()` + event trigger `ensure_rls`: migration `0045` criada, testada por idempotência, aplicada no projeto de teste. **Verificado de forma independente em 02/09:** `list_migrations` mostra as 45 entradas incluindo a 0045; consulta direta a `supabase_migrations.schema_migrations` confirma 45 linhas, sem resíduo; o event trigger `ensure_rls` está ativo e aponta pra `rls_auto_enable`. PR #85 mergeado em `main` (squash `fe2d053`) — o repositório agora reflete o banco.
  - Proteção contra senha vazada (HaveIBeenPwned) segue desligada no Auth, toggle simples pendente.
- **Resíduo aberto (07/09):** a verificação do ledger acima foi feita em 02/09 contra o projeto de TESTE. Produção (`zckyhihxjjbnqjqilymn`) só foi criada em 03/09 e nunca passou por essa conferência. Ver BKL-015.
- **Continuação:** migration `0047` revoga `EXECUTE` de `rls_auto_enable()` para `public`/`anon`/`authenticated` (o linter apontava chamada via `/rest/v1/rpc/rls_auto_enable` por `anon` e `authenticated`; diferente das `backoffice_*`, ela não tem guarda interna de papel). Aplicada nos dois bancos em 07/09 e verificada: lints sumiram, `ensure_rls` segue `evtenabled='O'`, ACL sem grants para os três papéis.

---

## BKL-014: Aplicar migration em produção não é passo obrigatório do merge

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Alta
- **Estado:** pendente
- **Problema:** o front redeploya sozinho a cada push; migration não. Quando um PR mexe em schema e front juntos, o código chega em produção antes do schema, e o intervalo é silencioso.
- **Evidência (3 ocorrências documentadas, causas diferentes):**
  1. `scripts/checar-migrations.mjs`, no próprio cabeçalho: "produção já ficou 9 migrations atrás do código sem ninguém perceber". O script nasceu desse episódio.
  2. **05/09, `provisionar-aluno`:** função v2 deployada às 14:35 UTC, tentativa real às 15:52 UTC falhando com `column alunos.status_provisionamento does not exist` (42703) no primeiro `SELECT` de `alunoDaEscola()`, antes de qualquer `auth.admin.createUser()`. A migration `0046`, que cria a coluna, só foi aplicada em produção em 06/09 18:20 UTC, 26h depois. Resultado: `auth.users` com 0 contas `@codigo.acesso.local` e `alunos.usuario_id` nulo. Em teste a 0046 já estava aplicada desde 05/09 08:41 UTC, por isso o mesmo fluxo passou lá.
  3. **07/09, `0047`:** a migration foi aplicada nos dois bancos antes de o arquivo `.sql` existir no repositório. Mesmo formato, produzido dentro da própria sessão de correção.
- **Ação:** tornar "aplicar migration em produção" passo explícito e bloqueante do merge, não algo lembrado depois. Candidato de baixo custo: rodar `scripts/checar-migrations.mjs` contra produção no CI e falhar o gate (depende de BKL-015, hoje o script acusaria 45 faltando).

---

## BKL-015: Ledger de migrations de produção incompleto (2 de 47 linhas)

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Alta
- **Estado:** pendente
- **Achado (07/09):** `supabase_migrations.schema_migrations` em produção tem apenas `0046` e `0047`. As 45 primeiras foram aplicadas fora do fluxo de migrations (colar SQL no editor não escreve no ledger). O schema está lá; o histórico não sabe disso.
- **Consequências:**
  - `supabase db push` contra produção tentaria reaplicar `0001`–`0045` do zero, e 12 delas quebram ao reaplicar (falta de `DROP POLICY IF EXISTS`). **Nenhum uso de CLI contra produção antes de resolver.**
  - `scripts/checar-migrations.mjs` contra produção reporta 45 faltando e sai com exit 1, então não serve como gate hoje.
- **Sequência acordada (não inverter):**
  1. **Diff primeiro.** Feito em 07/09 com `scripts/fingerprint-schema.sql`: 1091 objetos comparados (tabelas, colunas, índices, constraints, policies, funções, ACLs de tabela e função, triggers, event triggers, views). Única divergência: BKL-016.
  2. **`0048` captura os deltas** encontrados no passo 1.
  3. **`supabase migration repair --status applied`** só depois, para as 45.
- **Nota de mecânica (corrige suposição anterior):** `checar-migrations.mjs` compara pelo campo `name` do ledger, não pelo `version`. Como os `name` são exatamente os nomes dos arquivos (`0001_fundacao`, …), um repair faz esse script passar. O `version` importa para o `supabase db push` (é por ele que a CLI decide o que reaplicar) e para qualquer comparação de ledger entre ambientes: versions são geradas no momento da aplicação, não derivam do arquivo, e por isso nunca coincidem entre projetos. A mesma `0046` é `20260905084121` em teste e `20260906182011` em produção.

---

## BKL-016: RLS ligada em `app.acessos_codigo` e `app.login_tentativas` só em produção

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** pendente
- **Achado (07/09):** produção tem `relrowsecurity = true` nas duas tabelas; teste tem `false`. Ambas com zero policies. É a única divergência de schema entre os dois bancos em 1091 objetos comparados.
- **O que está provado:** nenhuma migration do repositório liga RLS nessas tabelas. A `0044` cria as duas sem uma linha de RLS, e o filtro do `rls_auto_enable` é `schema_name IN ('public')`, então o event trigger nunca tocaria em `app.*`. Só a `0044` e a `0047` sequer citam essas tabelas. Ou seja: a alteração existe em produção e em migration nenhuma.
- **Origem: NÃO CONFIRMADA.** Hipótese mais provável é ação fora do fluxo de migrations. Candidato específico a checar antes de cravar: o painel do Supabase oferece um botão "Enable RLS" ao lado exatamente desse lint, e um clique respondendo ao aviso fecharia o círculo (o lint atual seria consequência da tentativa de resolver o lint). Não muda a ação; muda o que se escreve como causa.
- **Risco atual:** baixo. O schema `app` não é exposto via PostgREST e só `service_role` tem grant nessas tabelas, e `service_role` ignora RLS. Os dois estados são funcionalmente idênticos hoje.
- **Direção da `0048` (decidida):** capturar o estado de PRODUÇÃO, ou seja, ligar RLS nas duas também em teste. Entre dois estados funcionalmente idênticos, fica o mais defensivo.
- **Efeito colateral conhecido:** os dois lints INFO `rls_enabled_no_policy` passam a aparecer também em teste. É ruído esperado, não regressão.

---

## BKL-017: Critério de paridade entre ambientes deve comparar schema, não ledger

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Média
- **Estado:** pendente
- **Problema:** a verificação de paridade hoje é `scripts/checar-migrations.mjs`, que compara repositório × ledger. Ela é cega para qualquer coisa aplicada fora do fluxo de migrations, que é exatamente a classe de problema que BKL-015 e BKL-016 documentam. O ledger diz o que o banco *afirma* ter rodado; não diz o que o banco *é*.
- **Ação:** adotar `scripts/fingerprint-schema.sql` como critério de paridade, mantendo `checar-migrations.mjs` como gate de "faltou aplicar". São complementares, não substitutos.
- **Correção de premissa:** este item foi levantado como "mudar o critério do BKL-009". BKL-009 é outra coisa — "Registro de commit em demo/staging/produção" — e não contém critério de comparação de migration history. Fica registrado aqui como item próprio.
- **Resíduo em BKL-009 (marcado como concluído):** o registro de 02/09 diz "Produção: não existe ainda". Produção passou a existir em 03/09 (`zckyhihxjjbnqjqilymn`, organização `eerbpzacxolwlwsltynb`). O registro está desatualizado e vale reabrir para atualizar commit/ambiente.
- **Armadilha já paga, documentada no script:** a primeira versão do fingerprint usava `information_schema.role_table_grants` e `routine_privileges`, que só mostram linhas onde o papel conectado é grantor/grantee. Como o MCP conecta como `supabase_read_only_user` em produção e `postgres` em teste, isso produziu falsos positivos de 0 vs 1406 grants de tabela e 24 vs 161 de função. Corrigido usando `pg_class.relacl` / `pg_proc.proacl`. Mesmo motivo levou a trocar `::regproc` por resolução explícita via `pg_proc`/`pg_namespace`. Um gate de paridade que dá falso positivo é pior que nenhum, porque ensina a ignorá-lo.
