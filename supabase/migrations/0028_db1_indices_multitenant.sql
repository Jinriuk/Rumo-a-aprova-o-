-- ============================================================
-- 0028_db1_indices_multitenant — DB1-H (correção segura, ADITIVA)
-- ------------------------------------------------------------
-- Cria índices de cobertura para chaves estrangeiras multi-tenant
-- (escola_id) e para joins quentes de RLS (aluno_id / turma_id) que
-- o Performance Advisor do Supabase apontou como "unindexed foreign
-- keys". É ADITIVO e idempotente: nenhuma linha é tocada, nenhum
-- comportamento muda, nada é removido.
--
-- Critério (DB1-H, prioridade): 1) multi-tenant (escola_id),
-- 2) joins de política RLS (aluno_id em sou_responsavel_de / *_select).
-- Escopo deliberadamente enxuto — não criamos índices em tabelas de
-- referência pequenas (assuntos, missoes, prova_materias, ...), onde
-- o ganho é nulo e o índice só geraria ruído.
--
-- Tabelas-alvo carregam dado por aluno e crescem com o piloto:
-- as políticas RLS filtram por `escola_id = app.tenant_id()` e/ou
-- chamam `app.sou_responsavel_de(aluno_id)`; estes índices cobrem
-- exatamente esses caminhos.
-- ============================================================

-- Multi-tenant: escola_id (filtro de toda política RLS de tenant)
create index if not exists idx_aluno_conquistas_escola      on public.aluno_conquistas    (escola_id);
create index if not exists idx_aluno_xp_eventos_escola       on public.aluno_xp_eventos     (escola_id);
create index if not exists idx_aluno_niveis_escola           on public.aluno_niveis         (escola_id);
create index if not exists idx_aluno_nivel_hist_escola       on public.aluno_nivel_historico(escola_id);
create index if not exists idx_aluno_onboarding_escola       on public.aluno_onboarding     (escola_id);
create index if not exists idx_alunos_turmas_escola          on public.alunos_turmas        (escola_id);
create index if not exists idx_meta_atividades_escola        on public.meta_atividades      (escola_id);
create index if not exists idx_vinculos_escola               on public.vinculos_responsaveis(escola_id);

-- Joins de RLS / navegação
create index if not exists idx_alunos_turmas_turma           on public.alunos_turmas        (turma_id);
create index if not exists idx_vinculos_aluno                on public.vinculos_responsaveis(aluno_id);
create index if not exists idx_consentimentos_aluno          on public.consentimentos       (aluno_id);
