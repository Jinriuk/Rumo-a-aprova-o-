-- ============================================================
-- 0042 — EST1-B2: HIGIENE DO ADVISOR (policies + índices de FK)
-- ------------------------------------------------------------
-- Dois apontamentos do advisor do Supabase (medidos 14/07):
--
-- 1) WARN multiple_permissive_policies em aluno_missoes: a policy
--    `aluno_missoes_coordenacao` (FOR ALL) e a `aluno_missoes_select`
--    (FOR SELECT) coexistem para authenticated/SELECT — duas policies
--    permissivas na mesma ação, avaliadas a cada linha. A regra da
--    0029 (uma policy por ação/role) tinha zerado esse padrão; a 0033
--    (PED1) o reintroduziu. Consolidação: a coordenação passa a ter
--    policies só de ESCRITA (insert/update/delete); o SELECT fica com
--    a única `aluno_missoes_select` (que já inclui a coordenação).
--    Comportamento idêntico, sem a duplicação.
--
-- 2) INFO unindexed_foreign_keys: várias FKs sem índice de cobertura.
--    Indexamos aqui as FKs de tabelas que CRESCEM por tenant e são
--    filtradas/juntadas pela coluna da FK (ranking, motor, config).
--    Deixadas de fora DE PROPÓSITO: FKs de tabelas de conteúdo GLOBAL
--    minúsculas (missoes/assuntos/prova_materias/questoes_prova/
--    recorrencia_assunto/trilha_plano_missoes — seq scan é barato) e
--    da tabela DEPRECADA aluno_xp_eventos (removível em DB3). Isso
--    evita índice ocioso (que o próprio advisor depois marca "unused").
--
-- Aditiva. Idempotente. Não altera regra de isolamento (0002/0027/0029).
-- ============================================================

-- ── 1) Consolidação das policies de aluno_missoes ────────────────────
drop policy if exists aluno_missoes_coordenacao on aluno_missoes;

-- A coordenação escreve o ajuste manual (o motor escreve por SECURITY
-- DEFINER; o aluno não fecha a própria missão). SELECT sai daqui — fica
-- só na aluno_missoes_select, eliminando a policy permissiva duplicada.
create policy aluno_missoes_coord_ins on aluno_missoes for insert to authenticated
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');
create policy aluno_missoes_coord_upd on aluno_missoes for update to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');
create policy aluno_missoes_coord_del on aluno_missoes for delete to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- ── 2) Índices de cobertura para as FKs quentes (por-tenant) ─────────
-- aluno_missoes: escola_id (filtro de tenant) e missao_id (join no motor)
create index if not exists idx_aluno_missoes_escola on aluno_missoes (escola_id);
create index if not exists idx_aluno_missoes_missao on aluno_missoes (missao_id);

-- ledger de progresso: exam_tag (recorte por concurso) e criado_por (auditoria)
create index if not exists idx_evprog_exam       on aluno_eventos_progresso (exam_tag);
create index if not exists idx_evprog_criado_por on aluno_eventos_progresso (criado_por);

-- conquistas do aluno: join no catálogo e recorte por concurso
create index if not exists idx_aluno_conquistas_conquista on aluno_conquistas (conquista_id);
create index if not exists idx_aluno_conquistas_exam      on aluno_conquistas (exam_tag);

-- nível por matéria: quem definiu (auditoria/histórico)
create index if not exists idx_aluno_niveis_definido_por on aluno_niveis (definido_por);

-- alunos: concurso alvo e secundário (filtrados no ranking e na config)
create index if not exists idx_alunos_concurso     on alunos (concurso_id);
create index if not exists idx_alunos_concurso_sec on alunos (concurso_secundario_id);

-- meta: atividade-modelo (join no motor de progresso) e trilha
create index if not exists idx_meta_atividades_modelo on meta_atividades (atividade_modelo_id);
create index if not exists idx_metas_trilha           on metas (trilha_id);

-- override de missão por escola: join na missão global
create index if not exists idx_missoes_escola_missao on missoes_escola (missao_id);
