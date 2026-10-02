-- ============================================================
-- CATÁLOGO DE MISSÕES DO DEMO · desfazer
-- ------------------------------------------------------------
-- SÓ projeto de demonstração. Volta o comportamento de antes: nenhuma
-- missão fecha sozinha. NÃO apaga nada:
--   - missões que já existiam: os campos que a seed 20 e a seed 09 §5
--     mudaram voltam ao backup (meta nula de novo);
--   - missões que entraram pela seed 20: ficam no catálogo SEM meta
--     (o motor só usa missão com meta). aluno_missoes e o ledger podem
--     apontar para elas, por isso não saem;
--   - maturidade da EsPCEx volta ao backup;
--   - assuntos, cadernos, questões tagueadas, recorrência, planos,
--     trilha e calendário da EsPCEx que as seeds 19 e 20 inseriram
--     ficam: conteúdo global, inerte sem meta, igual ao da produção.
-- Idempotente. O backup continua (apague à mão quando não servir mais).
-- ============================================================

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'catálogo de missões: Meridiano/plano demo ausente — só roda no projeto de demonstração';
  end if;
  if to_regclass('demo.backup_20261002_missoes') is null then
    raise exception 'catálogo de missões: sem demo.backup_20261002_missoes — nada a desfazer';
  end if;
end $$;

update public.missoes m
   set materia_codigo        = b.materia_codigo,
       assunto_id            = b.assunto_id,
       nivel                 = b.nivel,
       nome                  = b.nome,
       objetivo              = b.objetivo,
       prioridade            = b.prioridade,
       qtd_questoes_sugerida = b.qtd_questoes_sugerida,
       tempo_estimado_min    = b.tempo_estimado_min,
       criterio_conclusao    = b.criterio_conclusao,
       criterio_excelencia   = b.criterio_excelencia,
       xp_sugerido           = b.xp_sugerido,
       origem                = b.origem,
       status_dado           = b.status_dado,
       ordem                 = b.ordem,
       meta_questoes         = b.meta_questoes,
       meta_acuracia         = b.meta_acuracia
  from demo.backup_20261002_missoes b
 where b.id = m.id;

update public.missoes m
   set meta_questoes = null, meta_acuracia = null
 where not exists (select 1 from demo.backup_20261002_missoes b where b.id = m.id)
   and (m.meta_questoes is not null or m.meta_acuracia is not null);

update public.concursos c
   set maturidade = b.maturidade, conteudo_versao = b.conteudo_versao
  from demo.backup_20261002_concursos b
 where b.id = c.id and c.codigo = 'espcex';

insert into demo.execucoes (acao, hoje, detalhe)
values ('catalogo_missoes_desfazer', (now() at time zone 'America/Sao_Paulo')::date,
        jsonb_build_object('missoes_com_meta', (select count(*) from public.missoes where meta_questoes > 0)));
