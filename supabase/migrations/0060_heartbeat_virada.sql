-- ============================================================
-- 0060 — heartbeat externo da virada (healthchecks.io) via pg_net + Vault
--         (Etapa 4, parte final; lacuna 8.4 da matriz de configuração)
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono, e só depois do primeiro backup real
-- (Etapa 6). Escrita e ensaiada em Postgres local e na stack local da E3.
-- NUMERAÇÃO: depende da 0059 só pela numeração contígua.
--
-- O QUE FAZ
--   Ao fim de cada virada GLOBAL (a do pg_cron, 0004), app.virar_semana()
--   grava uma linha em virada_execucoes com escola_id nulo (0039). Um
--   gatilho AFTER INSERT nessa linha agenda, pelo pg_net, um POST para a
--   URL guardada no Vault com o nome `hc_virada_url`:
--     alunos_com_erro = 0  → <url>         (sucesso)
--     alunos_com_erro > 0  → <url>/fail    (o healthchecks avisa na hora)
--   Corpo: data de referência e as três contagens. Nenhum id de aluno.
--
-- POR QUE GATILHO, E NÃO REESCREVER app.virar_semana
--   O ponto de saída da virada já existe: a inserção do heartbeat é o
--   último comando antes do RETURN. Pendurar o ping ali não toca na
--   regra sagrada (0003/0039) nem copia o corpo da função para cá, e a
--   migration fica só com CREATE (guarda da E5). O pg_net enfileira o
--   pedido na mesma transação: se a virada abortar, nada sai.
--
-- O QUE NUNCA ACONTECE
--   O ping não derruba a virada. Sem pg_net, sem Vault, sem o segredo ou
--   com erro ao enfileirar, o gatilho só emite WARNING e devolve a linha.
--   O silêncio resultante é o próprio alarme: o healthchecks acusa a
--   falta de ping depois do período + folga do check `virada-semana`.
--   Virada que aborta inteira também não pinga, e cai no mesmo alarme.
--
-- O QUE O DONO FAZ (não está nesta migration de propósito: a URL é um
-- segredo e não entra no repositório)
--   select vault.create_secret('https://hc-ping.com/<uuid>', 'hc_virada_url',
--                              'healthchecks: check virada-semana');
--   Ver docs/operacao/alertas-dono.md.
--
-- ROLLBACK (manual)
--   drop trigger trg_heartbeat_virada on public.virada_execucoes;
--   drop function app.heartbeat_virada();
--   (o pg_net pode ficar; não é usado por mais nada)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  else
    raise notice 'pg_net indisponível neste ambiente: o heartbeat da virada fica sem efeito (ok em teste local)';
  end if;
end $$;

create or replace function app.heartbeat_virada()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
begin
  begin
    if to_regclass('vault.decrypted_secrets') is null
       or not exists (select 1 from pg_catalog.pg_proc p
                        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'net' and p.proname = 'http_post') then
      raise warning 'heartbeat da virada: pg_net ou Vault ausente; nenhum ping enviado';
      return new;
    end if;

    select s.decrypted_secret into v_url
      from vault.decrypted_secrets s
     where s.name = 'hc_virada_url'
     order by s.created_at desc
     limit 1;
    v_url := btrim(coalesce(v_url, ''));
    if v_url !~ '^https?://[^[:space:]]+$' then
      raise warning 'heartbeat da virada: segredo hc_virada_url ausente ou inválido no Vault; nenhum ping enviado';
      return new;
    end if;

    v_url := rtrim(v_url, '/');
    if new.alunos_com_erro > 0 then
      v_url := v_url || '/fail';
    end if;

    perform net.http_post(
      url := v_url,
      body := pg_catalog.jsonb_build_object(
        'data_referencia', new.data_referencia,
        'metas_fechadas',  new.metas_fechadas,
        'metas_geradas',   new.metas_geradas,
        'alunos_com_erro', new.alunos_com_erro),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'heartbeat da virada: falha ao agendar o ping (%)', sqlerrm;
  end;
  return new;
end $$;

revoke all on function app.heartbeat_virada() from public, anon, authenticated;

create or replace trigger trg_heartbeat_virada
  after insert on public.virada_execucoes
  for each row
  when (new.escola_id is null)
  execute function app.heartbeat_virada();

comment on function app.heartbeat_virada() is
  'E4 (0060): ao fim da virada global, pinga hc_virada_url (Vault) pelo pg_net; '
  'com alunos_com_erro > 0 pinga <url>/fail. Nunca aborta a virada.';
