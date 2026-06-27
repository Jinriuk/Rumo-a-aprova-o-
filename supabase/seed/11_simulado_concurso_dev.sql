-- ============================================================
-- SEED DE DESENVOLVIMENTO — simulado por concurso (Fase 15.6)
-- ------------------------------------------------------------
-- SÓ dev/demo. Dá ao Lucas (alvo CN) um simulado amarrado ao
-- exam_tag 'cn' com acertos nas matérias REAIS do CN (incl. bio,
-- his, geo separadas) e nota de redação — material para os testes
-- da avaliação por concurso. Roda depois de 03/05. Idempotente.
-- ============================================================

-- Fixture curado: não acionar o motor de progresso (0024) na semeadura.
set app.motor_seed = 'on';

insert into simulados (id, escola_id, aluno_id, nome, data, exam_tag, acertos, redacao_nota) values
  ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', 'Simulado CN — estrutura real', '2026-06-10', 'cn',
   '{"mat": 14, "ing": 16, "por": 17, "fis": 4, "qui": 3, "bio": 4, "his": 4, "geo": 5}'::jsonb, 70)
  on conflict (id) do nothing;
