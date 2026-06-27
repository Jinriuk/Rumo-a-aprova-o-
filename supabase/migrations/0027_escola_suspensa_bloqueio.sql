-- ============================================================
-- 0027 — S1.5: ESCOLA SUSPENSA/CANCELADA com BLOQUEIO EFETIVO no banco
-- ------------------------------------------------------------
-- A D0 (0025) deu ao superoperador o botão de suspender/cancelar uma
-- escola, mas o status era só um RÓTULO: a RLS nunca olhava para ele,
-- então aluno/responsável/coordenação de uma escola 'suspensa'
-- continuavam operando normalmente. Esta migration torna o bloqueio
-- AUTORITATIVO no banco (não só no front).
--
-- DOUTRINA do bloqueio (defesa em profundidade, com o banco no comando):
--   1) `app.tenant_operacional()` — porteiro: a escola do JWT NÃO está
--      em ('suspensa','cancelada'). SECURITY DEFINER lê `escolas` sem
--      disparar RLS (sem recursão). Sem tenant (super_admin) → true:
--      o operador interno nunca é barrado aqui (reativa pelo backoffice).
--   2) ALUNO e RESPONSÁVEL são bloqueados em UM ponto cada: toda a
--      matriz de RLS desses papéis passa por `app.meu_aluno_id()` e
--      `app.sou_responsavel_de()`. Anulando essas identidades quando a
--      escola não está operacional, TODA leitura/escrita do aluno e do
--      responsável (em qualquer tabela) deixa de casar — sem precisar
--      reescrever dezenas de políticas.
--   3) COORDENAÇÃO: as políticas da coordenação (estrutura da escola,
--      listas, painel) ganham o porteiro `app.tenant_operacional()`,
--      e a RPC agregada `resumo_escola()` devolve VAZIO quando suspensa.
--   4) IDENTIDADE permanece legível: `escolas` (marca/status) e a
--      própria linha em `usuarios` continuam visíveis, para o FRONT
--      conseguir renderizar a tela "Acesso suspenso" com a marca certa.
--
-- O super_admin (internal_admins) NÃO é afetado: não tem tenant, opera
-- por RPCs próprias (porteiro eh_super_admin) e reativa a escola.
-- Aditiva e idempotente: recria funções/políticas com CREATE OR REPLACE
-- e DROP POLICY IF EXISTS antes de cada CREATE POLICY.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PORTEIRO de operação. SECURITY DEFINER: lê escolas sem RLS
--    (não recursa nas políticas de escolas, que chamam tenant_id()).
--    Sem tenant no token → true (super_admin / contexto sem escola).
-- ------------------------------------------------------------
create or replace function app.tenant_operacional() returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select e.status not in ('suspensa', 'cancelada')
       from escolas e where e.id = app.tenant_id()),
    true)
$$;
grant execute on function app.tenant_operacional() to authenticated, service_role;

-- ------------------------------------------------------------
-- 2) ALUNO e RESPONSÁVEL: colapsa a identidade quando não-operacional.
--    meu_aluno_id() → null  → nenhuma linha de aluno casa (read+write).
--    sou_responsavel_de() → false → responsável não enxerga nada.
--    Mantém SECURITY DEFINER + search_path (igual à 0002).
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 3) COORDENAÇÃO: recria as políticas da coordenação (0002) com o
--    porteiro `app.tenant_operacional()`. A IDENTIDADE continua
--    legível: `usuarios_select` mantém o ramo "id = app.usuario_id()"
--    SEM o porteiro (o usuário lê a si mesmo para o front saber quem é);
--    só o ramo "coordenação vê a escola toda" é gateado. `escolas_select`
--    (marca/status) NÃO é tocada — o front precisa dela para a tela de
--    suspensão. `escolas_update` (escrever marca) é gateada.
-- ------------------------------------------------------------

-- USUÁRIOS — coordenação vê a escola (gateado); cada um se vê (livre).
drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios for select to authenticated
  using (
    escola_id = app.tenant_id()
    and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or id = app.usuario_id()
    )
  );

-- ESCOLA — escrever marca exige operação ativa.
drop policy if exists escolas_update on escolas;
create policy escolas_update on escolas for update to authenticated
  using (id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (id = app.tenant_id());

-- TURMAS — gerência da coordenação.
drop policy if exists turmas_coordenacao on turmas;
create policy turmas_coordenacao on turmas for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

-- ALUNOS — coordenação gerencia (gateado); aluno/responsável seguem
-- meu_aluno_id()/sou_responsavel_de(), já anulados em (2).
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

-- ALUNOS × TURMAS — gerência da coordenação.
drop policy if exists alunos_turmas_coordenacao on alunos_turmas;
create policy alunos_turmas_coordenacao on alunos_turmas for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

-- VÍNCULO RESPONSÁVEL — coordenação gerencia (gateado); o responsável
-- lê o próprio vínculo (gateado para sumir junto com a suspensão).
drop policy if exists vinculos_coordenacao on vinculos_responsaveis;
create policy vinculos_coordenacao on vinculos_responsaveis for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

drop policy if exists vinculos_responsavel_select on vinculos_responsaveis;
create policy vinculos_responsavel_select on vinculos_responsaveis for select to authenticated
  using (escola_id = app.tenant_id() and responsavel_id = app.usuario_id() and app.tenant_operacional());

-- METAS — leitura por papel; ramo da coordenação gateado.
drop policy if exists metas_select on metas;
create policy metas_select on metas for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

-- META_ATIVIDADES — leitura segue a meta (já gateada). O update do
-- aluno passa por meu_aluno_id(), já anulado em (2).
-- (sem recriação: herda o bloqueio de metas_select/meu_aluno_id.)

-- REGISTROS DE ESTUDO — ramo da coordenação gateado (aluno via
-- meu_aluno_id; responsável via sou_responsavel_de).
drop policy if exists registros_select on registros_estudo;
create policy registros_select on registros_estudo for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

-- SIMULADOS — idem.
drop policy if exists simulados_select on simulados;
create policy simulados_select on simulados for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      (app.papel() = 'coordenacao' and app.tenant_operacional())
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

-- CONSENTIMENTOS — coordenação (controladora) gerencia.
drop policy if exists consentimentos_coordenacao on consentimentos;
create policy consentimentos_coordenacao on consentimentos for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

-- LOGS DE ACESSO — coordenação lê os da escola (gateado). O insert do
-- próprio acesso fica livre (telemetria honesta de tentativa).
drop policy if exists logs_select_coordenacao on logs_acesso;
create policy logs_select_coordenacao on logs_acesso for select to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional());

-- ------------------------------------------------------------
-- 4) RPC AGREGADA do painel (SECURITY DEFINER, ignora RLS): porteiro
--    explícito. Escola não-operacional → conjunto VAZIO (o painel da
--    coordenação some). Mantém o resto do corpo idêntico à 0016.
-- ------------------------------------------------------------
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
    and app.tenant_operacional()           -- S1.5: escola suspensa → vazio
    and (
      app.papel() = 'coordenacao'
      or a.usuario_id = app.usuario_id()
      or app.sou_responsavel_de(a.id)
    );
$$;
grant execute on function public.resumo_escola() to authenticated, service_role;
