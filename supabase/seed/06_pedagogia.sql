-- ============================================================
-- SEED — FUNDAÇÃO PEDAGÓGICA (Fase 15.1) · conteúdo global
-- ------------------------------------------------------------
-- Popula a config OFICIAL 1:1 dos concursos (modelo de eliminação,
-- papel da redação, especialidade/ciclo) e o catálogo de turmas
-- comerciais. Tudo conforme o doc "Fase 15.0 — Consolidação
-- Pedagógica". Os valores 🟢 do doc entram como 'oficial'; o que o
-- doc trata como leitura estratégica entra como 'inferencia'.
--
-- Roda DEPOIS de 05_concursos.sql (os concursos já existem) e é
-- idempotente (on conflict / where). Mapeamento de códigos:
--   cn=Colégio Naval · epcar=EPCAR · espcex=EsPCEx ·
--   essa=ESA (EsSA/ESA) · eear=EEAR · cm=Colégio Militar.
-- O doc chama a EsSA de "ESA"; no sistema o código é `essa`.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Config oficial 1:1 por concurso (colunas de concursos).
--    Modelo de eliminação e papel da redação são fatos do edital.
-- ------------------------------------------------------------
update concursos set elimination_model = 'absoluto_50', redacao_role = 'eliminatoria',                  status_dado = 'oficial' where codigo = 'cn';
update concursos set elimination_model = 'absoluto_5',  redacao_role = 'eliminatoria_classificatoria',  status_dado = 'oficial' where codigo = 'epcar';
update concursos set elimination_model = 'mediana',     redacao_role = 'eliminatoria_classificatoria',  status_dado = 'oficial' where codigo = 'espcex';
update concursos set elimination_model = 'mediana',     redacao_role = 'eliminatoria',                  status_dado = 'oficial' where codigo = 'essa';
update concursos set elimination_model = 'absoluto_5',  redacao_role = 'ausente', usa_especialidade = true, usa_ciclo = true, status_dado = 'oficial' where codigo = 'eear';
-- Colégio Militar fica fora do escopo pedagógico desta fase: config
-- de eliminação/redação permanece nula (a tratar quando entrar).

-- ------------------------------------------------------------
-- 2) Turmas comerciais iniciais e os concursos que cada uma cobre.
--    A turma é só rótulo de venda; o aluno escolhe o alvo ativo
--    (CN ou EPCAR; ESA ou EEAR) entre os concursos da turma.
-- ------------------------------------------------------------
insert into turmas_comerciais (id, codigo, nome, ordem) values
  ('70000000-0000-4000-8000-000000000001', 'cn-epcar', 'CN/EPCAR', 0),
  ('70000000-0000-4000-8000-000000000002', 'esa-eear', 'ESA/EEAR', 1),
  ('70000000-0000-4000-8000-000000000003', 'espcex',   'EsPCEx',   2)
  on conflict (codigo) do nothing;

insert into turmas_comerciais_concursos (turma_comercial_codigo, exam_tag, ordem) values
  ('cn-epcar', 'cn',     0),
  ('cn-epcar', 'epcar',  1),
  ('esa-eear', 'essa',   0),
  ('esa-eear', 'eear',   1),
  ('espcex',   'espcex', 0)
  on conflict (turma_comercial_codigo, exam_tag) do nothing;

-- ------------------------------------------------------------
-- 3) Config oficial chave-valor: o PISO de cada concurso e o papel
--    da redação, com a fonte do edital e o status do dado. Aqui
--    fica o detalhe que não cabe em coluna 1:1. As subfases 15.2+
--    acrescentam prioridades, pesos e volumes nesta mesma tabela.
-- ------------------------------------------------------------
insert into config_oficial (exam_tag, chave, valor, status_dado, fonte, observacao) values
  -- Piso por disciplina (modelo de eliminação detalhado)
  ('cn',     'piso_disciplina', '{"tipo": "absoluto", "pct": 50}'::jsonb,        'oficial',    'Edital CPACN, subitem 6.5',          'Eliminação individual: <50% em qualquer disciplina elimina.'),
  ('epcar',  'piso_disciplina', '{"tipo": "absoluto", "nota_min": 5.0}'::jsonb,  'oficial',    'Edital EA CPCAR',                    '≥5,0/10 em cada matéria e na Média Final.'),
  ('eear',   'piso_disciplina', '{"tipo": "absoluto", "nota_min": 5.0}'::jsonb,  'oficial',    'Edital EA CFS (EEAR)',               '≥5,0/10 por matéria e média ≥5,0.'),
  ('essa',   'piso_disciplina', '{"tipo": "mediana"}'::jsonb,                    'oficial',    'Edital ESA, Art. 68, inc. I',        'Piso RELATIVO: ≥ mediana da turma em cada parte. Sem alvo absoluto oficial.'),
  ('espcex', 'piso_disciplina', '{"tipo": "mediana"}'::jsonb,                    'oficial',    'Edital EsPCEx (DECEx/VUNESP)',       'Piso RELATIVO: ≥ mediana em cada prova objetiva + redação APTA.'),
  -- Papel da redação (detalhe do edital)
  ('cn',     'redacao', '{"papel": "eliminatoria", "linhas_min": 15, "linhas_max": 30, "minimo": 50}'::jsonb,                'oficial', 'Edital CPACN',  'Só eliminatória (≥50/100).'),
  ('epcar',  'redacao', '{"papel": "eliminatoria_classificatoria", "linhas_min": 20, "linhas_max": 30, "nota_min": 5.0}'::jsonb, 'oficial', 'Edital EA CPCAR', 'Vale 1/4 da Média Final: maior alavancagem isolada.'),
  ('essa',   'redacao', '{"papel": "eliminatoria", "linhas_min": 20, "linhas_max": 30, "nota_min": 5.0}'::jsonb,             'oficial', 'Edital ESA',    'Barreira (≥5,0); não soma na classificação.'),
  ('espcex', 'redacao', '{"papel": "eliminatoria_classificatoria", "peso": 1, "linhas_min": 25, "linhas_max": 30, "minimo": 50}'::jsonb, 'oficial', 'Edital EsPCEx', 'Dissertativo-argumentativo 3ª pessoa; zero se <17 ou >38 linhas.'),
  ('eear',   'redacao', '{"papel": "ausente"}'::jsonb,                                                                       'oficial', 'Edital EA CFS', 'EEAR não tem redação.'),
  -- Leitura estratégica (juízo pedagógico do doc) → INFERÊNCIA, não regra fixa.
  ('essa',   'foco_estrategico', '{"texto": "Inglês é a maior alavancagem (2,5%/questão, só 10 questões) e o mais negligenciado."}'::jsonb, 'inferencia', 'Consolidação Fase 15.0, §1.2', 'Default editável; não é regra de edital.'),
  ('espcex', 'foco_estrategico', '{"texto": "Inglês (peso 1,5) vale mais por questão que História, Geografia e Química (peso 1,0)."}'::jsonb, 'inferencia', 'Consolidação Fase 15.0, §5', 'Default editável; não é regra de edital.'),
  ('eear',   'foco_estrategico', '{"texto": "Corrida contra o tempo (2,5 min/questão); blindar a matéria mais fraca (em geral Física) antes de buscar nota alta."}'::jsonb, 'inferencia', 'Consolidação Fase 15.0, §4', 'Default editável; não é regra de edital.'),
  -- Recorrência por assunto: o ativo proprietário ainda não medido → VALIDAR.
  ('cn',     'recorrencia_status',     '{"medida": false}'::jsonb, 'validar', 'Pendente de tagueamento de provas reais', 'Recorrência por assunto ainda não medida questão a questão.'),
  ('epcar',  'recorrencia_status',     '{"medida": false}'::jsonb, 'validar', 'Pendente de tagueamento de provas reais', 'Recorrência por assunto ainda não medida questão a questão.'),
  ('espcex', 'recorrencia_status',     '{"medida": false}'::jsonb, 'validar', 'Pendente de tagueamento de provas reais', 'Recorrência por assunto ainda não medida questão a questão.'),
  ('essa',   'recorrencia_status',     '{"medida": false}'::jsonb, 'validar', 'Pendente de tagueamento de provas reais', 'Recorrência por assunto ainda não medida questão a questão.'),
  ('eear',   'recorrencia_status',     '{"medida": false}'::jsonb, 'validar', 'Pendente de tagueamento de provas reais', 'Recorrência por assunto ainda não medida questão a questão.')
  on conflict (exam_tag, chave) do nothing;

-- ------------------------------------------------------------
-- 4) DEMO (só ambiente dev): vincula os alunos semeados à turma
--    comercial CN/EPCAR e mostra um override de escola COM desvio
--    do edital — material para as telas e para os testes de RLS.
--    Guardado às escolas de demo; idempotente.
-- ------------------------------------------------------------
update alunos set turma_comercial_codigo = 'cn-epcar'
  where id in ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001')
    and turma_comercial_codigo is null;

-- A escola Vitrine ajusta o volume semanal de Matemática do CN acima
-- do default — exemplo de override que DIVERGE da referência oficial.
insert into config_escola (id, escola_id, exam_tag, chave, valor, desvio_do_edital, ajustado_por) values
  ('60000000-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111', 'cn', 'volume_semanal_mat',
   '{"questoes": 320}'::jsonb, true, 'aaaaaaaa-0000-4000-8000-000000000001')
  on conflict (escola_id, exam_tag, chave) do nothing;
