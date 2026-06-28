-- ============================================================
-- 0035 — SEC3/T74: virada de semana ESCOPADA POR ESCOLA
-- ------------------------------------------------------------
-- A virada global (0003/0005) continua existindo e é a oficial,
-- agendada no pg_cron (0004). Esta camada ADICIONA uma variante
-- escopada por escola para o OPERADOR rodar a virada de UMA escola
-- sem tocar nas outras (ex.: corrigir uma escola específica, ou
-- escalonar a virada em lote por tenant).
--
-- Blindagem (SEC3, critério de aceite "virada não afeta escola errada"):
--   - escopo: WHERE escola_id = p_escola em TUDO que escreve;
--   - permissão: execução só do service_role (operador/servidor),
--     igual à virada global — nenhum papel de escola dispara;
--   - escola_id: validado (existe) antes de rodar; idempotente.
--
-- Migração ADITIVA e reversível: não altera as funções existentes,
-- só cria novas. Rollback = DROP das funções criadas aqui (no rodapé).
-- ============================================================

-- Variante escopada de app.virar_semana. Mesma REGRA SAGRADA da global
-- (semana por data local, limites inclusivos, clamp), mas TODO efeito
-- fica preso à escola passada — fecha metas e gera metas só dos alunos
-- daquela escola.
create or replace function app.virar_semana(p_escola uuid, p_hoje date default null)
returns table (metas_fechadas int, metas_geradas int)
language plpgsql security definer set search_path = public, app as $$
declare
  v_hoje     date := coalesce(p_hoje, app.hoje_local());
  v_fechadas int;
  v_geradas  int := 0;
  r record;
begin
  if p_escola is null then
    raise exception 'virar_semana por escola exige escola_id (não use NULL — a virada global é app.virar_semana())';
  end if;
  if not exists (select 1 from escolas e where e.id = p_escola) then
    raise exception 'escola % não existe', p_escola;
  end if;

  -- fecha o que venceu, SÓ desta escola (escopo explícito por escola_id)
  update metas set status = 'fechada'
    where status = 'ativa' and fim < v_hoje and escola_id = p_escola;
  get diagnostics v_fechadas = row_count;

  -- gera a meta corrente de quem ainda não tem, SÓ desta escola
  for r in
    select a.id from alunos a
    where a.escola_id = p_escola
      and a.trilha_id is not null
      and not exists (
        select 1 from metas m
        where m.aluno_id = a.id and m.trilha_id = a.trilha_id
          and m.semana_numero = (app.semana_da_data(a.trilha_id, v_hoje)).numero
      )
  loop
    perform app.gerar_meta(r.id, v_hoje);
    v_geradas := v_geradas + 1;
  end loop;

  return query select v_fechadas, v_geradas;
end $$;

-- Porta no schema public para a Edge Function (service role) chamar via
-- RPC, espelhando public.motor_virar_semana() (0005). Sem p_hoje: o
-- operador roda "hoje"; a data explícita fica para os testes (app.*).
create or replace function public.motor_virar_semana_escola(p_escola uuid)
returns jsonb language sql as $$
  select to_jsonb(r) from app.virar_semana(p_escola) r
$$;

-- Privilégio: igual à virada global — só o service_role. Nenhum papel
-- de escola (authenticated/anon) enxerga ou executa. Sem isto, um aluno
-- logado poderia tentar virar a própria escola.
revoke all on function app.virar_semana(uuid, date) from public, authenticated, anon;
revoke all on function public.motor_virar_semana_escola(uuid) from public, authenticated, anon;

grant execute on function app.virar_semana(uuid, date) to service_role;
grant execute on function public.motor_virar_semana_escola(uuid) to service_role;

-- search_path endurecido (mesma linha de 0006/0026): a função public é
-- SQL pura que só delega para app.* (já SECURITY DEFINER endurecida).
alter function public.motor_virar_semana_escola(uuid) set search_path = '';

-- ------------------------------------------------------------
-- ROLLBACK (manual, se necessário):
--   drop function if exists public.motor_virar_semana_escola(uuid);
--   drop function if exists app.virar_semana(uuid, date);
-- A virada global e o cron NÃO dependem destas funções.
-- ------------------------------------------------------------
