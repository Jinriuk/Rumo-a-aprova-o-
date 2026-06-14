-- ============================================================
-- 0014 — SIMULADO POR CONCURSO (Fase 15.6)
-- ------------------------------------------------------------
-- O simulado passa a poder se amarrar a um CONCURSO (exam_tag) e a
-- guardar a nota da REDAÇÃO. A avaliação (nota por matéria/dia,
-- modelo de eliminação, papel da redação, risco, comparação com
-- meta, insumo para nível) é lógica PURA sobre a estrutura da 15.2
-- (prova_materias/prova_dias) — não precisa de coluna nova além
-- destas duas. Aditiva: a tabela `simulados` da 14.5 segue válida
-- (acertos jsonb por matéria); estas colunas são opcionais.
--
-- A RLS de `simulados` (0002) já cobre as novas colunas: aluno
-- escreve o próprio, coordenação/responsável leem no escopo certo.
-- Idempotente.
-- ============================================================

alter table simulados
  add column if not exists exam_tag     text references concursos (codigo),
  add column if not exists redacao_nota numeric(5,2) check (redacao_nota is null or redacao_nota >= 0);

create index if not exists idx_simulados_exam on simulados (exam_tag);
