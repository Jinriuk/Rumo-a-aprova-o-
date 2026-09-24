-- ============================================================
-- DEMO 91 — desligar o mecanismo SEM desfazer dados
-- ------------------------------------------------------------
-- SÓ projeto de demonstração. Remove os dois jobs e pausa as funções
-- (que passam a só registrar 'pausado' em demo.execucoes se alguém as
-- chamar). O Meridiano fica como está e volta a envelhecer: na
-- segunda seguinte a virada global fecha a semana 4 e gera a 5.
-- Para religar: demo.pausar(false), 06_ativar.sql e 07_agendamento.sql.
-- ============================================================
select cron.unschedule(jobid) from cron.job
 where jobname in ('demo-virada-semanal', 'demo-liberacao-diaria');
select demo.pausar(true);
