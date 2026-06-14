-- ============================================================
-- SEED DE DESENVOLVIMENTO — níveis e onboarding (Fase 15.3)
-- ------------------------------------------------------------
-- SÓ dev/demo. Dá ao Lucas (escola Vitrine) um nível geral e níveis
-- por matéria DIFERENTES entre si (geral Intermediário, Mat Base,
-- Port Avançado) — material para as telas e para os testes. Bruno
-- (escola Beta) recebe um nível de contraste para o isolamento.
-- Roda depois de 03 (alunos existem). Idempotente.
-- ============================================================

-- Lucas: alvo principal CN (já vem do seed 05); define alvo secundário
-- EPCAR (mesma turma comercial) e a data da prova alvo.
update alunos
   set concurso_secundario_id = 'c0c00000-0000-4000-8000-000000000002',  -- EPCAR
       data_prova_alvo        = date '2026-08-01'
 where id = 'a0000000-0000-4000-8000-000000000001'
   and concurso_secundario_id is null;

-- Níveis do Lucas (geral + por matéria). O gatilho registra o histórico.
insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem, motivo, definido_por) values
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'geral', 'intermediario', 'diagnostico', 'Diagnóstico inicial', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'mat',   'base',          'calculado',   'Acerto médio baixo em Matemática', null),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'por',   'avancado',      'calculado',   'Bom acerto e volume em Português', null)
  on conflict (aluno_id, escopo) do nothing;

insert into aluno_onboarding (aluno_id, escola_id, experiencia_previa, disponibilidade_semanal_h, maior_dificuldade, objetivo, observacao_coordenacao, concluido_em) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Estuda há cerca de 6 meses', 15, 'Matemática (geometria)', 'Passar no Colégio Naval',
   'Aluno dedicado; reforçar exatas.', now())
  on conflict (aluno_id) do nothing;

-- Bruno (escola B): nível de contraste para provar o isolamento.
insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem, motivo, definido_por) values
  ('22222222-2222-4222-8222-222222222222', 'b0000000-0000-4000-8000-000000000001', 'geral', 'base', 'validar', 'SEGREDO-ESCOLA-B-NIVEL', 'bbbbbbbb-0000-4000-8000-000000000001')
  on conflict (aluno_id, escopo) do nothing;
