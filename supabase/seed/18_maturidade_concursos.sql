-- ============================================================
-- SEED — MATURIDADE DE CONTEÚDO POR CONCURSO (PED2)
-- GERADO por scripts/gerar-seed-maturidade.mjs a partir de
-- app/src/modules/conteudo/maturidade.js — NÃO editar à mão.
-- Carimba concursos.maturidade / conteudo_versao (migration 0034).
-- Idempotente: UPDATE por código; roda depois de 05_concursos.sql.
-- ============================================================

update concursos set maturidade = 'completa', conteudo_versao = 1
  where codigo = 'cn';  -- 9 semanas, 50 atividades-modelo, estrutura de prova oficial e missões. Testado de ponta a ponta.
update concursos set maturidade = 'completa', conteudo_versao = 3
  where codigo = 'espcex';  -- Calendário próprio de 9 semanas, 24 missões, programa vigente de 2026 e 200 questões oficiais de 2024–2025 tagueadas.
update concursos set maturidade = 'pre_edital', conteudo_versao = 1
  where codigo = 'pmerj_cfo';  -- Pré-edital, sem data de prova. Calendário de 12 semanas e 219 linhas do Anexo II CFO PMERJ 2024 (base histórica); 24 missões escritas, das semanas 1 a 4. As 48 das semanas 5 a 12 ainda não foram escritas.
update concursos set maturidade = 'esqueleto', conteudo_versao = 1
  where codigo = 'epcar';  -- Estrutura de prova oficial e 1 missão de redação. Sem assuntos catalogados nem calendário.
update concursos set maturidade = 'esqueleto', conteudo_versao = 1
  where codigo = 'esa';  -- Estrutura de prova oficial (4 partes) e 1 missão de inglês. Sem assuntos catalogados nem calendário.
update concursos set maturidade = 'esqueleto', conteudo_versao = 1
  where codigo = 'eear';  -- Estrutura de prova oficial (96 questões) e 1 missão de física. Sem assuntos catalogados nem calendário.
update concursos set maturidade = 'indisponivel', conteudo_versao = 0
  where codigo = 'cm';  -- Apenas cadastrado em concursos. Sem prova, assuntos, missões ou trilha. Não receber alunos.
