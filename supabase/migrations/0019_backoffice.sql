-- ============================================================
-- 0019 — BACKOFFICE INTERNO (Fase 17.4)
-- ------------------------------------------------------------
-- Área interna do OPERADOR, fora do modelo de escolas. O papel
-- super_admin NÃO é um `usuarios` (que é sempre de uma escola) e
-- NÃO se mistura com 'coordenacao'. A identidade do operador vive
-- em `internal_admins` (vínculo por auth_user_id + flag `ativo`),
-- que é a ÚNICA fonte de verdade — revogar acesso é `ativo=false`.
--
-- Doutrina mantida: nada de service_role no front. O backoffice lê
-- via RPCs SECURITY DEFINER com PORTEIRO `app.eh_super_admin()`;
-- quem não é super_admin não enxerga nada. Aditiva e idempotente.
-- ============================================================

-- Operadores internos. Escrita só pelo operador (service_role); a
-- API (authenticated) só lê, e só se for super_admin.
create table if not exists internal_admins (
  auth_user_id uuid primary key,            -- = auth.users.id (sub do JWT)
  email        text not null,
  nome         text not null,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- Trilha de auditoria das ações do backoffice (append-only).
create table if not exists admin_logs (
  id             bigint generated always as identity primary key,
  super_admin_id uuid not null,
  acao           text not null,
  escola_id      uuid,                       -- sem FK: o log sobrevive à exclusão
  detalhe        jsonb not null default '{}'::jsonb,
  em             timestamptz not null default now()
);

create index if not exists idx_admin_logs_escola on admin_logs (escola_id, em);

-- O usuário logado é super_admin ATIVO? SECURITY DEFINER para ler
-- internal_admins sem disparar a própria RLS (evita recursão).
create or replace function app.eh_super_admin() returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from internal_admins ia
    where ia.auth_user_id = app.usuario_id() and ia.ativo
  )
$$;
grant execute on function app.eh_super_admin() to authenticated, service_role;

-- Pergunta do front (qualquer logado pode perguntar; devolve false
-- para quem não é). É como o App decide mostrar o backoffice.
create or replace function public.sou_super_admin() returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.eh_super_admin()
$$;
revoke execute on function public.sou_super_admin() from public;
grant execute on function public.sou_super_admin() to authenticated, service_role;

-- RLS: as duas tabelas só existem para super_admins.
alter table internal_admins enable row level security;
alter table admin_logs      enable row level security;

create policy internal_admins_select on internal_admins for select to authenticated
  using (app.eh_super_admin());

create policy admin_logs_select on admin_logs for select to authenticated
  using (app.eh_super_admin());
create policy admin_logs_insert on admin_logs for insert to authenticated
  with check (app.eh_super_admin() and super_admin_id = app.usuario_id());

grant select on internal_admins to authenticated, service_role;
grant insert, update, delete on internal_admins to service_role;  -- provisão é do operador
grant select, insert on admin_logs to authenticated, service_role;

-- Resumo de escolas para o backoffice (CROSS-TENANT, de propósito).
-- SECURITY DEFINER + porteiro: só super_admin recebe dado; qualquer
-- outro papel toma 'acesso negado'.
create or replace function public.backoffice_escolas()
returns table (
  escola_id     uuid,
  nome          text,
  slug          text,
  cor_acento    text,
  alunos        bigint,
  turmas        bigint,
  coordenadores bigint,
  ultimo_acesso timestamptz
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  return query
    select e.id, e.nome, e.slug, e.cor_acento,
      (select count(*) from alunos a   where a.escola_id = e.id),
      (select count(*) from turmas t   where t.escola_id = e.id),
      (select count(*) from usuarios u where u.escola_id = e.id and u.papel = 'coordenacao'),
      (select max(l.em) from logs_acesso l where l.escola_id = e.id)
    from escolas e
    order by e.nome;
end $$;
revoke execute on function public.backoffice_escolas() from public;
grant execute on function public.backoffice_escolas() to authenticated, service_role;
