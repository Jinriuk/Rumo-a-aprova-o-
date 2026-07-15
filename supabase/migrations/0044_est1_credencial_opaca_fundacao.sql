-- ============================================================
-- 0044 — EST1-C1 (SEC3b): FUNDAÇÃO DA CREDENCIAL OPACA
-- ------------------------------------------------------------
-- Achado EST0 SEGURANCA-02 / SEC3 6.2-6.3: o código que a escola entrega
-- ao aluno É a senha do GoTrue (provisionar-aluno: password=codigo) e o
-- login vai direto ao Auth. Sem rotação independente (girar o código =
-- recriar a conta) e sem trava de tentativas própria. Não é P0/P1 (o
-- código é CSPRNG ~7,6e17), mas é dívida arquitetural P2.
--
-- Esta migration cria a FUNDAÇÃO do modelo desenhado em
-- docs/auditoria/sec3/modelo-credencial-opaca.md, de forma ADITIVA e
-- DORMENTE: o login de produção NÃO muda aqui (segue direto no GoTrue).
-- O que entra é a base para o corte futuro (janela dedicada):
--   • tabela app.acessos_codigo — guarda só o HASH do código (nunca o
--     código em claro), com escola_id, rotação e revogação;
--   • tabela app.login_tentativas — ledger de tentativas p/ rate limit;
--   • funções (service_role, sem PostgREST): registrar / rotacionar /
--     revogar / resolver (com rate limit e trabalho uniforme).
--
-- SEGURANÇA DO HASH: o código é um segredo de ALTA entropia (CSPRNG,
-- alfabeto de 31, 12 posições). Hash SHA-256 sem sal por linha é a
-- prática correta para segredo de alta entropia (idêntico ao hashing de
-- token de sessão): não há risco de rainbow table e o lookup é O(1) por
-- índice. Um "pepper" de servidor pode ser somado no futuro (comentado).
--
-- Aditiva. Idempotente. Não altera Auth, login, nem qualquer migration
-- anterior. Rollback = DROP das tabelas/funções criadas aqui.
-- ============================================================

-- ------------------------------------------------------------
-- 1) app.acessos_codigo — o hash do código por usuário (1 ativo/usuário)
-- ------------------------------------------------------------
create table if not exists app.acessos_codigo (
  usuario_id    uuid primary key references usuarios (id) on delete cascade,
  escola_id     uuid not null references escolas (id) on delete cascade,
  codigo_hash   bytea not null,                 -- sha256(normalizado) — nunca o código
  revogado_em   timestamptz,
  criado_em     timestamptz not null default now(),
  rotacionado_em timestamptz
);

-- lookup por hash é o caminho quente do login-codigo (resolver).
create index if not exists idx_acessos_codigo_hash on app.acessos_codigo (codigo_hash)
  where revogado_em is null;

comment on table app.acessos_codigo is
  'EST1-C1 (0044): hash do código de acesso do aluno/responsável (nunca o '
  'código em claro). Base da credencial opaca (SEC3b). Sem PostgREST, só service_role.';

-- ------------------------------------------------------------
-- 2) app.login_tentativas — ledger de tentativas para rate limit
-- ------------------------------------------------------------
create table if not exists app.login_tentativas (
  id         bigint generated always as identity primary key,
  chave      text not null,                     -- IP (ou IP+prefixo) que o proxy passa
  sucesso    boolean not null,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_login_tentativas_chave on app.login_tentativas (chave, criado_em desc);

-- ------------------------------------------------------------
-- 3) NORMALIZAÇÃO + HASH do código (determinístico, testável)
--    Normaliza (só alfanumérico, maiúsculo) e devolve sha256.
--    Espelha a normalização do front/Edge (emailDoCodigo/normalizarCodigo).
-- ------------------------------------------------------------
create or replace function app.hash_codigo(p_codigo text) returns bytea
language sql immutable strict set search_path = public, app as $$
  select digest(upper(regexp_replace(p_codigo, '[^a-zA-Z0-9]', '', 'g')), 'sha256')
$$;

-- ------------------------------------------------------------
-- 4) REGISTRAR o código de um usuário (grava só o hash). Idempotente
--    por usuário: re-registrar substitui o hash e reativa (revogado_em
--    nulo). Usado (aditivo) pelo provisionar-aluno.
-- ------------------------------------------------------------
create or replace function app.registrar_codigo(p_usuario uuid, p_escola uuid, p_codigo text)
returns void
language plpgsql security definer set search_path = public, app as $$
begin
  insert into app.acessos_codigo (usuario_id, escola_id, codigo_hash, criado_em, revogado_em)
    values (p_usuario, p_escola, app.hash_codigo(p_codigo), now(), null)
  on conflict (usuario_id) do update
    set codigo_hash = excluded.codigo_hash,
        escola_id   = excluded.escola_id,
        revogado_em = null,
        rotacionado_em = now();
end $$;

-- ------------------------------------------------------------
-- 5) ROTACIONAR — resolve C-2: gira o código MANTENDO a identidade
--    (usuario_id/conta Auth), diferente de revogar+reprovisionar.
-- ------------------------------------------------------------
create or replace function app.rotacionar_codigo(p_usuario uuid, p_codigo_novo text)
returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update app.acessos_codigo
     set codigo_hash = app.hash_codigo(p_codigo_novo),
         revogado_em = null,
         rotacionado_em = now()
   where usuario_id = p_usuario;
  if not found then
    raise exception 'usuário % não tem código registrado', p_usuario;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6) REVOGAR — invalida o código sem apagar a linha (auditoria).
-- ------------------------------------------------------------
create or replace function app.revogar_codigo(p_usuario uuid)
returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update app.acessos_codigo set revogado_em = now()
   where usuario_id = p_usuario and revogado_em is null;
end $$;

-- ------------------------------------------------------------
-- 7) RESOLVER — o coração do proxy login-codigo: rate limit + lookup por
--    hash. Faz trabalho UNIFORME (sempre hasheia, sempre registra a
--    tentativa) para não vazar por timing/efeito. Devolve o estado e o
--    usuario_id (nulo quando não resolve).
--
--    p_limite / p_janela_min: N tentativas por chave na janela. Acima
--    disso, 'rate_limited' antes de qualquer lookup (protege o Auth).
-- ------------------------------------------------------------
create or replace function app.resolver_codigo(
  p_codigo text, p_chave text,
  p_limite int default 10, p_janela_min int default 5
) returns table (resultado text, usuario_id uuid)
language plpgsql security definer set search_path = public, app as $$
declare
  v_tentativas int;
  v_hash bytea;
  v_row app.acessos_codigo;
begin
  -- rate limit por chave (IP) na janela
  select count(*) into v_tentativas from app.login_tentativas
   where chave = p_chave and criado_em > now() - make_interval(mins => p_janela_min);

  if v_tentativas >= p_limite then
    insert into app.login_tentativas (chave, sucesso) values (p_chave, false);
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  -- trabalho uniforme: sempre hasheia e sempre consulta
  v_hash := app.hash_codigo(p_codigo);
  select * into v_row from app.acessos_codigo where codigo_hash = v_hash limit 1;

  if not found then
    insert into app.login_tentativas (chave, sucesso) values (p_chave, false);
    return query select 'nao_encontrado'::text, null::uuid;
    return;
  end if;

  if v_row.revogado_em is not null then
    insert into app.login_tentativas (chave, sucesso) values (p_chave, false);
    return query select 'revogado'::text, null::uuid;
    return;
  end if;

  insert into app.login_tentativas (chave, sucesso) values (p_chave, true);
  return query select 'ok'::text, v_row.usuario_id;
end $$;

-- ------------------------------------------------------------
-- 8) PRIVILÉGIOS — tudo é de SERVIDOR (service_role). O usuário logado
--    (authenticated/anon) NÃO enxerga nem executa nada disto. As tabelas
--    ficam no schema app (fora do PostgREST, que só expõe public).
-- ------------------------------------------------------------
revoke all on function app.hash_codigo(text) from public, authenticated, anon;
revoke all on function app.registrar_codigo(uuid, uuid, text) from public, authenticated, anon;
revoke all on function app.rotacionar_codigo(uuid, text) from public, authenticated, anon;
revoke all on function app.revogar_codigo(uuid) from public, authenticated, anon;
revoke all on function app.resolver_codigo(text, text, int, int) from public, authenticated, anon;

grant execute on function app.registrar_codigo(uuid, uuid, text) to service_role;
grant execute on function app.rotacionar_codigo(uuid, text) to service_role;
grant execute on function app.revogar_codigo(uuid) to service_role;
grant execute on function app.resolver_codigo(text, text, int, int) to service_role;

grant select, insert, update, delete on app.acessos_codigo to service_role;
grant select, insert, update, delete on app.login_tentativas to service_role;

-- Sem grant a authenticated/anon: as tabelas do schema app não são
-- alcançáveis pelo cliente (defesa em profundidade além da RLS).

-- ------------------------------------------------------------
-- ROLLBACK (manual):
--   drop function app.resolver_codigo(text,text,int,int), app.revogar_codigo(uuid),
--     app.rotacionar_codigo(uuid,text), app.registrar_codigo(uuid,uuid,text),
--     app.hash_codigo(text);
--   drop table app.login_tentativas, app.acessos_codigo;
-- Nada em produção depende destas peças enquanto o corte não acontecer.
-- ------------------------------------------------------------
