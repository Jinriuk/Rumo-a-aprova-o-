# PERF1 — Queries pesadas e índices

**Fase:** PERF1 · **Data:** 2026-06-27 · **Natureza:** análise de performance (sem alterar RLS/Auth)
**Escopo:** Camada 4 (escala, relatórios, carga) — itens 5.1, 5.2, 5.3 do prompt da camada.

> **Resumo de uma linha.** As consultas quentes da Área da Escola já estão
> cobertas por índice (fundação + 0023 + 0028). **Nenhum índice novo foi
> criado nesta camada** — não há evidência de ganho que justifique o custo de
> escrita. Há **um candidato** (índice de cobertura para `resumo_escola()`)
> deixado para validar sob EXPLAIN no teste de carga 10k em staging, antes de
> qualquer migration.

---

## 1. Mapa das queries pesadas (item 5.1)

Origem real no código (seam único `app/src/shared/data/index.js`). "Quente" =
roda a cada abertura de tela da coordenação e/ou cresce com o volume da escola.

| # | Query (função do seam) | Tabela(s) | Filtro/ordem | Cresce com | Quente? |
|---|---|---|---|---|:--:|
| Q1 | `resumoEscola()` → RPC `public.resumo_escola()` (0016) | `registros_estudo`, `metas`+`meta_atividades`, `alunos` | `escola_id = app.tenant_id()`, `group by aluno_id`; metas `status='ativa'` | registros da escola (N alunos × dias) | **Sim — a mais pesada** |
| Q2 | `listarAlunos()` | `alunos` ⨝ `alunos_turmas` ⨝ `turmas` | RLS `escola_id`; `order by nome` | alunos da escola | Sim |
| Q3 | `listarSimuladosEscola()` | `simulados` | RLS `escola_id`; `order by data` | simulados da escola | Médio |
| Q4 | `listarConsentimentos()` | `consentimentos` | RLS `escola_id`; `order by aceito_em` | alunos da escola | Médio |
| Q5 | `listarLogsAcesso(100)` | `logs_acesso` | `order by em desc limit 100` | log da escola | Médio (limitada) |
| Q6 | `listarRegistros/Metas/Simulados(aluno)` | idem por `aluno_id` | `aluno_id = …`, ordenado por data | registros do aluno | Baixo (1 aluno) |
| Q7 | `carregarEventosProgresso(aluno, {limite})` | `aluno_eventos_progresso` | `aluno_id`, `order criado_em desc limit` | ledger do aluno | Baixo (1 aluno, limitado) |
| Q8 | Ranking, Painel, Turmas, **Relatórios/comparativos (PERF1)** | — (em memória) | derivam de `resumoPorAluno` | — | **Nenhuma query nova** |

**Nota sobre Q8 / PERF1.** A comparação por turma/concurso e a exportação CSV
introduzidas nesta camada (`shared/metricas/comparativo.js`, `shared/lib/csv.js`)
**não fazem I/O**: reorganizam o agregado por aluno que Q1 já trouxe. Custo de
banco adicional = **zero**.

---

## 2. Índices existentes que cobrem essas queries

Inventário real (`grep "create index" supabase/migrations`):

| Query | Caminho crítico | Índice que cobre | Migration |
|---|---|---|---|
| Q1 (reg) | `registros_estudo where escola_id = tenant` | `idx_registros_escola (escola_id)` | 0023 |
| Q1 (metas) | `metas where escola_id and status='ativa'` | `idx_metas_escola_status (escola_id, status)` | 0023 |
| Q1 (meta_ativ) | join `meta_atividades.meta_id` / `escola_id` | `idx_meta_atividades_meta`, `idx_meta_atividades_escola` | 0001 / 0028 |
| Q1 (alunos) | `alunos where escola_id = tenant` | `idx_alunos_escola (escola_id)` | 0001 |
| Q2 | `alunos` por escola; `alunos_turmas` por turma/escola | `idx_alunos_escola`, `idx_alunos_turmas_escola`, `idx_alunos_turmas_turma` | 0001 / 0028 |
| Q3 | `simulados where escola_id` | `idx_simulados_escola (escola_id)` | 0023 |
| Q4 | `consentimentos where escola_id` | `idx_consentimentos_escola (escola_id)` | 0023 |
| Q5 | `logs_acesso order by em desc` | `idx_logs_acesso_escola (escola_id, em)` | 0001 |
| Q6 | `registros where aluno_id order by data` | `idx_registros_aluno_data (aluno_id, data)` | 0001 |
| Q6 | `metas/simulados where aluno_id` | `idx_metas_aluno`, `idx_simulados_aluno` | 0001 |
| Q7 | `aluno_eventos_progresso where aluno_id order criado_em desc` | `idx_evprog_recente (aluno_id, criado_em desc)` | 0024 |

**Conclusão:** todo filtro multi-tenant (`escola_id`) e todo join de RLS quente
já tem índice. A regressão clássica — *sequential scan da tabela multi-tenant
inteira* — foi fechada em 0023/0028.

---

## 3. EXPLAIN seguro (item 5.2) — procedimento

> **Regra dura:** EXPLAIN/ANALYZE roda em **banco de teste local**
> (`tests/reset-db.sh`) ou **staging isolado** — **nunca** no demo/produção
> compartilhado. `EXPLAIN (ANALYZE)` **executa** a query; em `resumo_escola()`
> é leitura pura (sem efeito colateral), mas o custo de I/O não deve cair em
> banco compartilhado.

Passo a passo (local ou staging):

```bash
# 1) sobe banco efêmero com migrations + seed padrão
bash tests/reset-db.sh

# 2) injeta volume (300/500 ou 10k) — ver plano-carga-300-500-10000.md
psql "$DATABASE_URL" -f supabase/seed-volume/massa_coordenacao.sql   # ~480
# ou
psql "$DATABASE_URL" -f supabase/seed-volume/massa_10k.sql           # 10.000

# 3) mede o plano da query mais pesada SOB a matriz de RLS da coordenação
#    (set role + claims simulam o JWT; igual a tests/identidades.mjs)
```

```sql
-- dentro de psql, como a coordenação da escola de carga:
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','<coord_uuid>','role','authenticated')::text, true);

explain (analyze, buffers, format text)
select * from public.resumo_escola();
```

O que observar no plano:
- **`Seq Scan` em `registros_estudo`** sem `Index Cond` por `escola_id` → sinal
  de índice faltando (não esperado: `idx_registros_escola` cobre).
- **Tempo de `HashAggregate`/`GroupAggregate`** dominando → o gargalo é o
  `group by aluno_id` sobre muitas linhas, não a varredura (ver §4).
- **`Rows Removed by Filter`** alto → política/predicado caro por linha.

---

## 4. Decisão de índices (item 5.3)

### 4.1 Não criar agora (sem evidência / risco de escrita)

- **Índices compostos de gamificação por tenant (Camada 4.5).** Tabelas
  `aluno_xp_eventos`/`aluno_conquistas` estão **dormentes** (não escritas por
  tela — REG0 1.1). Já receberam `escola_id` em 0028. Adicionar índice composto
  `(escola_id, exam_tag, …)` agora é otimizar caminho sem tráfego: só custo de
  escrita futuro, ganho nulo hoje. **Reavaliar quando o motor PED1 ligar a
  escrita.**

- **Índice em `alunos(nome)` para o `order by nome` de Q2.** Após o filtro de
  RLS sobram só os alunos da escola (centenas, não a tabela toda). Ordenar
  algumas centenas de linhas em memória é barato; o índice não pagaria o custo.

### 4.2 Candidato — validar sob carga 10k antes de criar

**Índice de cobertura para o agregado de `resumo_escola()`:**

```sql
-- CANDIDATO — NÃO aplicado nesta camada. Só após EXPLAIN em staging mostrar
-- ganho real no cenário 10k E custo de escrita aceitável.
-- create index idx_registros_escola_aluno_cobertura
--   on registros_estudo (escola_id, aluno_id, data) include (questoes, acertos, minutos);
```

- **Hipótese de ganho:** um *index-only/covering scan* por `escola_id` já
  agrupado por `aluno_id` pode reduzir o `HashAggregate` da Q1 no cenário de
  uma escola muito grande (10k alunos × vários dias).
- **Risco a medir:** `registros_estudo` é a tabela de **escrita mais quente**
  (todo registro de estudo de todo aluno). Um índice largo encarece cada
  INSERT. Só vale se o EXPLAIN no 10k mostrar o agregado como gargalo **e** o
  ganho superar o custo de escrita.
- **Gate:** sem evidência de EXPLAIN em staging, **não** entra migration
  (critério de aceite: "nenhum índice criado sem justificativa").

### 4.3 Rollback (se algum dia o candidato virar migration)

Índice é aditivo e reversível: `drop index if exists idx_…;`. A migration
traria o `create` e o doc de rollback traria o `drop`. Nenhuma linha de dado é
tocada; nenhuma política de RLS muda.

---

## 5. RLS após mudança de índice

Índice **não altera** o resultado de uma query, só o caminho. Como nenhuma
migration de índice foi criada nesta camada, a suíte de RLS/isolamento
(`tests/isolamento.test.mjs`, `tests/volume-coordenacao-db.test.mjs`,
`tests/painel-agregado-db.test.mjs`) permanece a referência. **Se** o candidato
4.2 for aplicado no futuro, rodar essa suíte é obrigatório antes do merge
(checklist no relatório).

---

## 6. Evidências

- Seam de dados: `app/src/shared/data/index.js`
- RPC agregada: `supabase/migrations/0016_painel_agregado.sql`
- Índices: `0001_fundacao.sql`, `0023_indices_escala_coordenacao.sql`,
  `0028_db1_indices_multitenant.sql`, `0024_motor_progresso.sql`
- Teste de volume existente: `tests/volume-coordenacao-db.test.mjs` (150 alunos,
  teto de latência 3000ms para `resumo_escola()`)
