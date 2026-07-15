-- ============================================================
-- 0040 — EST1-A3: ESCRITA DO ALUNO EM meta_atividades RESTRITA POR COLUNA
-- ------------------------------------------------------------
-- Achado EST0 BANCO-03: a policy meta_atividades_update_aluno (0002)
-- restringe a LINHA (só objetivo da própria meta), mas não a COLUNA —
-- o grant em lote da 0001 dava UPDATE em todas. Um aluno podia trocar
-- atividade_modelo_id para uma atividade de prioridade F antes de
-- concluir e maximizar o XP (100 em vez de 40/60), ou mudar meta_id e
-- bagunçar a composição da meta.
--
-- Correção: privilégio de UPDATE por COLUNA. O aluno (papel
-- authenticated) só escreve o que o produto realmente permite:
--   • estado         — concluir/reabrir/ignorar o objetivo (Doc 6, 1.3)
--   • atualizado_em  — carimbo que o seam envia junto (definirEstadoAtividade)
-- Qualquer outra coluna vira "permission denied" ANTES da RLS.
-- O service_role (motor/gerar_meta) mantém o privilégio de tabela.
-- RLS de linha continua a mesma (0002) — as duas camadas se somam.
--
-- Idempotente: revoke/grant podem rodar de novo sem efeito colateral.
-- ============================================================

revoke update on meta_atividades from authenticated;
grant update (estado, atualizado_em) on meta_atividades to authenticated;

comment on table meta_atividades is
  'Objetivos da meta semanal. EST1-A3 (0040): aluno só atualiza '
  'estado/atualizado_em (privilégio por coluna); linha segue gateada '
  'pela RLS 0002. Motor escreve via service_role/SECURITY DEFINER.';
