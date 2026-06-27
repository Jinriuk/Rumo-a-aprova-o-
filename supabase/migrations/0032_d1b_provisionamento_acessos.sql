-- ============================================================
-- 0032 — D1B: provisionamento real pelo backoffice + campos de contato
-- ------------------------------------------------------------
-- Objetivo: o superadmin consegue criar escola completa, vincular
-- coordenador e reenviar acesso pelo próprio backoffice, sem rodar
-- scripts e sem abrir o banco.
--
-- Alterações ADITIVAS (nenhuma coluna removida ou alterada destrutivamente):
--   1) escolas: email_institucional, telefone_contato, contato_nome,
--      contato_observacao — dados administrativos do cliente;
--   2) usuarios: email — cache do e-mail Auth para exibição no backoffice
--      sem precisar chamar admin API;
--   3) backoffice_criar_escola: aceita novos campos de contato e status
--      inicial opcional;
--   4) backoffice_detalhe_escola: retorna coordenadores como objetos
--      {id, nome, email} em vez de array de strings;
--   5) backoffice_reenviar_acesso: log + delegate; envio real feita pela
--      Edge Function que detém o service_role.
-- Toda ação sensível registra em admin_logs.
-- Aditiva e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Campos de contato administrativo da escola
-- ------------------------------------------------------------
alter table escolas
  add column if not exists email_institucional  text,
  add column if not exists telefone_contato     text,
  add column if not exists contato_nome         text,
  add column if not exists contato_observacao   text;

-- ------------------------------------------------------------
-- 2) Cache de e-mail do coordenador (sem expor auth.users no front)
-- ------------------------------------------------------------
alter table usuarios
  add column if not exists email text;

-- ------------------------------------------------------------
-- 3) backoffice_criar_escola — com novos campos de contato e
--    status inicial configurável (padrão: implantacao).
--    DROP + CREATE porque o tipo de retorno é diferente do 0021.
--    A assinatura anterior era (text,text,text,text,text,int),
--    e esta é (text,text,...) com novos parâmetros default null.
-- ------------------------------------------------------------
drop function if exists public.backoffice_criar_escola(text,text,text,text,text,int);
create function public.backoffice_criar_escola(
  p_nome               text,
  p_slug               text,
  p_cidade             text  default null,
  p_uf                 text  default null,
  p_plano              text  default null,
  p_limite_alunos      int   default null,
  p_status_inicial     text  default 'implantacao',
  p_email_institucional text default null,
  p_telefone_contato   text  default null,
  p_contato_nome       text  default null,
  p_contato_observacao text  default null
) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_status text;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  v_status := coalesce(
    nullif(p_status_inicial, ''),
    'implantacao'
  );
  if v_status not in ('implantacao', 'demo', 'piloto', 'ativa', 'suspensa', 'cancelada') then
    raise exception 'status inválido: %', v_status using errcode = '22023';
  end if;
  insert into escolas (
    nome, slug, cidade, uf, plano, limite_alunos, status,
    email_institucional, telefone_contato, contato_nome, contato_observacao
  ) values (
    p_nome, p_slug,
    nullif(p_cidade, ''), nullif(p_uf, ''),
    nullif(p_plano, ''), p_limite_alunos,
    v_status,
    nullif(p_email_institucional, ''),
    nullif(p_telefone_contato, ''),
    nullif(p_contato_nome, ''),
    nullif(p_contato_observacao, '')
  ) returning id into v_id;
  insert into admin_logs (super_admin_id, acao, escola_id, detalhe)
    values (app.usuario_id(), 'criar-escola', v_id,
      jsonb_build_object(
        'nome', p_nome, 'slug', p_slug,
        'status_inicial', v_status
      ));
  return v_id;
end $$;
revoke execute on function public.backoffice_criar_escola(text,text,text,text,text,int,text,text,text,text,text) from public, anon;
grant  execute on function public.backoffice_criar_escola(text,text,text,text,text,int,text,text,text,text,text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4) backoffice_detalhe_escola — coordenadores como objetos com email
-- ------------------------------------------------------------
create or replace function public.backoffice_detalhe_escola(p_escola uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'escola', to_jsonb(e),
    'coordenadores', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email)
        order by u.nome
      )
      from usuarios u
      where u.escola_id = e.id and u.papel = 'coordenacao'
    ), '[]'::jsonb),
    'turmas', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome) order by t.nome)
      from turmas t where t.escola_id = e.id
    ), '[]'::jsonb),
    'alunos', (select count(*) from alunos a where a.escola_id = e.id),
    'alunos_com_credencial', (
      select count(*) from alunos a
      where a.escola_id = e.id and a.usuario_id is not null
    ),
    'responsaveis', (
      select count(*) from vinculos_responsaveis v where v.escola_id = e.id
    ),
    'consentimentos', (
      select count(*) from consentimentos c where c.escola_id = e.id
    )
  ) into v
  from escolas e where e.id = p_escola;
  if v is null then raise exception 'escola não encontrada'; end if;
  return v;
end $$;
revoke execute on function public.backoffice_detalhe_escola(uuid) from public, anon;
grant  execute on function public.backoffice_detalhe_escola(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 5) backoffice_editar_escola — suporta campos de contato
--    DROP + CREATE porque o tipo/assinatura muda (parâmetros adicionais).
-- ------------------------------------------------------------
drop function if exists public.backoffice_editar_escola(uuid,text,text,text,text,text,text,int,text);
create function public.backoffice_editar_escola(
  p_escola             uuid,
  p_nome               text  default null,
  p_plano              text  default null,
  p_cor_acento         text  default null,
  p_logo_url           text  default null,
  p_cidade             text  default null,
  p_uf                 text  default null,
  p_limite_alunos      int   default null,
  p_observacao         text  default null,
  p_email_institucional text default null,
  p_telefone_contato   text  default null,
  p_contato_nome       text  default null,
  p_contato_observacao text  default null
) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_antes jsonb; v_depois jsonb;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;

  select to_jsonb(e) into v_antes from escolas e where e.id = p_escola;
  if v_antes is null then raise exception 'escola não encontrada'; end if;

  update escolas set
    nome                = coalesce(nullif(p_nome, ''),               nome),
    plano               = coalesce(nullif(p_plano, ''),              plano),
    cor_acento          = coalesce(nullif(p_cor_acento, ''),         cor_acento),
    logo_url            = coalesce(nullif(p_logo_url, ''),           logo_url),
    cidade              = coalesce(nullif(p_cidade, ''),             cidade),
    uf                  = coalesce(nullif(p_uf, ''),                 uf),
    limite_alunos       = coalesce(p_limite_alunos,                  limite_alunos),
    observacao          = coalesce(p_observacao,                     observacao),
    email_institucional = coalesce(nullif(p_email_institucional,''), email_institucional),
    telefone_contato    = coalesce(nullif(p_telefone_contato,''),    telefone_contato),
    contato_nome        = coalesce(nullif(p_contato_nome,''),        contato_nome),
    contato_observacao  = coalesce(p_contato_observacao,             contato_observacao),
    atualizada_em       = now()
  where id = p_escola;

  select to_jsonb(e) into v_depois from escolas e where e.id = p_escola;
  insert into admin_logs (super_admin_id, acao, escola_id, detalhe)
    values (app.usuario_id(), 'editar-escola', p_escola,
            jsonb_build_object('antes', v_antes, 'depois', v_depois));
end $$;
revoke execute on function public.backoffice_editar_escola(uuid,text,text,text,text,text,text,int,text,text,text,text,text) from public, anon;
grant  execute on function public.backoffice_editar_escola(uuid,text,text,text,text,text,text,int,text,text,text,text,text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 6) backoffice_reenviar_acesso — registra a intenção no admin_logs
--    (o envio real é feito pela Edge Function backoffice-coordenador
--     com acao='reenviar', que tem o service_role para chamar Auth).
--    Esta RPC é chamada pelo front e só grava o log de auditoria;
--    o front TAMBÉM chama a Edge Function para o envio efetivo.
--    Assim a trilha de auditoria existe mesmo se o e-mail falhar.
-- ------------------------------------------------------------
create or replace function public.backoffice_registrar_reenvio(
  p_escola     uuid,
  p_usuario_id uuid
) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_email text; v_nome text;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  select email, nome into v_email, v_nome
    from usuarios where id = p_usuario_id and escola_id = p_escola;
  if v_email is null then
    raise exception 'coordenador não encontrado nesta escola';
  end if;
  insert into admin_logs (super_admin_id, acao, escola_id, detalhe)
    values (app.usuario_id(), 'reenviar-acesso', p_escola,
      jsonb_build_object('usuario_id', p_usuario_id, 'nome', v_nome, 'email', v_email));
end $$;
revoke execute on function public.backoffice_registrar_reenvio(uuid,uuid) from public, anon;
grant  execute on function public.backoffice_registrar_reenvio(uuid,uuid) to authenticated, service_role;
