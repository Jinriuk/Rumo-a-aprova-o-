-- ============================================================
-- 0021 — BACKOFFICE: criar escola + detalhe + implantação (Fase 17.5)
-- ------------------------------------------------------------
-- Acrescenta os campos operacionais da escola (status, plano,
-- cidade/UF, limite de alunos) e RPCs SECURITY DEFINER com porteiro
-- eh_super_admin para CRIAR e DETALHAR escola pelo backoffice — sem
-- service_role no front. A criação da CONTA do coordenador (Auth) é
-- da camada de operador (scripts/criar-coordenacao.mjs), nunca do
-- front. Já revoga o anon na própria migration (lição da 0018/0020).
-- Aditiva e idempotente.
-- ============================================================

alter table escolas
  add column if not exists status        text not null default 'implantacao'
                                          check (status in ('implantacao', 'ativa', 'suspensa')),
  add column if not exists plano         text,
  add column if not exists cidade        text,
  add column if not exists uf            text check (uf is null or length(uf) = 2),
  add column if not exists limite_alunos int  check (limite_alunos is null or limite_alunos >= 0);

-- backoffice_escolas ganha status/plano/cidade/uf → troca o tipo de
-- retorno, então recria (DROP + CREATE; CREATE OR REPLACE não muda
-- colunas de retorno).
drop function if exists public.backoffice_escolas();
create function public.backoffice_escolas()
returns table (
  escola_id     uuid,
  nome          text,
  slug          text,
  cor_acento    text,
  status        text,
  plano         text,
  cidade        text,
  uf            text,
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
    select e.id, e.nome, e.slug, e.cor_acento, e.status, e.plano, e.cidade, e.uf,
      (select count(*) from alunos a   where a.escola_id = e.id),
      (select count(*) from turmas t   where t.escola_id = e.id),
      (select count(*) from usuarios u where u.escola_id = e.id and u.papel = 'coordenacao'),
      (select max(l.em) from logs_acesso l where l.escola_id = e.id)
    from escolas e
    order by e.nome;
end $$;
revoke execute on function public.backoffice_escolas() from public, anon;
grant  execute on function public.backoffice_escolas() to authenticated, service_role;

-- Criar escola (só super_admin). Devolve o id e registra no admin_logs.
create or replace function public.backoffice_criar_escola(
  p_nome text, p_slug text,
  p_cidade text default null, p_uf text default null,
  p_plano text default null, p_limite_alunos int default null
) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  insert into escolas (nome, slug, cidade, uf, plano, limite_alunos, status)
    values (p_nome, p_slug, nullif(p_cidade,''), nullif(p_uf,''), nullif(p_plano,''), p_limite_alunos, 'implantacao')
    returning id into v_id;
  insert into admin_logs (super_admin_id, acao, escola_id, detalhe)
    values (app.usuario_id(), 'criar-escola', v_id, jsonb_build_object('nome', p_nome, 'slug', p_slug));
  return v_id;
end $$;
revoke execute on function public.backoffice_criar_escola(text,text,text,text,text,int) from public, anon;
grant  execute on function public.backoffice_criar_escola(text,text,text,text,text,int) to authenticated, service_role;

-- Detalhe da escola para o painel + checklist de implantação.
create or replace function public.backoffice_detalhe_escola(p_escola uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado: somente super_admin' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'escola', to_jsonb(e),
    'coordenadores', coalesce((select jsonb_agg(u.nome order by u.nome)
       from usuarios u where u.escola_id = e.id and u.papel = 'coordenacao'), '[]'::jsonb),
    'turmas', coalesce((select jsonb_agg(t.nome order by t.nome)
       from turmas t where t.escola_id = e.id), '[]'::jsonb),
    'alunos', (select count(*) from alunos a where a.escola_id = e.id),
    'alunos_com_credencial', (select count(*) from alunos a where a.escola_id = e.id and a.usuario_id is not null),
    'responsaveis', (select count(*) from vinculos_responsaveis v where v.escola_id = e.id),
    'consentimentos', (select count(*) from consentimentos c where c.escola_id = e.id)
  ) into v
  from escolas e where e.id = p_escola;
  if v is null then raise exception 'escola não encontrada'; end if;
  return v;
end $$;
revoke execute on function public.backoffice_detalhe_escola(uuid) from public, anon;
grant  execute on function public.backoffice_detalhe_escola(uuid) to authenticated, service_role;
