# DB1-E — Índices e Performance

> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`. Fonte: `pg_indexes`,
> Performance Advisor (`get_advisors performance`), antes/depois da DB1.

## 1. Estado inicial (advisor de performance)

- **`unindexed_foreign_keys`: 38 (INFO)** — FKs sem índice de cobertura.
- **`unused_index`: 9 (INFO)** — índices nunca usados (DB de baixíssimo
  tráfego/demo).
- **`multiple_permissive_policies`: 7 (WARN)** — ver `02-rls-policies.md`.

## 2. Correção aplicada (DB1-H, ADITIVA e segura)

Migration **`0028_db1_indices_multitenant.sql`** — `CREATE INDEX IF NOT
EXISTS` (idempotente, nenhum dado tocado, nada removido). Prioridade da
DB1: **multi-tenant primeiro**, depois joins de RLS.

| Índice | Tabela (coluna) | Justificativa |
|---|---|---|
| `idx_aluno_conquistas_escola` | `aluno_conquistas(escola_id)` | RLS por tenant; cresce por aluno |
| `idx_aluno_xp_eventos_escola` | `aluno_xp_eventos(escola_id)` | RLS por tenant |
| `idx_aluno_niveis_escola` | `aluno_niveis(escola_id)` | RLS por tenant |
| `idx_aluno_nivel_hist_escola` | `aluno_nivel_historico(escola_id)` | RLS por tenant |
| `idx_aluno_onboarding_escola` | `aluno_onboarding(escola_id)` | RLS por tenant |
| `idx_alunos_turmas_escola` | `alunos_turmas(escola_id)` | join multi-tenant |
| `idx_meta_atividades_escola` | `meta_atividades(escola_id)` | RLS; **851 linhas e crescendo** |
| `idx_vinculos_escola` | `vinculos_responsaveis(escola_id)` | RLS por tenant |
| `idx_alunos_turmas_turma` | `alunos_turmas(turma_id)` | lista de alunos por turma |
| `idx_vinculos_aluno` | `vinculos_responsaveis(aluno_id)` | `app.sou_responsavel_de` / `*_select` |
| `idx_consentimentos_aluno` | `consentimentos(aluno_id)` | join LGPD por aluno |

**Resultado:** `unindexed_foreign_keys` **38 → 27**. Aplicada ao banco
remoto e ao banco de teste local; idempotência verificada (rodada 2×) e
**222/222 testes seguem verdes**.

## 3. O que foi DELIBERADAMENTE deixado de fora

### 3.1 FKs sem índice mantidas (27 restantes) — baixo valor

Categorias e razão de não criar agora (evitar "dezenas de índices sem
critério"):

- **Colunas de auditoria `*_por`** (`criado_por`, `definido_por`,
  `concedido_por`, `ajustado_por` em `aluno_eventos_progresso`,
  `aluno_niveis`, `aluno_xp_eventos`, `config_escola`, `missoes_escola`):
  quase nunca usadas como predicado de busca.
- **FKs de `exam_tag`** (`aluno_conquistas`, `aluno_eventos_progresso`,
  `aluno_xp_eventos`, `config_escola`): cardinalidade baixíssima; já há
  índices compostos com `exam_tag` onde importa.
- **FKs de tabelas de catálogo pequenas** (`assuntos.materia_codigo`,
  `missoes.*`, `prova_materias.materia_codigo`, `questoes_prova.*`,
  `recorrencia_assunto.*`, `trilha_plano_missoes.missao_id`,
  `metas.trilha_id`, `meta_atividades.atividade_modelo_id`,
  `alunos.concurso_id/_secundario_id`): tabelas pequenas; seq scan é
  barato. Reavaliar **sob carga real** (DB2/S2).

### 3.2 Índices não usados (`unused_index`) — NÃO removidos

- 9 pré-existentes (`idx_alunos_turma_comercial`, `idx_subassuntos_assunto`,
  `idx_aluno_nivel_hist_aluno`, `idx_tpm_plano`, `idx_simulados_exam`,
  `idx_questoes_prova_prova/_assunto`, `idx_recorrencia_exam`,
  `idx_logs_coordenacao_escola`).
- + 11 **recém-criados** pela 0028, que aparecem como "unused" **porque
  acabaram de ser criados** num banco de tráfego de demo — passarão a ser
  usados sob carga (RLS por `escola_id`).

> **Regra DB1:** não apagar índice "por intuição". Os 9 pré-existentes
> são candidatos a revisão **com base em `pg_stat` sob carga real** na
> DB2 — não há prova de inutilidade permanente num banco de demo.

### 3.3 `multiple_permissive_policies` (7) — adiado p/ DB2
Ver `02-rls-policies.md` (risco no caso `vinculos_responsaveis`).

## 4. Queries críticas × cobertura de índice

| Caminho | Índice de apoio |
|---|---|
| Lista de alunos por escola | `idx_alunos_escola` |
| Lista de alunos por turma | **`idx_alunos_turmas_turma` (novo)** |
| Ficha do aluno / registros por data | `idx_registros_aluno_data` |
| Ranking / XP por aluno+exam | `idx_evprog_aluno`, `idx_xp_aluno` |
| Eventos de progresso recentes | `idx_evprog_recente` |
| Resumo da escola (painel) | testado: latência ok com ~150 alunos (teste 222) |
| Backoffice (admin_logs por escola+data) | `idx_admin_logs_escola` |
| Responsável → alunos vinculados | **`idx_vinculos_aluno` (novo)** + `idx_vinculos_responsavel` |

## 5. Veredito

Índices **revisados**. Os caminhos quentes multi-tenant ganharam
cobertura aditiva e segura; o restante (auditoria/catálogo/unused) foi
**documentado para reavaliação sob carga real**, sem remoções. O teste de
latência do `resumo_escola` (~150 alunos) continua dentro do teto.
