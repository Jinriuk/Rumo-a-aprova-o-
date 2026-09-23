-- ============================================================
-- DEMO 90 — ROLLBACK: desliga o mecanismo e devolve o Meridiano ao
-- estado de 23/09/2026 ANTES do D07/D09 (backup do 02)
-- ------------------------------------------------------------
-- SÓ projeto de demonstração. Use se o mecanismo precisar sair do ar.
-- Atenção: isto desfaz também o D07 (voltam o registro e os 2
-- simulados do Enzo; o backup foi tirado antes do estorno, então os 3
-- eventos dele voltam válidos e o XP volta a 100) e o D09 (semana 1
-- de 9 dias, de 22/08 a 30/08).
-- Para desligar sem desfazer o D07/D09, use o 91.
--
-- Não toca em logs_acesso nem em consentimentos. Idempotente.
-- ============================================================
begin;

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'supabase/demo: Meridiano/plano demo ausente — abortado';
  end if;
  if to_regclass('demo.backup_20260923_registros_estudo') is null then
    raise exception 'backup de 23/09 não encontrado — nada foi feito';
  end if;
end $$;

select cron.unschedule(jobid) from cron.job
 where jobname in ('demo-virada-semanal', 'demo-liberacao-diaria');
update demo.estado set pausado = true, ancora = null, atualizado_em = now();
delete from demo.fila;

set local session_replication_role = replica;

delete from public.meta_atividades         where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.metas                   where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.aluno_eventos_progresso where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.simulados               where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.registros_estudo        where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.aluno_missoes           where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.aluno_nivel_historico   where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.aluno_niveis            where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

insert into public.registros_estudo        select * from demo.backup_20260923_registros_estudo;
insert into public.simulados               select * from demo.backup_20260923_simulados;
insert into public.metas                   select * from demo.backup_20260923_metas;
insert into public.meta_atividades         select * from demo.backup_20260923_meta_atividades;
insert into public.aluno_eventos_progresso select * from demo.backup_20260923_aluno_eventos_progresso;
insert into public.aluno_niveis            select * from demo.backup_20260923_aluno_niveis;
insert into public.aluno_nivel_historico overriding system value
                                           select * from demo.backup_20260923_aluno_nivel_historico;
insert into public.aluno_missoes           select * from demo.backup_20260923_aluno_missoes;

update public.trilha_semanas ts
   set inicio = b.inicio, fim = b.fim
  from demo.backup_20260923_trilha_semanas b
 where ts.id = b.id and ts.trilha_id = 'dddddddd-0000-4000-8000-000000000001';

set local session_replication_role = origin;

insert into demo.execucoes (acao, hoje, detalhe)
values ('restaurar_backup_20260923', app.hoje_local(), '{}');

commit;
