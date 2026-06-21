-- ============================================================
-- DB1-B — Reconciliação NÃO destrutiva do ledger de migrations
-- ------------------------------------------------------------
-- Contexto: o objeto `motor_progresso` foi aplicado no banco remoto em
-- 2026-06-19 sob o NOME `0022_motor_progresso` (version 20260619004620).
-- O repositório o versiona como `0024_motor_progresso.sql`. A guarda
-- `scripts/checar-migrations.mjs` compara por NOME, então enxergava:
--   • FALTANDO no banco: 0024_motor_progresso   (exit 1, "não publique")
--   • DRIFT no banco:    0022_motor_progresso
-- ...mesmo com o schema 100% aplicado. Isto deixava a guarda vermelha e
-- mascarava drift real (armadilha de `supabase db push`).
--
-- Este script alinha o LEDGER ao repositório (fonte canônica). É só
-- metadado: nenhum schema, nenhuma linha de aplicação é tocada. É
-- idempotente e seguro de rodar mais de uma vez.
--
-- JÁ FOI APLICADO no projeto remoto durante a DB1 (2026-06-21). Mantido
-- aqui para auditoria e para qualquer ambiente que ainda não tenha sido
-- reconciliado.
-- ============================================================
do $$
begin
  if exists (select 1 from supabase_migrations.schema_migrations where name = '0022_motor_progresso')
     and not exists (select 1 from supabase_migrations.schema_migrations where name = '0024_motor_progresso') then
    update supabase_migrations.schema_migrations
       set name = '0024_motor_progresso'
     where name = '0022_motor_progresso';
    raise notice 'ledger reconciliado: 0022_motor_progresso -> 0024_motor_progresso';
  else
    raise notice 'nada a fazer (ja reconciliado ou estado inesperado)';
  end if;
end $$;
