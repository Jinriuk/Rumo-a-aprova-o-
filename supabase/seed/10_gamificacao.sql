-- ============================================================
-- SEED — XP, PATENTES E CONQUISTAS (Fase 15.5)
-- ------------------------------------------------------------
-- Catálogo GLOBAL de patentes (doc §13) e conquistas (doc §12),
-- com critérios atrelados a acurácia/nota/constância (nunca volume
-- puro). Limiares são preliminares (🟡 calibrar). Demo de progresso
-- para Lucas (escola Vitrine) + contraste do Bruno (escola Beta).
-- Roda depois de 03/05; idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Patentes (tema militar sem exagero; reskinável por força)
-- ------------------------------------------------------------
insert into patentes (codigo, nome, xp_necessario, criterio_adicional, significado, ordem) values
  ('recruta',     'Recruta',      0,     null,                                         'Entrou; fez o diagnóstico.', 0),
  ('soldado',     'Soldado',      300,   null,                                         'Criou rotina; fechou a 1ª missão base.', 1),
  ('cabo',        'Cabo',         800,   'nenhuma matéria do alvo sem ≥1 missão base', 'Cobriu a base de todas as frentes.', 2),
  ('3sargento',   '3º Sargento',  1800,  null,                                         'Domina o núcleo; entrou no intermediário.', 3),
  ('2sargento',   '2º Sargento',  3500,  '1 simulado completo entregue',               'Já encara a prova inteira.', 4),
  ('1sargento',   '1º Sargento',  6000,  null,                                         'Avançado em andamento.', 5),
  ('subtenente',  'Subtenente',   9000,  'nenhuma matéria abaixo do piso no último simulado', 'Blindou o risco de eliminação.', 6),
  ('aspirante',   'Aspirante',    13000, 'reta final ativa + redação consistente',     'Pronto para a prova.', 7)
  on conflict (codigo) do nothing;

-- ------------------------------------------------------------
-- Conquistas (uma por tipo; critério sempre por acurácia/nota/constância)
-- ------------------------------------------------------------
insert into conquistas (codigo, nome, tipo, descricao, criterio, xp_bonus, ordem) values
  ('maratona_7',     'Maratona 7 dias',     'constancia', 'Estudou 7 dias seguidos sem furar.',                 '{"dias": 7}'::jsonb,                100, 0),
  ('maratonista',    'Maratonista',         'volume',     'Volume alto no mês COM acerto estável.',             '{"questoes": 600, "acuracia_min": 70}'::jsonb, 120, 1),
  ('acima_da_prova', 'Acima da Prova',      'desempenho', '≥85% num assunto de alta prioridade.',               '{"acuracia_min": 85, "prioridade": "alta"}'::jsonb, 120, 2),
  ('veterano',       'Veterano de Prova',   'simulado',   '1º simulado completo no formato oficial.',           '{"simulados": 1}'::jsonb,           150, 3),
  ('geometra',       'Geômetra',            'materia',    'Fechou o assunto-chave de Matemática.',              '{"materia": "mat", "acuracia_min": 80}'::jsonb, 100, 4),
  ('virou_o_jogo',   'Virou o Jogo',        'evolucao',   'Transformou erro recorrente em acerto estável.',     '{"delta_acuracia": 20}'::jsonb,     120, 5),
  ('reta_final',     'Reta Final',          'reta_final', 'Entrou no ciclo final de preparação.',               '{}'::jsonb,                          50, 6),
  ('piso_blindado',  'Piso Blindado',       'corte',      '≥ piso em TODAS as matérias no último simulado.',    '{"piso_em_todas": true}'::jsonb,    180, 7),
  ('virada_chave',   'Virada de Chave',     'recuperacao','Recuperou uma matéria que estava abaixo do piso.',   '{"recuperou_piso": true}'::jsonb,   150, 8),
  ('ingles_estrat',  'Inglês Estratégico',  'alavancagem','Fechou as metas de Inglês (alto ROI).',              '{"materia": "ing", "acuracia_min": 80}'::jsonb, 120, 9)
  on conflict (codigo) do nothing;

-- ------------------------------------------------------------
-- DEMO (dev): Lucas (escola Vitrine), alvo CN. Ledger de XP com
-- origens variadas e uma conquista desbloqueada. Bruno: contraste.
-- ------------------------------------------------------------
-- PROD1 (2026-07): blocos de demo guardados por EXISTS — em produção
-- (sem as escolas de vitrine/contraste) viram no-op em vez de estourar
-- a FK. O catálogo global de patentes/conquistas (acima) roda sempre.
do $$
begin
  if exists (select 1 from escolas where id = '11111111-1111-4111-8111-111111111111') then
    insert into aluno_xp_eventos (id, escola_id, aluno_id, exam_tag, origem, pontos, descricao) values
      ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'cn', 'missao',          100, 'Fechou Geometria Plana com ≥80%'),
      ('a2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'cn', 'semana_completa',  60, 'Semana sem furar'),
      ('a2000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'cn', 'simulado',        150, 'Primeiro simulado completo'),
      ('a2000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'cn', 'melhoria_materia', 40, 'Português subiu de nível')
      on conflict (id) do nothing;

    insert into aluno_conquistas (id, escola_id, aluno_id, conquista_id, exam_tag) values
      ('a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001',
       (select id from conquistas where codigo = 'veterano'), 'cn')
      on conflict (aluno_id, conquista_id, exam_tag) do nothing;
  end if;

  -- Contraste na escola B (isolamento): XP do Bruno marcado como segredo.
  if exists (select 1 from escolas where id = '22222222-2222-4222-8222-222222222222') then
    insert into aluno_xp_eventos (id, escola_id, aluno_id, exam_tag, origem, pontos, descricao) values
      ('b2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b0000000-0000-4000-8000-000000000001', 'cn', 'ajuste_manual', 999, 'SEGREDO-ESCOLA-B-XP')
      on conflict (id) do nothing;
  end if;
end $$;
