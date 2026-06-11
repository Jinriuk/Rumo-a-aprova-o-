-- ============================================================
-- 0004 — AGENDAMENTO DA VIRADA DE SEMANA (no servidor)
-- ------------------------------------------------------------
-- A virada NÃO depende de o aluno abrir o app. O pg_cron roda
-- app.virar_semana() todo dia às 03:05 UTC = 00:05 em
-- America/Sao_Paulo (Brasil não tem mais horário de verão).
-- Rodar todo dia é barato e cobre qualquer atraso: a função é
-- idempotente (fechar o já fechado e gerar o já gerado não fazem nada).
--
-- Em ambiente local de teste o pg_cron pode não existir; aí o
-- agendamento é pulado com aviso e a função é testada chamando-a
-- direto com datas explícitas (tests/motor.test.mjs).
-- ============================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'virar-semana-diaria',
      '5 3 * * *',
      $cron$ select app.virar_semana(); $cron$
    );
    raise notice 'virada de semana agendada (pg_cron, 03:05 UTC = 00:05 America/Sao_Paulo)';
  else
    raise notice 'pg_cron indisponível neste ambiente — agendamento pulado (ok em teste local)';
  end if;
end $$;
