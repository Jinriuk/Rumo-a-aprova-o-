-- ============================================================
-- 0043 — EST1-B3: SAÚDE DA VIRADA (leitura do heartbeat de A2/0039)
-- ------------------------------------------------------------
-- A 0039 (EST1-A2) passou a gravar um heartbeat em virada_execucoes a
-- cada execução da virada. Esta migration cria a LEITURA desse sinal —
-- a metade de CÓDIGO do alerta que o EST0 A5/A15 pediu ("pg_cron roda às
-- cegas"). A ENTREGA da notificação (e-mail/webhook/uptime) é config do
-- dono (ver docs/auditoria/est1/relatorio-est1-b...).
--
-- app.virada_saude() responde: a última virada GLOBAL rodou dentro da
-- janela esperada e sem alunos com erro? Devolve ok + diagnóstico. Um
-- monitor (Edge agendada / uptime externo / cron) chama isto e dispara
-- alerta quando ok=false. O backoffice do super_admin também exibe.
--
-- Janela padrão 26h: o cron roda diário (0004); 24h + 2h de margem.
-- Idempotente. Não altera a virada nem o heartbeat.
-- ============================================================

create or replace function app.virada_saude(p_janela_horas int default 26)
returns table (
  ok               boolean,
  ultima_execucao  timestamptz,
  horas_desde      numeric,
  metas_geradas    int,
  alunos_com_erro  int,
  motivo           text
)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v virada_execucoes;
  v_horas numeric;
begin
  -- só a virada GLOBAL (escola_id is null) é a agendada pelo cron; as
  -- por-escola são operação manual e não definem a saúde do job.
  select * into v from virada_execucoes
    where escola_id is null order by executado_em desc limit 1;

  if not found then
    return query select false, null::timestamptz, null::numeric, null::int, null::int,
                        'a virada nunca executou (heartbeat vazio)'::text;
    return;
  end if;

  v_horas := round((extract(epoch from (now() - v.executado_em)) / 3600)::numeric, 1);

  return query select
    (v.alunos_com_erro = 0 and v_horas <= p_janela_horas),
    v.executado_em,
    v_horas,
    v.metas_geradas,
    v.alunos_com_erro,
    (case
      when v.alunos_com_erro > 0
        then v.alunos_com_erro || ' aluno(s) pulados por erro na última virada'
      when v_horas > p_janela_horas
        then 'virada atrasada: última execução há ' || v_horas || ' h (janela ' || p_janela_horas || ' h)'
      else 'ok'
    end)::text;
end $$;

revoke all on function app.virada_saude(int) from public, authenticated, anon;
grant execute on function app.virada_saude(int) to service_role;

comment on function app.virada_saude(int) is
  'EST1-B3 (0043): saúde da virada a partir do heartbeat virada_execucoes. '
  'ok=false quando a última virada global atrasou ou pulou alunos. '
  'Metade de código do alerta; entrega da notificação é config do dono.';

-- Porta para o super_admin ver no backoffice (mesma doutrina dos
-- backoffice_*: SECURITY DEFINER com porteiro eh_super_admin).
create or replace function public.backoffice_virada_saude(p_janela_horas int default 26)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.eh_super_admin() then
    raise exception 'acesso negado';
  end if;
  return (select to_jsonb(s) from app.virada_saude(p_janela_horas) s);
end $$;

revoke all on function public.backoffice_virada_saude(int) from public, anon;
grant execute on function public.backoffice_virada_saude(int) to authenticated, service_role;
