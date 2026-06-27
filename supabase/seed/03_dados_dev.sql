-- ============================================================
-- SEED DE DESENVOLVIMENTO — metas e dados de estudo de exemplo
-- ------------------------------------------------------------
-- Gera a meta da semana corrente para os alunos semeados (via
-- motor, o mesmo caminho da produção) e dá ao Lucas alguns
-- registros para as telas de desempenho não nascerem vazias.
-- Idempotente.
-- ============================================================

-- Fixture curado: o motor de progresso (0024) NÃO deve disparar em
-- cima do seed e duplicar XP/níveis/missões já definidos manualmente
-- nos seeds 08/10. O gatilho respeita este flag e não roda na semeadura.
set app.motor_seed = 'on';

select app.gerar_meta('a0000000-0000-4000-8000-000000000001');
select app.gerar_meta('b0000000-0000-4000-8000-000000000001');

insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos) values
  ('a0000000-0000-4000-8000-000000000041', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', app.hoje_local() - 1, 'mat', 'Frações: operações', 30, 22, 60),
  ('a0000000-0000-4000-8000-000000000042', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', app.hoje_local() - 1, 'ing', 'Murphy Units 1–7', 20, 16, 40),
  ('a0000000-0000-4000-8000-000000000043', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', app.hoje_local(),     'por', 'Acentuação', 25, 19, 45),
  -- dado de contraste na escola B: se o isolamento furar, o teste vê isto
  ('b0000000-0000-4000-8000-000000000041', '22222222-2222-4222-8222-222222222222',
   'b0000000-0000-4000-8000-000000000001', app.hoje_local(),     'mat', 'SEGREDO-ESCOLA-B', 10, 5, 20)
  on conflict (id) do nothing;

insert into simulados (id, escola_id, aluno_id, nome, data, acertos) values
  ('a0000000-0000-4000-8000-000000000051', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', 'Diagnóstico', app.hoje_local() - 2,
   '{"mat": 12, "ing": 14, "por": 18, "fis": 6, "qui": 5, "soc": 7}'::jsonb)
  on conflict (id) do nothing;
