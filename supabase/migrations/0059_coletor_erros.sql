-- ============================================================
-- 0059 — coletor de erros: tabelas no schema app e RPCs só do servidor
--         (Etapa 4, parte final: alertas que chegam ao dono, R$ 0)
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono, e só depois do primeiro backup real
-- (Etapa 6). Escrita e ensaiada em Postgres local e na stack local da E3.
-- NUMERAÇÃO: depende da 0058 só pela numeração contígua exigida por
-- teste; não reescreve nada dela.
--
-- O QUE ENTRA (só criação; nada é alterado nem removido)
--   app.erros_grupos       um registro por fingerprint (o "mesmo erro"):
--                          contagem, primeira e última vez, último e-mail.
--   app.erros_ocorrencias  cada relato aceito, já higienizado pela Edge
--                          Function registrar-erro (sem e-mail, token,
--                          senha nem JWT; campos cortados).
--   app.erros_emails       cada e-mail de alerta tentado (teto de 20 em
--                          24 h, contando as falhas).
--   app.erros_limite       contador por chave e minuto (chave = HMAC do
--                          IP do dia, ou "edge:<função>"). Vive 1 hora.
--   public.coletor_registrar_erro  decide tudo numa transação: limite
--                          por chave, teto diário, agrupamento e se
--                          manda e-mail.
--   public.coletor_marcar_email    registra se o Resend aceitou; se não
--                          aceitou, libera o fingerprint para a próxima.
--
-- QUEM ALCANÇA
--   Tabelas: ninguém com token de usuário. Schema `app` (fora da API),
--   REVOKE de anon/authenticated e RLS ligada sem policy. Só o dono
--   (postgres) e as duas RPCs abaixo escrevem; o dono lê pelo SQL editor.
--   RPCs: EXECUTE só para service_role (as Edge Functions). Classe "s"
--   em tests/e2-cs06-secdef-db.test.mjs.
--
-- LIMITES (constantes no corpo da função; mudar é nova migration)
--   20 relatos por chave por minuto       → 429 na Edge Function
--   500 ocorrências gravadas em 24 h       → acima disso só conta o grupo
--                                            e alerta uma vez por hora
--   1 e-mail por fingerprint por hora
--   20 e-mails em 24 h, somando todos os fingerprints
--   Retenção: ocorrências e e-mails 30 dias; grupos 90 dias sem ocorrer.
--   Pior caso de espaço: 500/dia × 30 dias × ~7 KB ≈ 100 MB, dentro dos
--   500 MB do plano free mesmo sob abuso contínuo de um mês.
--
-- ROLLBACK (manual; perde o histórico de erros, que não é dado de negócio)
--   drop function public.coletor_marcar_email(bigint, boolean);
--   drop function public.coletor_registrar_erro(text, text, jsonb, boolean);
--   drop table app.erros_emails, app.erros_ocorrencias, app.erros_grupos,
--              app.erros_limite;
-- ============================================================

create table if not exists app.erros_grupos (
  fingerprint     text primary key
                  check (fingerprint ~ '^([0-9a-f]{16,64}|teto-diario)$'),
  origem          text not null check (length(origem) <= 60),
  mensagem        text not null check (length(mensagem) <= 500),
  primeira_em     timestamptz not null default now(),
  ultima_em       timestamptz not null default now(),
  -- conta também o que passou do teto diário e não virou ocorrência
  ocorrencias     bigint not null default 1,
  ultimo_email_em timestamptz
);

create table if not exists app.erros_ocorrencias (
  id             bigint generated always as identity primary key,
  fingerprint    text not null references app.erros_grupos (fingerprint) on delete cascade,
  criado_em      timestamptz not null default now(),
  origem         text not null check (length(origem) <= 60),
  mensagem       text not null check (length(mensagem) <= 500),
  pilha          text check (length(pilha) <= 4000),
  componente     text check (length(componente) <= 2000),
  rota           text check (length(rota) <= 200),
  release        text check (length(release) <= 64),
  papel          text check (papel in ('coordenacao', 'aluno', 'responsavel', 'super_admin',
                                       'anonimo', 'desconhecido', 'servidor')),
  correlation_id text check (length(correlation_id) <= 64)
);

create index if not exists idx_erros_ocorrencias_criado on app.erros_ocorrencias (criado_em);
create index if not exists idx_erros_ocorrencias_grupo on app.erros_ocorrencias (fingerprint, criado_em desc);

create table if not exists app.erros_emails (
  id          bigint generated always as identity primary key,
  fingerprint text not null check (length(fingerprint) <= 64),
  enviado_em  timestamptz not null default now(),
  situacao    text not null default 'reservado' check (situacao in ('reservado', 'enviado', 'falhou'))
);

create index if not exists idx_erros_emails_enviado on app.erros_emails (enviado_em);

create table if not exists app.erros_limite (
  chave    text not null check (length(chave) <= 128),
  janela   timestamptz not null,
  contagem int not null default 0,
  primary key (chave, janela)
);

-- Ninguém com token de usuário. O schema `app` já fica fora da API
-- (config.toml expõe só `public`), e anon nem tem USAGE nele (0018);
-- o REVOKE e a RLS sem policy são a segunda e a terceira camada, para o
-- dia em que alguém conceder algo no schema inteiro.
revoke all on table app.erros_grupos, app.erros_ocorrencias, app.erros_emails, app.erros_limite
  from public, anon, authenticated;
grant select, insert, update, delete on table
  app.erros_grupos, app.erros_ocorrencias, app.erros_emails, app.erros_limite to service_role;

alter table app.erros_grupos      enable row level security;
alter table app.erros_ocorrencias enable row level security;
alter table app.erros_emails      enable row level security;
alter table app.erros_limite      enable row level security;

comment on table app.erros_ocorrencias is
  'E4 (0059): relatos de erro do front e respostas 5xx das Edge Functions, '
  'higienizados pela função registrar-erro (sem e-mail, token, senha, JWT). '
  'Sem acesso para anon/authenticated. Retenção 30 dias.';
comment on table app.erros_grupos is
  'E4 (0059): um registro por fingerprint; controla 1 e-mail por hora por grupo.';

-- ------------------------------------------------------------
-- RPC de registro. A Edge Function já higienizou o evento e calculou o
-- fingerprint; aqui ficam as decisões que precisam ser atômicas entre
-- instâncias da função (limite, teto, agrupamento, e-mail).
-- Devolve: resultado ('registrado' | 'teto' | 'limitado'), enviar_email,
-- email_id, fingerprint, ocorrencias e primeira_em do grupo.
-- ------------------------------------------------------------
create or replace function public.coletor_registrar_erro(
  p_chave_limite text,
  p_fingerprint  text,
  p_evento       jsonb,
  p_pode_enviar  boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c_por_chave_minuto constant int      := 20;
  c_teto_24h         constant int      := 500;
  c_email_intervalo  constant interval := interval '1 hour';
  c_emails_24h       constant int      := 20;
  v_agora      timestamptz := now();
  v_contagem   int;
  v_gravadas   int;
  v_fp         text := p_fingerprint;
  v_origem     text := left(coalesce(p_evento ->> 'origem', 'desconhecida'), 60);
  v_mensagem   text := left(coalesce(p_evento ->> 'mensagem', '(sem mensagem)'), 500);
  v_resultado  text := 'registrado';
  v_grupo      app.erros_grupos;
  v_enviados   int;
  v_email_id   bigint;
begin
  -- faxina barata (índices por data); mantém as tabelas no tamanho
  delete from app.erros_limite where janela < v_agora - interval '1 hour';

  -- 1) limite por chave (HMAC do IP do dia, ou edge:<função>)
  insert into app.erros_limite as l (chave, janela, contagem)
    values (left(coalesce(p_chave_limite, 'sem-chave'), 128), date_trunc('minute', v_agora), 1)
  on conflict (chave, janela) do update set contagem = l.contagem + 1
  returning l.contagem into v_contagem;
  if v_contagem > c_por_chave_minuto then
    return jsonb_build_object('resultado', 'limitado', 'enviar_email', false);
  end if;

  delete from app.erros_ocorrencias where criado_em < v_agora - interval '30 days';
  delete from app.erros_emails      where enviado_em < v_agora - interval '30 days';
  delete from app.erros_grupos      where ultima_em < v_agora - interval '90 days';

  -- 2) teto diário de ocorrências gravadas: acima dele o relato vira só
  --    contagem no grupo "teto-diario", que também alerta (uma inundação
  --    é, ela mesma, coisa que o dono precisa saber)
  select count(*) into v_gravadas
    from app.erros_ocorrencias where criado_em > v_agora - interval '24 hours';
  if v_gravadas >= c_teto_24h then
    v_resultado := 'teto';
    v_fp := 'teto-diario';
    v_origem := 'coletor';
    v_mensagem := 'teto de ' || c_teto_24h || ' ocorrências em 24 h atingido; relatos acima dele só são contados';
  end if;

  -- 3) agrupa por fingerprint. O upsert trava a linha do grupo até o fim
  --    da transação: relatos simultâneos do mesmo erro decidem o e-mail
  --    um de cada vez.
  insert into app.erros_grupos as g (fingerprint, origem, mensagem, primeira_em, ultima_em)
    values (v_fp, v_origem, v_mensagem, v_agora, v_agora)
  on conflict (fingerprint) do update
    set ultima_em = v_agora, ocorrencias = g.ocorrencias + 1
  returning g.* into v_grupo;

  if v_resultado = 'registrado' then
    insert into app.erros_ocorrencias
      (fingerprint, origem, mensagem, pilha, componente, rota, release, papel, correlation_id)
    values (
      v_fp, v_origem, v_mensagem,
      left(p_evento ->> 'pilha', 4000),
      left(p_evento ->> 'componente', 2000),
      left(p_evento ->> 'rota', 200),
      left(p_evento ->> 'release', 64),
      case when p_evento ->> 'papel' in ('coordenacao', 'aluno', 'responsavel', 'super_admin',
                                          'anonimo', 'desconhecido', 'servidor')
           then p_evento ->> 'papel' else 'desconhecido' end,
      left(p_evento ->> 'correlation_id', 64)
    );
  end if;

  -- 4) e-mail: no máximo 1 por grupo por hora e 20 em 24 h no total. A
  --    trava consultiva serializa a contagem entre grupos diferentes.
  if coalesce(p_pode_enviar, false)
     and (v_grupo.ultimo_email_em is null or v_grupo.ultimo_email_em <= v_agora - c_email_intervalo) then
    perform pg_advisory_xact_lock(hashtext('app.erros_emails'));
    select count(*) into v_enviados
      from app.erros_emails where enviado_em > v_agora - interval '24 hours';
    if v_enviados < c_emails_24h then
      insert into app.erros_emails (fingerprint, enviado_em) values (v_fp, v_agora)
        returning id into v_email_id;
      update app.erros_grupos set ultimo_email_em = v_agora where fingerprint = v_fp;
    end if;
  end if;

  return jsonb_build_object(
    'resultado',    v_resultado,
    'enviar_email', v_email_id is not null,
    'email_id',     v_email_id,
    'fingerprint',  v_fp,
    'ocorrencias',  v_grupo.ocorrencias,
    'primeira_em',  v_grupo.primeira_em
  );
end $$;

-- ------------------------------------------------------------
-- Resultado do envio. Falha libera o grupo (ultimo_email_em volta ao
-- que era antes da reserva), então o próximo relato tenta de novo; a
-- tentativa falha continua contando no teto de 20 em 24 h.
-- ------------------------------------------------------------
create or replace function public.coletor_marcar_email(p_email_id bigint, p_ok boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email app.erros_emails;
begin
  update app.erros_emails
     set situacao = case when p_ok then 'enviado' else 'falhou' end
   where id = p_email_id and situacao = 'reservado'
  returning * into v_email;
  if v_email.id is not null and not p_ok then
    update app.erros_grupos g
       set ultimo_email_em = (select max(e.enviado_em) from app.erros_emails e
                               where e.fingerprint = g.fingerprint and e.situacao = 'enviado')
     where g.fingerprint = v_email.fingerprint
       and g.ultimo_email_em = v_email.enviado_em;
  end if;
end $$;

revoke all on function public.coletor_registrar_erro(text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.coletor_marcar_email(bigint, boolean) from public, anon, authenticated;
grant execute on function public.coletor_registrar_erro(text, text, jsonb, boolean) to service_role;
grant execute on function public.coletor_marcar_email(bigint, boolean) to service_role;
