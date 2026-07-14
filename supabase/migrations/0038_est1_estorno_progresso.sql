-- ============================================================
-- 0038 — EST1-A1: ESTORNO NO DELETE (ledger de XP não inflável)
-- ------------------------------------------------------------
-- Achado EST0 (BANCO-02 / A2, confirmado adversarialmente): a RLS dá ao
-- aluno INSERT e DELETE em `simulados` (0002:197-201). Cada INSERT
-- credita +50 XP no ledger com idempotency_key amarrada ao id NOVO
-- ('simulado:'||new.id, 0024:198-221) — e não existia NENHUM gatilho de
-- DELETE. O ciclo inserir → apagar → inserir de novo inflava XP sem
-- limite, contradizendo a doutrina declarada na própria 0024
-- ("impossível de forjar pelo aluno") e corrompendo ranking/patente.
--
-- Correção mínima e auditável: AFTER DELETE em `simulados` e
-- `registros_estudo` marca status='estornado' nos eventos cuja ORIGEM
-- sumiu. Nada é apagado do ledger — a auditoria preserva o que
-- aconteceu ('estornado' fica no histórico mas não pontua, 0024 §1).
-- Nenhum consumidor muda: vw_aluno_xp_total (0024:230) e
-- carregarXpPersistido (app/src/shared/data/index.js) já somam apenas
-- status='valido'.
--
-- FORA DO ESCOPO (deliberado): `meta_atividades` NÃO ganha estorno —
-- objetivos de meta são geridos pelo servidor (gerar_meta/virada), o
-- aluno não os apaga, e um estorno ali invalidaria XP legítimo caso o
-- motor regenere uma meta. A idempotência da 0024 (mesma key ao
-- reabrir+reconcluir) já impede inflar por esse caminho.
--
-- Aditiva. Idempotente (create or replace / drop trigger if exists).
-- Não altera 0001–0037.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ESTORNO GENÉRICO POR ORIGEM — SECURITY DEFINER como os demais
--    gatilhos do motor (0024 §4): o aluno não tem UPDATE no ledger,
--    quem estorna é o banco, derivando da exclusão REAL da linha.
--    tg_table_name casa com referencia_tabela ('simulados' /
--    'registros_estudo') gravado pelos gatilhos de INSERT da 0024.
-- ------------------------------------------------------------
create or replace function app.estornar_progresso_de_origem() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  update aluno_eventos_progresso
     set status   = 'estornado',
         metadata = metadata || jsonb_build_object(
           'estornado_em',   now(),
           'estorno_motivo', 'origem_apagada:' || tg_table_name
         )
   where referencia_tabela = tg_table_name
     and referencia_id     = old.id
     and status            = 'valido';
  return old;
end $$;

comment on function app.estornar_progresso_de_origem() is
  'EST1-A1 (0038): marca estornado no ledger quando a linha de origem some. '
  'Fecha o ciclo inserir/apagar que inflava XP (achado EST0 BANCO-02).';

-- 2) Gatilhos — só nas tabelas que o ALUNO pode apagar por RLS.
drop trigger if exists trg_estorno_simulado on simulados;
create trigger trg_estorno_simulado
  after delete on simulados
  for each row execute function app.estornar_progresso_de_origem();

drop trigger if exists trg_estorno_registro on registros_estudo;
create trigger trg_estorno_registro
  after delete on registros_estudo
  for each row execute function app.estornar_progresso_de_origem();
