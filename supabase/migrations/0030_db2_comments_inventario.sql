-- ============================================================
-- 0030_db2_comments_inventario — DB2-C/D/E (documentação no banco)
-- ------------------------------------------------------------
-- Apenas `COMMENT ON` (metadado, NÃO destrutivo) para combater a
-- confusão estrutural: deixa explícito, no próprio banco, o que é motor
-- ATIVO, o que é C0 canônico e o que é Fase 15 vazia a investigar antes
-- de remover (DB3). Nenhuma tabela/coluna/policy é alterada.
-- Idempotente por natureza (COMMENT sobrescreve).
-- ============================================================

-- C0 — fonte canônica de XP/progresso
comment on table public.aluno_eventos_progresso is
  'C0 (motor de progresso) — FONTE CANÔNICA de XP/progresso. View vw_aluno_xp_total soma daqui. [DB2]';

-- Motor semanal — ATIVO (não remover: alimenta meta/missão/conclusão/painel)
comment on table public.metas is
  'Motor semanal ATIVO — escrito por app.gerar_meta/app.virar_semana. Coexiste com a trilha por concurso da Fase 15. NÃO remover. [DB2]';
comment on table public.meta_atividades is
  'Motor semanal ATIVO — trigger trg_progresso_missao alimenta o C0. NÃO remover. [DB2]';
comment on table public.trilhas is
  'Motor semanal ATIVO (legado em uso) — base de trilha_semanas/atividades_modelo via app.semana_da_data. [DB2]';
comment on table public.trilha_semanas is
  'Motor semanal ATIVO (legado em uso) — usado por app.semana_da_data. [DB2]';
comment on table public.atividades_modelo is
  'Motor semanal ATIVO (legado em uso) — FK de meta_atividades. [DB2]';
comment on table public.disciplinas is
  'Motor semanal ATIVO (legado em uso) — exibição de trilha no front. [DB2]';

-- Fase 15 — gamificação/níveis VAZIA em produção, possivelmente superada pelo C0.
-- NÃO marcar como morta: investigar caminho de escrita antes de remover (DB3).
comment on table public.aluno_xp_eventos is
  'DB2: VAZIA em produção. XP efetivo vive no C0 (aluno_eventos_progresso). Possível legado da Fase 15. Investigar escrita antes de remover. [DB3]';
comment on table public.aluno_niveis is
  'DB2: VAZIA em produção. Possível legado da Fase 15 (níveis). Investigar escrita antes de remover. [DB3]';
comment on table public.aluno_nivel_historico is
  'DB2: VAZIA em produção. Histórico de níveis (trigger trg_nivel_historico). Investigar uso antes de remover. [DB3]';
comment on table public.aluno_onboarding is
  'DB2: VAZIA em produção. Onboarding do aluno (Fase 15). Investigar uso antes de remover. [DB3]';
comment on table public.missoes_escola is
  'DB2: VAZIA em produção. Ativação de missões por escola (Fase 15). Investigar uso antes de remover. [DB3]';
