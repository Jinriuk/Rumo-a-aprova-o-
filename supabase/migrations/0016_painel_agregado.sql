-- ============================================================
-- 0016 — PAINEL AGREGADO: a coordenação não baixa mais TODOS os
-- registros/metas da escola para somar no navegador. Uma função
-- agrega por aluno no banco (usa idx_registros_aluno_data) e
-- devolve uma linha por aluno. Escala para centenas de alunos.
-- ------------------------------------------------------------
-- SECURITY DEFINER + matriz explícita: agregar TODOS os registros
-- da escola sob a RLS faz o Postgres reavaliar a política linha a
-- linha (inclusive app.sou_responsavel_de() por registro) — ~900ms
-- com 15k registros. Aqui a função reproduz a MESMA matriz do Doc 6
-- na cláusula WHERE (tenant pelo JWT + papel), some o custo por
-- linha (~15ms) e não vaza: tudo é filtrado por app.tenant_id(),
-- que vem do token e não pode ser forjado. search_path fixo
-- (doutrina da 0006). É leitura pura.
--   • coordenação: todos os alunos da própria escola
--   • aluno:       só o próprio
--   • responsável: só os vinculados
-- ============================================================

create or replace function public.resumo_escola()
returns table (
  aluno_id            uuid,
  -- geral (toda a vida do aluno)
  questoes_total      bigint,
  ca_questoes_total   bigint,   -- questões em registros COM acerto lançado
  acertos_total       bigint,
  minutos_total       bigint,
  dias_total          bigint,
  -- últimos 7 dias [hoje-6, hoje]
  questoes_7d         bigint,
  ca_questoes_7d      bigint,
  acertos_7d          bigint,
  minutos_7d          bigint,
  dias_7d             bigint,
  ultima_atividade    date,
  -- meta ativa da semana
  meta_feitas         bigint,
  meta_consideradas   bigint
)
language sql
stable
security definer
set search_path = public, app
as $$
  with corte as (
    select (app.hoje_local() - 6) as desde
  ),
  reg as (
    select
      r.aluno_id,
      sum(r.questoes)                                                          as questoes_total,
      sum(r.questoes) filter (where r.acertos is not null)                     as ca_questoes_total,
      sum(r.acertos)  filter (where r.acertos is not null)                     as acertos_total,
      coalesce(sum(r.minutos), 0)                                              as minutos_total,
      count(distinct r.data)                                                   as dias_total,
      sum(r.questoes) filter (where r.data >= (select desde from corte))       as questoes_7d,
      sum(r.questoes) filter (where r.acertos is not null
                                and r.data >= (select desde from corte))       as ca_questoes_7d,
      sum(r.acertos)  filter (where r.acertos is not null
                                and r.data >= (select desde from corte))       as acertos_7d,
      coalesce(sum(r.minutos) filter (where r.data >= (select desde from corte)), 0) as minutos_7d,
      count(distinct r.data) filter (where r.data >= (select desde from corte)) as dias_7d,
      max(r.data)                                                              as ultima_atividade
    from registros_estudo r
    where r.escola_id = app.tenant_id()
    group by r.aluno_id
  ),
  meta as (
    select
      m.aluno_id,
      count(*) filter (where ma.estado = 'concluida')   as feitas,
      count(*) filter (where ma.estado <> 'ignorada')   as consideradas
    from metas m
    join meta_atividades ma on ma.meta_id = m.id
    where m.status = 'ativa' and m.escola_id = app.tenant_id()
    group by m.aluno_id
  )
  select
    a.id,
    coalesce(reg.questoes_total, 0),
    coalesce(reg.ca_questoes_total, 0),
    coalesce(reg.acertos_total, 0),
    coalesce(reg.minutos_total, 0),
    coalesce(reg.dias_total, 0),
    coalesce(reg.questoes_7d, 0),
    coalesce(reg.ca_questoes_7d, 0),
    coalesce(reg.acertos_7d, 0),
    coalesce(reg.minutos_7d, 0),
    coalesce(reg.dias_7d, 0),
    reg.ultima_atividade,
    coalesce(meta.feitas, 0),
    coalesce(meta.consideradas, 0)
  from alunos a
  left join reg  on reg.aluno_id  = a.id
  left join meta on meta.aluno_id = a.id
  -- a MESMA matriz da RLS (Doc 6), agora explícita: o tenant vem do
  -- JWT (não forjável) e o papel decide o alcance.
  where a.escola_id = app.tenant_id()
    and (
      app.papel() = 'coordenacao'
      or a.usuario_id = app.usuario_id()
      or app.sou_responsavel_de(a.id)
    );
$$;

grant execute on function public.resumo_escola() to authenticated, service_role;
