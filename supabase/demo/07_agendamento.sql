-- ============================================================
-- DEMO 07 — agendamento no pg_cron (SÓ projeto de demonstração)
-- ------------------------------------------------------------
-- Fora de supabase/migrations de propósito: a migration 0004 é
-- compartilhada com produção, e o documento proíbe cron de
-- demonstração em migration compartilhada. Este arquivo só roda no
-- projeto bdjkgrzfzoamchdpobbl, à mão.
--
-- Horários em UTC (o pg_cron do Supabase roda em UTC; Brasil não tem
-- horário de verão desde 2019, então o deslocamento é fixo em -3h):
--   demo-virada-semanal    0 3 * * 1   segunda 00:00 de Brasília —
--                                      antes da virada global
--                                      (virar-semana-diaria, 03:05 UTC),
--                                      que então encontra a meta da
--                                      semana 4 já criada e não mexe
--   demo-liberacao-diaria 10 3 * * *   todo dia 00:10 de Brasília
--
-- Se a virada de segunda falhar, a liberação das 00:10 percebe que a
-- âncora não é desta semana e refaz a semana inteira sozinha
-- (demo.liberar → demo.virar_semana). Se as duas falharem, a virada
-- global das 03:05 fecha a semana 4 e gera a 5 — o Meridiano volta a
-- envelhecer até alguém rodar o 06.
--
-- Idempotente: remove os jobs de mesmo nome antes de criar.
-- ============================================================

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'supabase/demo: Meridiano/plano demo ausente — este não é o projeto de demonstração';
  end if;
end $$;

select cron.unschedule(jobid) from cron.job
 where jobname in ('demo-virada-semanal', 'demo-liberacao-diaria');

select cron.schedule('demo-virada-semanal',   '0 3 * * 1',  $$select demo.virar_semana()$$);
select cron.schedule('demo-liberacao-diaria', '10 3 * * *', $$select demo.liberar()$$);

select jobid, jobname, schedule, command, active from cron.job order by jobid;
