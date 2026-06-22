-- ============================================================
-- 0027 — S1: BLOQUEIO EFETIVO DE ESCOLA SUSPENSA/CANCELADA
-- ------------------------------------------------------------
-- A D0 deu ao operador o poder de suspender/cancelar uma escola
-- (status). A S1 faz esse status VALER na RLS: uma escola fora de
-- operação (suspensa/cancelada) não entrega mais nenhum dado de
-- aluno/turma/registro para a coordenação, aluno ou responsável.
--
-- Porteiro central: app.tenant_operacional() — TRUE quando a escola
-- do tenant NÃO está suspensa/cancelada (e TRUE quando não há tenant,
-- para não derrubar fluxos sem escola). Entra como AND nas policies
-- de leitura/escrita de dado operacional. NÃO entra no SELECT de
-- `escolas` nem no SELECT do próprio usuário em `usuarios` (a pessoa
-- precisa enxergar a própria conta e a escola para o front explicar
-- "acesso suspenso" em vez de mostrar tela vazia sem motivo).
-- Aditiva e idempotente (create or replace / drop policy if exists).
-- ============================================================

create or replace function app.tenant_operacional() returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select e.status not in ('suspensa', 'cancelada')
       from escolas e where e.id = app.tenant_id()),
    true)
$$;
grant execute on function app.tenant_operacional() to authenticated, service_role;

create or replace function app.meu_aluno_id() returns uuid
language sql stable security definer set search_path = public, app as $$
  select a.id from alunos a
  where a.usuario_id = app.usuario_id()
    and a.escola_id = app.tenant_id()
    and app.tenant_operacional()
  limit 1
$$;

create or replace function app.sou_responsavel_de(p_aluno uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.tenant_operacional() and exists (
    select 1 from vinculos_responsaveis v
    where v.aluno_id = p_aluno
      and v.responsavel_id = app.usuario_id()
      and v.escola_id = app.tenant_id()
  )
$$;

drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios for select to authenticated
  using (
    escola_id = app.tenant_id()
    and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or id = app.usuario_id()
    )
  );

drop policy if exists escolas_update on escolas;
create policy escolas_update on escolas for update to authenticated
  using (id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (id = app.tenant_id());

drop policy if exists turmas_coordenacao on turmas;
create policy turmas_coordenacao on turmas for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists alunos_select on alunos;
create policy alunos_select on alunos for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or (app.papel() = 'aluno' and usuario_id = app.usuario_id() and app.tenant_operacional())
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(id))
    )
  );

drop policy if exists alunos_insert on alunos;
create policy alunos_insert on alunos for insert to authenticated
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists alunos_update on alunos;
create policy alunos_update on alunos for update to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id());

drop policy if exists alunos_delete on alunos;
create policy alunos_delete on alunos for delete to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists alunos_turmas_coordenacao on alunos_turmas;
create policy alunos_turmas_coordenacao on alunos_turmas for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists vinculos_coordenacao on vinculos_responsaveis;
create policy vinculos_coordenacao on vinculos_responsaveis for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists vinculos_responsavel_select on vinculos_responsaveis;
create policy vinculos_responsavel_select on vinculos_responsaveis for select to authenticated
  using (escola_id = app.tenant_id() and responsavel_id = app.usuario_id() and app.tenant_operacional());

drop policy if exists metas_select on metas;
create policy metas_select on metas for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

drop policy if exists registros_select on registros_estudo;
create policy registros_select on registros_estudo for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

drop policy if exists simulados_select on simulados;
create policy simulados_select on simulados for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

drop policy if exists consentimentos_coordenacao on consentimentos;
create policy consentimentos_coordenacao on consentimentos for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists logs_select_coordenacao on logs_acesso;
create policy logs_select_coordenacao on logs_acesso for select to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

create or replace function public.resumo_escola()
returns table (
  aluno_id            uuid,
  questoes_total      bigint,
  ca_questoes_total   bigint,
  acertos_total       bigint,
  minutos_total       bigint,
  dias_total          bigint,
  questoes_7d         bigint,
  ca_questoes_7d      bigint,
  acertos_7d          bigint,
  minutos_7d          bigint,
  dias_7d             bigint,
  ultima_atividade    date,
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
  where a.escola_id = app.tenant_id()
    and app.tenant_operacional()
    and (
      app.papel() = 'coordenacao'
      or a.usuario_id = app.usuario_id()
      or app.sou_responsavel_de(a.id)
    );
$$;
grant execute on function public.resumo_escola() to authenticated, service_role;
