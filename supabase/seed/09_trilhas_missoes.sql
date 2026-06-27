-- ============================================================
-- SEED — TRILHAS E MISSÕES (Fase 15.4) · conteúdo global
-- ------------------------------------------------------------
-- Planos de trilha por (exam_tag, tipo) e um STARTER de missões
-- ligadas às matérias/assuntos da 15.2. Desenho pedagógico = 🟡
-- inferência (não é regra de edital); XP é preliminar (15.5).
-- Roda depois de 07 (assuntos existem). Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Planos de trilha: 4 horizontes por concurso.
-- ------------------------------------------------------------
insert into trilha_planos (id, exam_tag, tipo, nome, descricao, status_dado, ordem) values
  ('b1000000-0000-4000-8000-0000000000c1', 'cn', 'anual',      'CN — Trilha Anual',      'Tronco (Mat/Port/Inglês) + frentes do CN ao longo de 12 meses.', 'inferencia', 0),
  ('b1000000-0000-4000-8000-0000000000c2', 'cn', 'semestral',  'CN — Trilha Semestral',  'Anual comprimida para quem já tem base.', 'inferencia', 1),
  ('b1000000-0000-4000-8000-0000000000c3', 'cn', 'intensiva',  'CN — Trilha Intensiva',  'Reta de 3 meses: correção de lacunas + simulados.', 'inferencia', 2),
  ('b1000000-0000-4000-8000-0000000000c4', 'cn', 'reta_final', 'CN — Reta Final',        'Simulados nos 2 dias reais + blindagem de piso.', 'inferencia', 3)
  on conflict (exam_tag, tipo) do nothing;

-- demais concursos: anual e reta final (os outros tipos entram depois)
insert into trilha_planos (exam_tag, tipo, nome, descricao, status_dado, ordem) values
  ('epcar', 'anual',      'EPCAR — Trilha Anual',  'Tronco + redação (25% da nota) cedo.', 'inferencia', 0),
  ('epcar', 'reta_final', 'EPCAR — Reta Final',    'Bloco único ~5h20 + redação que pontua.', 'inferencia', 3),
  ('espcex','anual',      'EsPCEx — Trilha Anual', 'Mat/Port (peso 2) + Inglês/Física (1,5) + Literatura.', 'inferencia', 0),
  ('espcex','reta_final', 'EsPCEx — Reta Final',   'Simulados nos 2 dias + redação no Dia 1.', 'inferencia', 3),
  ('esa',   'anual',      'ESA — Trilha Anual',    'Acima da mediana em todas as 4 partes; Inglês de alto ROI.', 'inferencia', 0),
  ('esa',   'reta_final', 'ESA — Reta Final',      '50 questões + redação cronometrada.', 'inferencia', 3),
  ('eear',  'anual',      'EEAR — Trilha Anual',   'Blindar a matéria mais fraca (em geral Física); 50% exatas.', 'inferencia', 0),
  ('eear',  'reta_final', 'EEAR — Reta Final',     '96 questões em 4h20: treino de velocidade.', 'inferencia', 3)
  on conflict (exam_tag, tipo) do nothing;

-- ------------------------------------------------------------
-- 2) Missões (starter). Critério de conclusão = volume mínimo E
--    acurácia em janela móvel (texto). XP preliminar.
-- ------------------------------------------------------------
insert into missoes (id, exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, prioridade, qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao, criterio_excelencia, xp_sugerido, origem, status_dado, ordem) values
  ('a1000000-0000-4000-8000-000000000001', 'cn', 'mat', '90000000-0000-4000-8000-000000000006', 'avancado',
   'Fechar Geometria Plana', 'Parar de perder ponto em áreas, semelhança e relações métricas.', 'alta', 60, 120,
   '≥60 questões e ≥80% nas últimas 30 (incluindo nível 3).', 'Gabaritar um bloco nível 3 sob tempo.', 100, 'Consolidação Fase 15.0 §10', 'inferencia', 0),
  ('a1000000-0000-4000-8000-000000000002', 'cn', 'por', null, 'intermediario',
   'Domando a Crase', 'Eliminar o erro recorrente de crase.', 'media', 40, 60,
   '≥40 questões e ≥75% nas últimas 20.', '≥90% nas últimas 20.', 50, 'Consolidação Fase 15.0 §10', 'inferencia', 1),
  ('a1000000-0000-4000-8000-000000000003', 'cn', 'bio', '90000000-0000-4000-8000-000000000001', 'base',
   'Citologia sem susto', 'Dominar membrana, organelas e divisão celular.', 'baixa', 30, 45,
   '≥30 questões e ≥70% nas últimas 20.', '≥85% nas últimas 20.', 40, 'Programa catalogado (CN)', 'inferencia', 2),
  ('a1000000-0000-4000-8000-000000000004', 'espcex', 'por', '90000000-0000-4000-8000-000000000010', 'intermediario',
   'Literatura que cai', 'Cobrir do Quinhentismo ao Modernismo com leitura de época.', 'media', 40, 90,
   '≥40 questões e ≥70% nas últimas 20.', '≥85% nas últimas 20.', 55, 'Programa oficial EsPCEx', 'inferencia', 0),
  ('a1000000-0000-4000-8000-000000000005', 'espcex', 'mat', '90000000-0000-4000-8000-000000000013', 'avancado',
   'Geometria Analítica', 'Dominar retas, circunferência e cônicas.', 'alta', 50, 120,
   '≥50 questões e ≥80% nas últimas 30.', 'Resolver nível IME/ITA sob tempo.', 90, 'Programa oficial EsPCEx', 'inferencia', 1),
  ('a1000000-0000-4000-8000-000000000006', 'eear', 'fis', null, 'intermediario',
   'Blindar Física (Mecânica)', 'Subir o piso em Cinemática e Leis de Newton (anti-eliminação).', 'alta', 40, 90,
   '≥40 questões, ≥60% e nenhuma sessão <50%.', '≥75% nas últimas 30.', 70, 'Estratégia de piso (EEAR)', 'inferencia', 0),
  ('a1000000-0000-4000-8000-000000000007', 'esa', 'ing', null, 'intermediario',
   'Inglês de Alto Retorno', 'Explorar a maior alavancagem da ESA (2,5%/questão).', 'alta', 30, 60,
   '≥30 questões e ≥70% nas últimas 20.', '≥85% nas últimas 20.', 60, 'Leitura estratégica (ESA)', 'inferencia', 0),
  ('a1000000-0000-4000-8000-000000000008', 'epcar', 'red', null, 'base',
   'Redação que Pontua', 'Treinar o dissertativo-argumentativo que vale 1/4 da nota.', 'alta', null, 120,
   '4 textos corrigidos acima do piso (2 seguidos).', 'Nota ≥ alvo da escola em 2 textos seguidos.', 80, 'Edital EA CPCAR (redação classif.)', 'inferencia', 0)
  on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3) Missões na trilha anual do CN (fases do macro-ciclo).
-- ------------------------------------------------------------
insert into trilha_plano_missoes (plano_id, missao_id, fase, semana_sugerida, ordem) values
  ('b1000000-0000-4000-8000-0000000000c1', 'a1000000-0000-4000-8000-000000000003', 'Fundação',       3,  0),  -- Citologia (base)
  ('b1000000-0000-4000-8000-0000000000c1', 'a1000000-0000-4000-8000-000000000002', 'Consolidação',   12, 1),  -- Crase (inter)
  ('b1000000-0000-4000-8000-0000000000c1', 'a1000000-0000-4000-8000-000000000001', 'Aprofundamento', 28, 2)   -- Geometria Plana (avançado)
  on conflict (plano_id, missao_id) do nothing;

-- ------------------------------------------------------------
-- 4) DEMO: a escola Vitrine ajusta a missão "Domando a Crase"
--    (mais questões que o desenho oficial) — desvio sinalizado.
-- ------------------------------------------------------------
insert into missoes_escola (escola_id, missao_id, ativa, qtd_questoes, criterio_conclusao, desvio_do_edital, ajustado_por) values
  ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', true, 60,
   '≥60 questões e ≥75% nas últimas 20.', true, 'aaaaaaaa-0000-4000-8000-000000000001')
  on conflict (escola_id, missao_id) do nothing;

-- ------------------------------------------------------------
-- 5) CRITÉRIO ESTRUTURADO de fechamento (motor de progresso, PED1).
--    O `criterio_conclusao` textual continua para a UI; o motor fecha
--    a missão por número: meta_questoes (volume) + meta_acuracia
--    (domínio na matéria). Volume vem do que a missão já sugeria;
--    a acurácia-piso é um padrão de domínio uniforme (🟡 calibrar por
--    edital). Sem qtd sugerida (ex.: redação), a missão não fecha
--    sozinha — fica como acompanhamento manual da coordenação.
-- ------------------------------------------------------------
update missoes
  set meta_questoes = coalesce(meta_questoes, qtd_questoes_sugerida),
      meta_acuracia = coalesce(meta_acuracia, 70)
  where qtd_questoes_sugerida is not null and meta_questoes is null;
