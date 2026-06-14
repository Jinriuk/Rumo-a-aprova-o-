-- ============================================================
-- SEED — PROVAS, MATÉRIAS, ASSUNTOS (Fase 15.2) · conteúdo global
-- ------------------------------------------------------------
-- Estrutura inicial dos 5 concursos, fiel ao doc "Fase 15.0".
-- Cada concurso é tratado SEPARADAMENTE (CN ≠ EPCAR, ESA ≠ EEAR).
--
-- Convenção de status:
--   • estrutura da prova (matérias, nº de questões, pesos): 🟢 oficial.
--   • lista de assuntos: 🟢 oficial onde o programa do edital foi
--     catalogado (Biologia do CN, Literatura da EsPCEx); 🟡 inferência
--     quando é recorte pedagógico nosso.
--   • PRIORIDADE de assunto: preliminar (deriva de peso × recorrência;
--     a recorrência só será medida na 15.7).
--   • dúvida de edital (ex.: OCR "eletroforese"): ⚠️ validar.
-- Roda depois de 05/06; idempotente. Códigos: cn/epcar/espcex/esa/eear.
-- ============================================================

-- ------------------------------------------------------------
-- Catálogo de matérias (global)
-- ------------------------------------------------------------
insert into materias (codigo, nome, abrev, ordem) values
  ('mat', 'Matemática', 'Mat', 0),
  ('por', 'Português',  'Por', 1),
  ('ing', 'Inglês',     'Ing', 2),
  ('red', 'Redação',    'Red', 3),
  ('fis', 'Física',     'Fís', 4),
  ('qui', 'Química',    'Quí', 5),
  ('bio', 'Biologia',   'Bio', 6),
  ('his', 'História',   'His', 7),
  ('geo', 'Geografia',  'Geo', 8)
  on conflict (codigo) do nothing;

-- ------------------------------------------------------------
-- Provas (fórmula oficial fiel ao edital)
-- ------------------------------------------------------------
insert into provas (exam_tag, nome, num_dias, formula, status_dado, observacao) values
  ('cn',     'Colégio Naval (CPACN)',        2, 'ME = (2·MI + 2·ECP + RE)/5',      'oficial', 'Dia 1: Mat+Inglês (2,5/q). Dia 2: Port+Ciências+Estudos Sociais (2,0/q). Redação eliminatória.'),
  ('epcar',  'EPCAR (EA CPCAR)',             1, 'MF = (GP + GM + GI + GR)/4',      'oficial', 'Bloco único ~5h20. Redação eliminatória + classificatória (1/4 da Média Final).'),
  ('espcex', 'EsPCEx',                       2, 'soma ponderada (pesos por matéria) + redação peso 1', 'oficial', 'Dia 1: Port+Redação+Física+Química. Dia 2: Mat+Inglês+História+Geografia.'),
  ('esa',   'ESA (Área Geral)',             1, '(NM + NQOP + NHGB + NI)/4',       'oficial', '4 partes iguais. Redação só eliminatória. Piso por mediana (Art. 68).'),
  ('eear',   'EEAR (CFS)',                   1, 'média das 4 matérias + piso por matéria', 'oficial', '96 questões / 4h20. Sem redação. Piso absoluto de 5,0 por matéria.')
  on conflict (exam_tag) do nothing;

-- ------------------------------------------------------------
-- Dias / blocos
-- ------------------------------------------------------------
insert into prova_dias (exam_tag, numero, nome, duracao_min, ordem) values
  ('cn',     1, 'Dia 1', 300, 0),
  ('cn',     2, 'Dia 2', 300, 1),
  ('espcex', 1, 'Dia 1', 270, 0),
  ('espcex', 2, 'Dia 2', 270, 1),
  ('epcar',  1, 'Prova única', 320, 0),
  ('esa',   1, 'Prova única', 240, 0),
  ('eear',   1, 'Prova única', 260, 0)
  on conflict (exam_tag, numero) do nothing;

-- ------------------------------------------------------------
-- Matérias na prova (🟢 oficial). CN e EPCAR SEPARADOS; idem ESA/EEAR.
-- ------------------------------------------------------------
insert into prova_materias (exam_tag, materia_codigo, dia_numero, num_questoes, peso, valor_questao, eh_redacao, bloco, status_dado, ordem) values
  -- CN — Dia 1
  ('cn', 'mat', 1, 20, null, 2.5, false, null, 'oficial', 0),
  ('cn', 'ing', 1, 20, null, 2.5, false, null, 'oficial', 1),
  -- CN — Dia 2 (Ciências = Física + Química + Biologia, 6 cada; Estudos Sociais = Hist + Geo, 6 cada)
  ('cn', 'por', 2, 20, null, 2.0, false, null, 'oficial', 2),
  ('cn', 'fis', 2, 6,  null, 2.0, false, 'Ciências', 'oficial', 3),
  ('cn', 'qui', 2, 6,  null, 2.0, false, 'Ciências', 'oficial', 4),
  ('cn', 'bio', 2, 6,  null, 2.0, false, 'Ciências', 'oficial', 5),   -- Biologia do CN (obrigatória nesta subfase)
  ('cn', 'his', 2, 6,  null, 2.0, false, 'Estudos Sociais', 'oficial', 6),
  ('cn', 'geo', 2, 6,  null, 2.0, false, 'Estudos Sociais', 'oficial', 7),
  ('cn', 'red', 2, null, null, null, true, null, 'oficial', 8),
  -- EPCAR (escala 0–10 por matéria; redação elim + classificatória)
  ('epcar', 'por', 1, 16, null, null, false, null, 'oficial', 0),
  ('epcar', 'mat', 1, 16, null, null, false, null, 'oficial', 1),
  ('epcar', 'ing', 1, 16, null, null, false, null, 'oficial', 2),
  ('epcar', 'red', 1, null, null, null, true, null, 'oficial', 3),
  -- EsPCEx — Dia 1
  ('espcex', 'por', 1, 20, 2.0, null, false, null, 'oficial', 0),
  ('espcex', 'red', 1, null, 1.0, null, true, null, 'oficial', 1),
  ('espcex', 'fis', 1, 12, 1.5, null, false, null, 'oficial', 2),
  ('espcex', 'qui', 1, 12, 1.0, null, false, null, 'oficial', 3),
  -- EsPCEx — Dia 2
  ('espcex', 'mat', 2, 20, 2.0, null, false, null, 'oficial', 4),
  ('espcex', 'ing', 2, 12, 1.5, null, false, null, 'oficial', 5),
  ('espcex', 'his', 2, 12, 1.0, null, false, null, 'oficial', 6),
  ('espcex', 'geo', 2, 12, 1.0, null, false, null, 'oficial', 7),
  -- ESA (4 partes iguais)
  ('esa', 'mat', 1, 14, null, null, false, null, 'oficial', 0),
  ('esa', 'por', 1, 14, null, null, false, null, 'oficial', 1),
  ('esa', 'his', 1, 6,  null, null, false, 'História/Geografia', 'oficial', 2),
  ('esa', 'geo', 1, 6,  null, null, false, 'História/Geografia', 'oficial', 3),
  ('esa', 'ing', 1, 10, null, null, false, null, 'oficial', 4),
  ('esa', 'red', 1, null, null, null, true, null, 'oficial', 5),
  -- EEAR (sem redação; 50% exatas)
  ('eear', 'mat', 1, 24, null, null, false, null, 'oficial', 0),
  ('eear', 'fis', 1, 24, null, null, false, null, 'oficial', 1),
  ('eear', 'por', 1, 24, null, null, false, null, 'oficial', 2),
  ('eear', 'ing', 1, 24, null, null, false, null, 'oficial', 3)
  on conflict (exam_tag, materia_codigo) do nothing;

-- ------------------------------------------------------------
-- Assuntos com subassuntos (starter set + obrigatórios do doc).
-- ids fixos onde há subassuntos, para o vínculo ser idempotente.
-- ------------------------------------------------------------
insert into assuntos (id, exam_tag, materia_codigo, nome, prioridade, status_dado, observacao, ordem) values
  -- Biologia do CN — programa catalogado (🟢 oficial); Bio é ~6,7% do CN → manutenção (prioridade baixa)
  ('90000000-0000-4000-8000-000000000001', 'cn', 'bio', 'Citologia',           'baixa', 'oficial', 'Programa catalogado; recorrência ainda não medida (15.7).', 0),
  ('90000000-0000-4000-8000-000000000002', 'cn', 'bio', 'Genética e Evolução', 'baixa', 'oficial', 'Programa catalogado; recorrência ainda não medida (15.7).', 1),
  ('90000000-0000-4000-8000-000000000003', 'cn', 'bio', 'Ecologia',            'baixa', 'oficial', 'Programa catalogado; recorrência ainda não medida (15.7).', 2),
  ('90000000-0000-4000-8000-000000000004', 'cn', 'bio', 'Fisiologia Humana',   'baixa', 'oficial', 'Programa catalogado; recorrência ainda não medida (15.7).', 3),
  ('90000000-0000-4000-8000-000000000005', 'cn', 'bio', 'Saúde Pública',       'baixa', 'oficial', 'Programa catalogado; recorrência ainda não medida (15.7).', 4),
  -- Matemática do CN — núcleo duro (prioridade alta, preliminar)
  ('90000000-0000-4000-8000-000000000006', 'cn', 'mat', 'Geometria Plana',     'alta',  'oficial', 'Núcleo duro do CN; prioridade preliminar (peso × recorrência).', 5),
  -- Português da EsPCEx — Literatura Brasileira (obrigatória nesta subfase; bloco confirmado §5/§15.12)
  ('90000000-0000-4000-8000-000000000010', 'espcex', 'por', 'Literatura Brasileira', 'media', 'oficial', 'Bloco obrigatório do Quinhentismo às tendências contemporâneas; peso 2 (Português).', 0),
  -- Matemática da EsPCEx — programa ampliado (§5)
  ('90000000-0000-4000-8000-000000000013', 'espcex', 'mat', 'Geometria Analítica', 'alta', 'oficial', 'Programa oficial confirmado (Anexo C).', 1),
  ('90000000-0000-4000-8000-000000000014', 'espcex', 'mat', 'Polinômios',          'media', 'oficial', 'Programa oficial confirmado (Anexo C).', 2),
  -- Química da EsPCEx — radioatividade (oficial) + ponto de OCR a conferir (validar)
  ('90000000-0000-4000-8000-000000000011', 'espcex', 'qui', 'Radioatividade',                 'media', 'oficial', 'Programa oficial confirmado (Anexo C).', 3),
  ('90000000-0000-4000-8000-000000000012', 'espcex', 'qui', 'Eletroquímica/Eletrólise',       'media', 'validar', 'Transcrição trouxe "eletroforese" — provável erro de OCR; conferir Anexo C.', 4)
  on conflict (exam_tag, materia_codigo, nome) do nothing;

insert into subassuntos (assunto_id, nome, status_dado, ordem) values
  -- Citologia
  ('90000000-0000-4000-8000-000000000001', 'Membrana plasmática', 'oficial', 0),
  ('90000000-0000-4000-8000-000000000001', 'Organelas',           'oficial', 1),
  ('90000000-0000-4000-8000-000000000001', 'Mitose e meiose',     'oficial', 2),
  -- Genética e Evolução
  ('90000000-0000-4000-8000-000000000002', 'Leis de Mendel',      'oficial', 0),
  ('90000000-0000-4000-8000-000000000002', 'DNA',                 'oficial', 1),
  -- Ecologia
  ('90000000-0000-4000-8000-000000000003', 'Cadeias alimentares', 'oficial', 0),
  ('90000000-0000-4000-8000-000000000003', 'Biomas brasileiros',  'oficial', 1),
  -- Fisiologia Humana
  ('90000000-0000-4000-8000-000000000004', 'Sistema digestório',  'oficial', 0),
  ('90000000-0000-4000-8000-000000000004', 'Sistema circulatório','oficial', 1),
  ('90000000-0000-4000-8000-000000000004', 'Sistema nervoso',     'oficial', 2),
  -- Saúde Pública
  ('90000000-0000-4000-8000-000000000005', 'Parasitoses',         'oficial', 0),
  ('90000000-0000-4000-8000-000000000005', 'ISTs',                'oficial', 1),
  -- Geometria Plana (CN)
  ('90000000-0000-4000-8000-000000000006', 'Áreas',               'oficial', 0),
  ('90000000-0000-4000-8000-000000000006', 'Semelhança',          'oficial', 1),
  ('90000000-0000-4000-8000-000000000006', 'Relações métricas',   'oficial', 2),
  -- Literatura Brasileira (EsPCEx)
  ('90000000-0000-4000-8000-000000000010', 'Quinhentismo',                'oficial', 0),
  ('90000000-0000-4000-8000-000000000010', 'Barroco',                     'oficial', 1),
  ('90000000-0000-4000-8000-000000000010', 'Arcadismo',                   'oficial', 2),
  ('90000000-0000-4000-8000-000000000010', 'Modernismo — 1ª geração',     'oficial', 3),
  ('90000000-0000-4000-8000-000000000010', 'Modernismo — 2ª geração',     'oficial', 4),
  ('90000000-0000-4000-8000-000000000010', 'Modernismo — 3ª geração',     'oficial', 5),
  ('90000000-0000-4000-8000-000000000010', 'Tendências contemporâneas',   'oficial', 6)
  on conflict (assunto_id, nome) do nothing;
