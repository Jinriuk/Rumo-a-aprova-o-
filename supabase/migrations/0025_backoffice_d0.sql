-- ============================================================
-- 0025 — BACKOFFICE D0: operar a escola sem entrar no Supabase
-- ------------------------------------------------------------
-- A D0 fecha o mínimo operacional do superoperador sobre o que as
-- fases 17.4/17.5 já entregaram (internal_admins, admin_logs, gate
-- eh_super_admin, criar/listar/detalhar escola). Acrescenta, sempre
-- pela mesma doutrina — RPC SECURITY DEFINER com PORTEIRO, sem
-- service_role no front, anon revogado na própria migration:
--   1) campos operacionais: observacao interna + atualizada_em;
--   2) status mais rico (demo/piloto/cancelada além dos atuais);
--   3) backoffice_dashboard()         — contadores agregados;
--   4) backoffice_editar_escola(...)  — dados básicos + log antes/depois;
--   5) backoffice_definir_status(...) — suspender/ativar/cancelar + log;
--   6) app.registrar_super_admin(...) — promover admin inicial por e-mail
--      (camada de operador; resolve o auth.users por e-mail, sem senha).
-- Toda ação sensível grava em admin_logs. Aditiva e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Campos operacionais da escola
-- ------------------------------------------------------------
alter table escolas
  add column if not exists observacao    text,            -- nota interna do operador
  add column if not exists atualizada_em timestamptz not null default now();

-- ------------------------------------------------------------
-- 2) Status mais rico. A 0021 criou escolas_status_check com
--    (implantacao, ativa, suspensa). A D0 amplia o conjunto de forma
--    ADITIVA — nenhum valor existente é removido, então nada quebra.
--    'implantacao' continua válido (default histórico); 'demo'/'piloto'
--    são estados pré-ativação; 'cancelada' é desligamento reversível
--    (nunca delete físico — regra 11 da D0).
-- ------------------------------------------------------------
alter table escolas drop constraint if exists escolas_status_check;
alter table escolas add  constraint escolas_status_check
  check (status in ('implantacao', 'demo', 'piloto', 'ativa', 'suspensa', 'cancelada'));

-- ------------------------------------------------------------
-- 3) Dashboard agregado (cross-tenant, de propósito) — só super_admin.
--    Números reais; quando a fonte não é confiável, devolve 0 (o front
--    decide o fallback visual). 'alunos ativos 7d' vem de logs_acesso.
-- ------------------------------------------------------------
create or replace function public.backoffice_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'escolas_total',        (select count(*) from escolas),
    'escolas_ativas',       (select count(*) from escolas where status = 'ativa'),
    'escolas_suspensas',    (select count(*) from escolas where status = 'suspensa'),
    'escolas_demo_piloto',  (select count(*) from escolas where status in ('demo', 'piloto', 'implantacao')),
    'escolas_canceladas',   (select count(*) from escolas where status = 'cancelada'),
    'escolas_sem_coordenador', (
       select count(*) from escolas e
       where not exists (select 1 from usuarios u where u.escola_id = e.id and u.papel = 'coordenacao')),
    'alunos_total',         (select count(*) from alunos),
    'alunos_ativos_7d',     (select count(distinct l.aluno_id) from logs_acesso l
                              where l.aluno_id is not null and l.em >= now() - interval '7 days'),
    'coordenadores_total',  (select count(*) from usuarios where papel = 'coordenacao')
  ) into v;
  return v;
end $$;
revoke execute on function public.backoffice_dashboard() from public, anon;
grant  execute on function public.backoffice_dashboard() to authenticated, service_role;

-- ------------------------------------------------------------
-- 4) Editar dados básicos da escola. NULL = "não mexer" naquele campo
--    (COALESCE), então o front manda só o que mudou. Registra antes/
--    depois no admin_logs e carimba atualizada_em. NÃO troca status —
--    isso tem ação própria (item 5) para o log ficar legível.
-- ------------------------------------------------------------
create or replace function public.backoffice_editar_escola(
  p_escola        uuid,
  p_nome          text default null,
  p_plano         text default null,
  p_cor_acento    text default null,
  p_logo_url      text default null,
  p_cidade        text default null,
  p_uf            text default null,
  p_limite_alunos int  default null,
  p_observacao    text default null
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
    nome          = coalesce(nullif(p_nome, ''),       nome),
    plano         = coalesce(nullif(p_plano, ''),      plano),
    cor_acento    = coalesce(nullif(p_cor_acento, ''), cor_acento),
    logo_url      = coalesce(nullif(p_logo_url, ''),   logo_url),
    cidade        = coalesce(nullif(p_cidade, ''),     cidade),
    uf            = coalesce(nullif(p_uf, ''),         uf),
    limite_alunos = coalesce(p_limite_alunos,          limite_alunos),
    observacao    = coalesce(p_observacao,             observacao),
    atualizada_em = now()
  where id = p_escola;

  select to_jsonb(e) into v_depois from escolas e where e.id = p_escola;
  insert into admin_logs (super_admin_id, acao, escola_id, detalhe)
    values (app.usuario_id(), 'editar-escola', p_escola,
            jsonb_build_object('antes', v_antes, 'depois', v_depois));
end $$;
revoke execute on function public.backoffice_editar_escola(uuid,text,text,text,text,text,text,int,text) from public, anon;
grant  execute on function public.backoffice_editar_escola(uuid,text,text,text,text,text,text,int,text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 5) Suspender / ativar / mudar status. Reversível por definição
--    (nunca apaga dado). A ação no log é específica para auditoria
--    limpa: suspender-escola / ativar-escola / alterar-status-escola.
-- ------------------------------------------------------------
create or replace function public.backoffice_definir_status(p_escola uuid, p_status text)
returns void
language plpgsql security definer set search_path = public, app as $$
declare v_antes text; v_acao text;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  if p_status not in ('implantacao', 'demo', 'piloto', 'ativa', 'suspensa', 'cancelada') then
    raise exception 'status inválido: %', p_status using errcode = '22023';
  end if;

  select status into v_antes from escolas where id = p_escola;
  if v_antes is null then raise exception 'escola não encontrada'; end if;

  update escolas set status = p_status, atualizada_em = now() where id = p_escola;

  v_acao := case p_status when 'suspensa' then 'suspender-escola'
                          when 'ativa'    then 'ativar-escola'
                          else 'alterar-status-escola' end;
  insert into admin_logs (super_admin_id, acao, escola_id, detalhe)
    values (app.usuario_id(), v_acao, p_escola,
            jsonb_build_object('de', v_antes, 'para', p_status));
end $$;
revoke execute on function public.backoffice_definir_status(uuid,text) from public, anon;
grant  execute on function public.backoffice_definir_status(uuid,text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 6) Promover SUPER_ADMIN por e-mail (camada de OPERADOR).
--    internal_admins tem PK = auth_user_id, então não dá para
--    pré-cadastrar por e-mail numa seed (a conta Auth ainda não existe).
--    Esta função resolve o auth.users pelo e-mail e faz o upsert —
--    o operador roda no SQL Editor (ou via service_role) DEPOIS de
--    criar/confirmar a conta no Auth. Sem senha, sem hardcode.
--    Concedida só ao service_role; authenticated/anon nunca executam.
-- ------------------------------------------------------------
create or replace function app.registrar_super_admin(p_email text, p_nome text default null)
returns uuid
language plpgsql security definer set search_path = public, app, auth as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_id is null then
    raise exception 'nenhuma conta no Auth com e-mail % — crie/confirme a conta primeiro', p_email;
  end if;
  insert into internal_admins (auth_user_id, email, nome, ativo)
    values (v_id, lower(p_email), coalesce(nullif(p_nome, ''), p_email), true)
    on conflict (auth_user_id)
      do update set ativo = true, nome = excluded.nome, email = excluded.email;
  return v_id;
end $$;
revoke execute on function app.registrar_super_admin(text,text) from public, anon, authenticated;
grant  execute on function app.registrar_super_admin(text,text) to service_role;
