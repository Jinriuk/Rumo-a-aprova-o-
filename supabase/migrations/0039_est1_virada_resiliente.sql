-- ============================================================
-- 0039 — EST1-A2: VIRADA DE SEMANA RESILIENTE + FK DE TRILHA + HEARTBEAT
-- ------------------------------------------------------------
-- Achado EST0 (BANCO-01 / A3, confirmado adversarialmente — e PIOR que
-- o alegado): app.virar_semana() global iterava todos os alunos numa
-- transação única SEM bloco de exceção, e o próprio SELECT do loop
-- chamava app.semana_da_data() por linha no NOT EXISTS. Bastava UM
-- aluno apontando para trilha vazia/inexistente (alunos.trilha_id não
-- tinha FK, 0001) para a query abortar ANTES do loop: nenhuma meta
-- fechada nem gerada para NENHUMA escola — e em silêncio, porque não
-- há alerta do pg_cron (EST0 A5).
--
-- Três correções nesta migration:
--   1) RESILIÊNCIA: o cálculo de semana e a geração de meta ficam
--      DENTRO de um bloco protegido por aluno — aluno problemático é
--      pulado, o erro é acumulado no retorno, o resto do mundo segue.
--   2) FK alunos.trilha_id → trilhas(id) ON DELETE SET NULL — o vetor
--      "uuid pendurado" morre na raiz (órfãos pré-existentes são
--      anulados antes, defensivo para qualquer ambiente).
--   3) HEARTBEAT: toda execução (global ou por escola) grava uma linha
--      em virada_execucoes com fechadas/geradas/erros. A AUSÊNCIA de
--      linha recente é o sinal de alerta que a EST1-B vai monitorar;
--      a PRESENÇA de erros também.
--
-- A REGRA SAGRADA não muda: semana por data LOCAL, limites inclusivos,
-- clamp antes/depois (0003). O retorno ganha a coluna alunos_com_erro —
-- os wrappers public.* usam to_jsonb(r), então o campo novo flui sem
-- quebrar os consumidores (Edge virar-semana repassa o jsonb).
-- Idempotente; recria funções com DROP prévio porque o tipo de retorno
-- muda (CREATE OR REPLACE não permite).
-- ============================================================

-- ------------------------------------------------------------
-- 1) FK alunos.trilha_id → trilhas(id). Antes, anula órfãos
--    (defensivo: em base saudável é no-op).
-- ------------------------------------------------------------
update alunos a set trilha_id = null
 where a.trilha_id is not null
   and not exists (select 1 from trilhas t where t.id = a.trilha_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alunos_trilha_id_fkey' and conrelid = 'alunos'::regclass
  ) then
    alter table alunos
      add constraint alunos_trilha_id_fkey
      foreign key (trilha_id) references trilhas (id) on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) HEARTBEAT — registro de cada execução da virada. Quem escreve é
--    a própria função (SECURITY DEFINER, dono da tabela). Leitura:
--    super_admin (backoffice) e service_role; escola não enxerga.
-- ------------------------------------------------------------
create table if not exists virada_execucoes (
  id              uuid primary key default gen_random_uuid(),
  escola_id       uuid references escolas (id) on delete set null, -- null = virada global
  data_referencia date not null,
  metas_fechadas  int  not null default 0,
  metas_geradas   int  not null default 0,
  alunos_com_erro int  not null default 0,
  erros           jsonb not null default '[]'::jsonb,  -- [{aluno_id, erro}]
  executado_em    timestamptz not null default now()
);

create index if not exists idx_virada_exec_recente on virada_execucoes (executado_em desc);

alter table virada_execucoes enable row level security;

drop policy if exists virada_exec_super_admin on virada_execucoes;
create policy virada_exec_super_admin on virada_execucoes for select to authenticated
  using (app.eh_super_admin());

grant select on virada_execucoes to authenticated;
grant select, insert, update, delete on virada_execucoes to service_role;

comment on table virada_execucoes is
  'EST1-A2 (0039): heartbeat da virada de semana. Ausência de linha recente '
  'ou alunos_com_erro > 0 é o sinal de alerta (monitor na EST1-B).';

-- ------------------------------------------------------------
-- 3) MIolo compartilhado: gera a meta corrente de um aluno de forma
--    PROTEGIDA. Devolve 'gerada' | 'ja_tinha' | 'erro' e, no erro,
--    escreve a mensagem em p_erro (nunca propaga exceção).
-- ------------------------------------------------------------
create or replace function app.gerar_meta_protegida(
  p_aluno uuid, p_trilha uuid, p_hoje date, out resultado text, out erro text
)
language plpgsql security definer set search_path = public, app as $$
declare
  v_semana trilha_semanas;
begin
  v_semana := app.semana_da_data(p_trilha, p_hoje);
  if exists (
    select 1 from metas m
    where m.aluno_id = p_aluno and m.trilha_id = p_trilha
      and m.semana_numero = v_semana.numero
  ) then
    resultado := 'ja_tinha';
    return;
  end if;
  perform app.gerar_meta(p_aluno, p_hoje);
  resultado := 'gerada';
exception when others then
  resultado := 'erro';
  erro := sqlerrm;
end $$;

revoke all on function app.gerar_meta_protegida(uuid, uuid, date) from public, authenticated, anon;
grant execute on function app.gerar_meta_protegida(uuid, uuid, date) to service_role;

-- ------------------------------------------------------------
-- 4) VIRADA GLOBAL resiliente. Tipo de retorno muda (+ alunos_com_erro),
--    então DROP antes (os wrappers public.* são recriados no §6).
-- ------------------------------------------------------------
drop function if exists app.virar_semana(date);

create function app.virar_semana(p_hoje date default null)
returns table (metas_fechadas int, metas_geradas int, alunos_com_erro int)
language plpgsql security definer set search_path = public, app as $$
declare
  v_hoje     date := coalesce(p_hoje, app.hoje_local());
  v_fechadas int;
  v_geradas  int := 0;
  v_erros    int := 0;
  v_lista    jsonb := '[]'::jsonb;
  v_res      text;
  v_msg      text;
  r          record;
begin
  -- fecha o que venceu (fim < hoje, limites inclusivos preservados)
  update metas set status = 'fechada' where status = 'ativa' and fim < v_hoje;
  get diagnostics v_fechadas = row_count;

  -- gera a meta corrente de quem ainda não tem — POR aluno, protegido:
  -- a trilha ruim de um aluno não derruba a virada dos demais.
  for r in
    select a.id, a.trilha_id from alunos a where a.trilha_id is not null
  loop
    select p.resultado, p.erro into v_res, v_msg
      from app.gerar_meta_protegida(r.id, r.trilha_id, v_hoje) p;
    if v_res = 'gerada' then
      v_geradas := v_geradas + 1;
    elsif v_res = 'erro' then
      v_erros := v_erros + 1;
      v_lista := v_lista || jsonb_build_object('aluno_id', r.id, 'erro', v_msg);
      raise warning 'virada: aluno % pulado (%)', r.id, v_msg;
    end if;
  end loop;

  insert into virada_execucoes (escola_id, data_referencia, metas_fechadas, metas_geradas, alunos_com_erro, erros)
    values (null, v_hoje, v_fechadas, v_geradas, v_erros, v_lista);

  return query select v_fechadas, v_geradas, v_erros;
end $$;

revoke all on function app.virar_semana(date) from public, authenticated, anon;
grant execute on function app.virar_semana(date) to service_role;

-- ------------------------------------------------------------
-- 5) VIRADA POR ESCOLA resiliente (mesma blindagem da 0035: escopo por
--    escola_id em tudo que escreve; execução só service_role).
-- ------------------------------------------------------------
drop function if exists app.virar_semana(uuid, date);

create function app.virar_semana(p_escola uuid, p_hoje date default null)
returns table (metas_fechadas int, metas_geradas int, alunos_com_erro int)
language plpgsql security definer set search_path = public, app as $$
declare
  v_hoje     date := coalesce(p_hoje, app.hoje_local());
  v_fechadas int;
  v_geradas  int := 0;
  v_erros    int := 0;
  v_lista    jsonb := '[]'::jsonb;
  v_res      text;
  v_msg      text;
  r          record;
begin
  if p_escola is null then
    raise exception 'virar_semana por escola exige escola_id (não use NULL — a virada global é app.virar_semana())';
  end if;
  if not exists (select 1 from escolas e where e.id = p_escola) then
    raise exception 'escola % não existe', p_escola;
  end if;

  update metas set status = 'fechada'
    where status = 'ativa' and fim < v_hoje and escola_id = p_escola;
  get diagnostics v_fechadas = row_count;

  for r in
    select a.id, a.trilha_id from alunos a
    where a.escola_id = p_escola and a.trilha_id is not null
  loop
    select p.resultado, p.erro into v_res, v_msg
      from app.gerar_meta_protegida(r.id, r.trilha_id, v_hoje) p;
    if v_res = 'gerada' then
      v_geradas := v_geradas + 1;
    elsif v_res = 'erro' then
      v_erros := v_erros + 1;
      v_lista := v_lista || jsonb_build_object('aluno_id', r.id, 'erro', v_msg);
      raise warning 'virada escola %: aluno % pulado (%)', p_escola, r.id, v_msg;
    end if;
  end loop;

  insert into virada_execucoes (escola_id, data_referencia, metas_fechadas, metas_geradas, alunos_com_erro, erros)
    values (p_escola, v_hoje, v_fechadas, v_geradas, v_erros, v_lista);

  return query select v_fechadas, v_geradas, v_erros;
end $$;

revoke all on function app.virar_semana(uuid, date) from public, authenticated, anon;
grant execute on function app.virar_semana(uuid, date) to service_role;

-- ------------------------------------------------------------
-- 6) Wrappers public recriados (0005/0035): mesmo nome, mesmo jsonb —
--    o campo alunos_com_erro entra no json automaticamente.
-- ------------------------------------------------------------
create or replace function public.motor_virar_semana()
returns jsonb language sql as $$
  select to_jsonb(r) from app.virar_semana() r
$$;

create or replace function public.motor_virar_semana_escola(p_escola uuid)
returns jsonb language sql as $$
  select to_jsonb(r) from app.virar_semana(p_escola) r
$$;

revoke all on function public.motor_virar_semana() from public, authenticated, anon;
revoke all on function public.motor_virar_semana_escola(uuid) from public, authenticated, anon;
grant execute on function public.motor_virar_semana() to service_role;
grant execute on function public.motor_virar_semana_escola(uuid) to service_role;

-- search_path endurecido de novo: o CREATE OR REPLACE acima reseta o
-- ajuste que a 0006/0035 tinham aplicado — reaplicar é obrigatório.
alter function public.motor_virar_semana()            set search_path = '';
alter function public.motor_virar_semana_escola(uuid) set search_path = '';

-- ------------------------------------------------------------
-- ROLLBACK (manual, se necessário): recriar app.virar_semana(date) e
-- app.virar_semana(uuid, date) com os corpos de 0003/0035;
--   drop function app.gerar_meta_protegida(uuid, uuid, date);
--   drop table virada_execucoes;  -- (perde o histórico de heartbeat)
-- O cron (0004) chama `select app.virar_semana();` e continua válido.
-- ------------------------------------------------------------
