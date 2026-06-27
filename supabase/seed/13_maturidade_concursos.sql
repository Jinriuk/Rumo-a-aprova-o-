-- ============================================================
-- SEED — MATURIDADE DE CONTEÚDO POR CONCURSO (PED2)
-- GERADO por scripts/gerar-seed-maturidade.mjs a partir de
-- app/src/modules/conteudo/maturidade.js — NÃO editar à mão.
-- Carimba concursos.maturidade / conteudo_versao (migration 0024).
-- Idempotente: UPDATE por código; roda depois de 05_concursos.sql.
-- ============================================================

update concursos set maturidade = 'completa', conteudo_versao = 1
  where codigo = 'cn';  -- 9 semanas, 33 atividades-modelo, estrutura de prova oficial e missões. Testado de ponta a ponta.
update concursos set maturidade = 'beta', conteudo_versao = 1
  where codigo = 'espcex';  -- Estrutura de prova oficial (2 dias, pesos), assuntos de Matemática/Português/Química e missões. Falta calendário semanal.
update concursos set maturidade = 'esqueleto', conteudo_versao = 1
  where codigo = 'epcar';  -- Estrutura de prova oficial e 1 missão de redação. Sem assuntos catalogados nem calendário.
update concursos set maturidade = 'esqueleto', conteudo_versao = 1
  where codigo = 'esa';  -- Estrutura de prova oficial (4 partes) e 1 missão de inglês. Sem assuntos catalogados nem calendário.
update concursos set maturidade = 'esqueleto', conteudo_versao = 1
  where codigo = 'eear';  -- Estrutura de prova oficial (96 questões) e 1 missão de física. Sem assuntos catalogados nem calendário.
update concursos set maturidade = 'indisponivel', conteudo_versao = 0
  where codigo = 'cm';  -- Apenas cadastrado em concursos. Sem prova, assuntos, missões ou trilha. Não receber alunos.
