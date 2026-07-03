-- ============================================================
-- 0037 — FIX2: DEPRECA A ESCRITA DE CONQUISTAS NOS DOIS MOTORES
-- ------------------------------------------------------------
-- PROBLEMA (auditoria sênior 28/06 §2.1; REG1 02/07 item 1.8; FIX2 item 2):
-- o subsistema de gamificação da Fase 15.5 (aluno_xp_eventos, patentes,
-- conquistas, aluno_conquistas) tem ZERO leitores na UI — a régua de
-- patente exibida é jargao.js e a aba Conquistas do aluno deriva o
-- catálogo no cliente. Apesar disso, DOIS motores de servidor seguiam
-- ESCREVENDO em aluno_conquistas:
--   • C0   (0024): app.desbloquear_conquista_basica — "primeira vez"
--     (origem 'motor'; autor das 110 linhas em produção, xp_delta = 0);
--   • PED1 (0033): app.motor_conquista_xp — data-driven com xp_bonus
--     (origem 'motor_conquista'; 0 disparos em produção até 02/07).
-- Duas fontes de verdade para "conquista", nenhuma visível ao aluno.
--
-- DECISÃO (FIX2, opção a): parar a ESCRITA nos dois motores, preservando
-- tudo o que a UI consome — eventos de registro/missão/simulado, XP do
-- ledger, fechamento de missão (aluno_missoes) e níveis (aluno_niveis)
-- continuam intactos. Nenhuma tabela é dropada, nenhum dado apagado,
-- nenhuma RLS alterada. Religar o catálogo oficial na UI é decisão de
-- produto futura (DB3) — e passa por reverter esta migration.
--
-- COMO: as duas funções viram no-ops assinatura-compatíveis. Os call
-- sites (triggers do C0 e app.motor_avaliar_aluno da PED1) continuam
-- chamando-as sem erro; apenas nada é gravado.
--
-- ROLLBACK (manual): reaplicar os corpos originais —
--   • app.desbloquear_conquista_basica → 0024_motor_progresso.sql (§ helper);
--   • app.motor_conquista_xp           → 0033_ped1_missoes_niveis.sql (§3).
-- Nada mais é tocado, então o rollback é só recriar as 2 funções.
-- ============================================================

-- C0: conquistas "primeira vez" — desligada. Mantém assinatura e
-- SECURITY DEFINER (é chamada dentro dos gatilhos do C0).
create or replace function app.desbloquear_conquista_basica(
  p_escola uuid, p_aluno uuid, p_exam text, p_codigo text
) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  -- FIX2 (0037): escrita de conquistas deprecada — no-op de propósito.
  -- Histórico preservado em aluno_conquistas/aluno_eventos_progresso.
  return;
end $$;

-- PED1: conquistas premiadas — desligada. Idem.
create or replace function app.motor_conquista_xp(
  p_escola uuid, p_aluno uuid, p_exam text, p_codigo text
) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  -- FIX2 (0037): escrita de conquistas deprecada — no-op de propósito.
  return;
end $$;

-- Carimbo de deprecação nas 4 tabelas do subsistema 15.5 (dados
-- preservados; sem escrita de motor, sem leitura de UI).
comment on table public.aluno_xp_eventos is
  'DEPRECADA (FIX2 0037, 2026-07-02): ledger da Fase 15.5, substituído pelo C0 (aluno_eventos_progresso). 0 rows em produção; sem escrita nem leitura. Remoção física é decisão DB3.';
comment on table public.patentes is
  'DEPRECADA (FIX2 0037, 2026-07-02): catálogo da Fase 15.5 sem leitor — a régua de patente exibida é jargao.js (front). Remoção física é decisão DB3.';
comment on table public.conquistas is
  'DEPRECADA para os motores (FIX2 0037, 2026-07-02): catálogo sem leitor de UI; escritores (0024/0033) viraram no-op. Dados preservados. Religação ou remoção é decisão DB3.';
comment on table public.aluno_conquistas is
  'CONGELADA (FIX2 0037, 2026-07-02): escrita dos motores desligada (0024/0033 no-op); histórico preservado (append-only). A aba Conquistas do aluno deriva no cliente. Decisão final em DB3.';
