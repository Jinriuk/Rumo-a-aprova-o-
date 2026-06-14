-- ============================================================
-- SEED — RECORRÊNCIA E TAGUEAMENTO (Fase 15.7) · conteúdo global
-- ------------------------------------------------------------
-- Exemplo MÍNIMO que prova a estrutura ponta a ponta: uma prova
-- anterior do CN, algumas questões tagueadas por assunto, e a
-- recorrência nos três graus de confiança (estimada/validada/medida).
-- A recorrência REAL completa é o trabalho contínuo do tagueamento —
-- aqui só semeamos o suficiente para validar a estrutura. Idempotente.
-- ============================================================

-- Prova anterior real do CN (referência; status validar até conferência).
insert into provas_anteriores (id, exam_tag, ano, etapa, fonte, observacao, status_dado) values
  ('d1000000-0000-4000-8000-000000000001', 'cn', 2024, 'Exame Intelectual',
   'Prova oficial CPACN 2024', 'Amostra para validar o tagueamento.', 'validar')
  on conflict (exam_tag, ano, etapa) do nothing;

-- Tagueamento de algumas questões por assunto (Geometria Plana e Citologia).
insert into questoes_prova (id, prova_anterior_id, numero, materia_codigo, assunto_id, gabarito, observacao) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 1,  'mat', '90000000-0000-4000-8000-000000000006', 'C', 'Áreas e semelhança'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 2,  'mat', '90000000-0000-4000-8000-000000000006', 'A', 'Relações métricas'),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 51, 'bio', '90000000-0000-4000-8000-000000000001', 'B', 'Citologia: organelas')
  on conflict (prova_anterior_id, numero) do nothing;

-- Recorrência por assunto nos TRÊS graus de confiança:
insert into recorrencia_assunto (exam_tag, materia_codigo, assunto_id, anos, num_questoes, pct_materia, tipo, fonte, observacao) values
  -- ESTIMADA (preliminar, inferência) — NÃO promove prioridade sozinha
  ('cn', 'mat', '90000000-0000-4000-8000-000000000006', 15, null, 25.00, 'estimada', 'Análise preliminar (cursinhos/NotebookLM)', 'Indicativo; não tagueado questão a questão.'),
  ('cn', 'bio', '90000000-0000-4000-8000-000000000001', 15, null, 18.00, 'estimada', 'Análise preliminar', 'Indicativo; Biologia é frente de manutenção no CN.'),
  -- MEDIDA (contada nas provas tagueadas acima) — Geometria Plana: 2 questões
  ('cn', 'mat', '90000000-0000-4000-8000-000000000006', 1, 2, null, 'medida', 'Tagueamento CPACN 2024', 'Contagem real das questões tagueadas (amostra de 1 ano).')
  on conflict (exam_tag, assunto_id, tipo) do nothing;
