# DB2-F — Índices restantes e advisors

> Objetivo: revisar os 27 `unindexed_foreign_keys` restantes (pós-DB1) e
> os `unused_index`, **sem criar índice para tudo**. Fonte: Performance
> Advisor pós-`0029`/`0030`.

## 1. Estado do advisor de performance (pós-DB2)

| Aviso | Antes DB1 | Pós DB1 | Pós DB2 |
|---|---|---|---|
| `multiple_permissive_policies` (WARN) | 7 | 7 | **0** ✅ |
| `unindexed_foreign_keys` (INFO) | 38 | 27 | 27 |
| `unused_index` (INFO) | 9 | 20 | 20 |

> A DB2 zerou os WARN de policies. Os INFO de índices ficaram (decisão
> abaixo). Segurança: 8 secdef by-design + 1 leaked-password (toggle do
> dono) — inalterado.

## 2. Classificação das 27 FKs sem índice

| Categoria (FKs) | Exemplos | Cardinalidade | Volume atual/futuro | Decisão |
|---|---|---|---|---|
| Colunas de auditoria `*_por` | `*_criado_por`, `*_definido_por`, `*_concedido_por`, `*_ajustado_por` | alta (uuid de usuário) | raramente filtrado por essa coluna | **ignorar** (sem query por FK) |
| FKs de `exam_tag` | `aluno_conquistas_exam_tag`, `config_escola_exam_tag`, `aluno_xp_eventos_exam_tag`, `aluno_eventos_progresso_exam_tag` | baixíssima | já há índices compostos com `exam_tag` onde importa | **já coberto / ignorar** |
| FKs de catálogo pequeno | `assuntos_materia_codigo`, `missoes_*`, `prova_materias_materia_codigo`, `questoes_prova_*`, `recorrencia_assunto_*`, `trilha_plano_missoes_missao_id`, `metas_trilha_id`, `meta_atividades_atividade_modelo_id`, `alunos_concurso_id/_secundario` | baixa | tabelas pequenas; seq scan barato | **criar só quando tiver volume** |

**Criar agora:** nenhum. Justificativa: todos são de baixo valor
(auditoria/exam_tag/catálogos pequenos); criar índices aqui só adiciona
custo de escrita sem benefício mensurável no volume atual. A DB1 já
cobriu os caminhos quentes multi-tenant (`escola_id`, join `aluno_id`/
`turma_id`).

## 3. `unused_index` (20) — NÃO remover

- **11 são da DB1** (`idx_*_escola`, `idx_alunos_turmas_turma`,
  `idx_vinculos_aluno`, `idx_consentimentos_aluno`): aparecem "unused"
  porque foram criados há pouco num banco de tráfego de demo; cobrem RLS
  por `escola_id` e passarão a ser usados sob carga real.
- **9 são pré-existentes** (`idx_alunos_turma_comercial`,
  `idx_subassuntos_assunto`, `idx_aluno_nivel_hist_aluno`, `idx_tpm_plano`,
  `idx_simulados_exam`, `idx_questoes_prova_*`, `idx_recorrencia_exam`,
  `idx_logs_coordenacao_escola`).

> **Regra:** não apagar índice por intuição num banco de demo. Reavaliar
> com `pg_stat_user_indexes` **sob carga real** (DB3). `drop index` é
> reversível mas não traz benefício agora e some com sinal de uso.

## 4. Decisão DB2-F

- **Criar agora:** 0 índices.
- **Criar quando tiver volume:** FKs de catálogo (lista §2).
- **Ignorar:** FKs de auditoria `*_por` e `exam_tag`.
- **Já coberto por índice composto:** caminhos `exam_tag` quentes.
- **Precisa benchmark (DB3):** revisão de `unused_index` sob carga e
  eventual poda.
