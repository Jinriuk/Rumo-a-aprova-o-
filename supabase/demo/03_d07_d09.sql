-- ============================================================
-- DEMO 03 — pré-requisitos de dados do Bloco 1: D07 e D09
-- ------------------------------------------------------------
-- SÓ projeto de demonstração, SÓ Instituto Meridiano. Exige o backup
-- do 02. Idempotente: a segunda execução não encontra o que apagar e
-- os updates viram no-op.
--
-- D07 · Enzo Bandeira nunca acessou (usuario_id nulo, sem
--   consentimento), mas tinha 1 registro (26/08, 24 questões, 10
--   acertos) e 2 simulados (22/08 e 26/08) inseridos em 19/09 16:18
--   UTC. A RLS só deixa o PRÓPRIO aluno inserir registro e simulado,
--   então nenhum dos três é possível no produto real. Os 100 XP dele
--   vinham dos 2 simulados (50 cada); o registro valia 0 XP. O
--   documento de 23/09 atribuía os 100 XP ao registro — decisão do
--   Gabriel em 23/09: remover registro E simulados.
--   Os gatilhos ficam LIGADOS aqui: o XP sai pelo estorno
--   (trg_estorno_registro / trg_estorno_simulado marcam os 3 eventos
--   como 'estornado'). O nível 'mat' calculado a partir do registro
--   removido e a sua linha de histórico saem junto — sem registro,
--   não há de onde calcular nível.
--
-- D09 · As 9 semanas passam a ir de segunda a domingo, com a semana 4
--   de 14 a 20/09. Na prática mudam a semana 1 (22/08 sáb → 24/08 seg)
--   e a 9 (fim 24/10 sáb → 25/10 dom). Registros e simulados antes do
--   novo início vão para o primeiro dia da semana 1. O motor PED1 é
--   silenciado pelo interruptor que o próprio produto usa em seed
--   (app.motor_seed = 'on'): mudar a DATA de um registro não muda
--   nenhum agregado por matéria, então não há o que recalcular.
-- ============================================================

do $$
declare
  v_escola constant uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_trilha constant uuid := 'dddddddd-0000-4000-8000-000000000001';
  v_enzo   constant uuid := 'dddddddd-a000-4000-8000-000000000008';
  v_sem4   constant date := date '2026-09-14';
  n_reg int; n_sim int; n_niv int; n_hist int;
  n_sem int; n_meta int; n_mov_reg int; n_mov_sim int;
begin
  -- regra 3: só o tenant de demonstração
  if not exists (select 1 from public.escolas where id = v_escola and plano = 'demo') then
    raise exception 'D07/D09: Meridiano/plano demo ausente — abortado';
  end if;
  -- a mesma guarda de demo.checar_tenant(): aluno OU meta de outro tenant
  -- (uma meta pode ficar na trilha depois que o aluno mudou de trilha)
  if exists (select 1 from public.alunos where trilha_id = v_trilha and escola_id <> v_escola)
     or exists (select 1 from public.metas where trilha_id = v_trilha and escola_id <> v_escola) then
    raise exception 'D09: a trilha % é usada por outro tenant — abortado', v_trilha;
  end if;
  -- regra 4: backup antes
  if to_regclass('demo.backup_20260923_registros_estudo') is null then
    raise exception 'D07/D09: rode supabase/demo/02_backup_20260923.sql antes';
  end if;
  -- premissa do D07 ainda vale?
  if not exists (select 1 from public.alunos
                  where id = v_enzo and escola_id = v_escola and usuario_id is null) then
    raise exception 'D07: Enzo não está no Meridiano ou já tem credencial — premissa "nunca acessou" não vale mais';
  end if;

  -- ── D07 (gatilhos ligados: o estorno tira o XP) ──────────────────
  delete from public.registros_estudo where escola_id = v_escola and aluno_id = v_enzo;
  get diagnostics n_reg = row_count;
  delete from public.simulados where escola_id = v_escola and aluno_id = v_enzo;
  get diagnostics n_sim = row_count;
  delete from public.aluno_nivel_historico
   where escola_id = v_escola and aluno_id = v_enzo and origem = 'calculado';
  get diagnostics n_hist = row_count;
  delete from public.aluno_niveis
   where escola_id = v_escola and aluno_id = v_enzo and origem = 'calculado';
  get diagnostics n_niv = row_count;

  -- ── D09 ───────────────────────────────────────────────────────────
  perform set_config('app.motor_seed', 'on', true);

  update public.trilha_semanas
     set inicio = v_sem4 + (numero - 4) * 7,
         fim    = v_sem4 + (numero - 4) * 7 + 6
   where trilha_id = v_trilha
     and (inicio, fim) is distinct from (v_sem4 + (numero - 4) * 7, v_sem4 + (numero - 4) * 7 + 6);
  get diagnostics n_sem = row_count;

  update public.metas m
     set inicio = ts.inicio, fim = ts.fim
    from public.trilha_semanas ts
   where m.escola_id = v_escola and m.trilha_id = v_trilha
     and ts.trilha_id = v_trilha and ts.numero = m.semana_numero
     and (m.inicio, m.fim) is distinct from (ts.inicio, ts.fim);
  get diagnostics n_meta = row_count;

  update public.registros_estudo set data = v_sem4 - 21
   where escola_id = v_escola and data < v_sem4 - 21;
  get diagnostics n_mov_reg = row_count;
  update public.simulados set data = v_sem4 - 21
   where escola_id = v_escola and data < v_sem4 - 21;
  get diagnostics n_mov_sim = row_count;

  perform set_config('app.motor_seed', '', true);

  if exists (select 1 from public.trilha_semanas
              where trilha_id = v_trilha and (extract(isodow from inicio) <> 1 or fim - inicio <> 6)) then
    raise exception 'D09: sobrou semana que não é segunda a domingo';
  end if;

  insert into demo.execucoes (acao, hoje, detalhe)
  values ('d07_d09', app.hoje_local(), jsonb_build_object(
    'd07_registros', n_reg, 'd07_simulados', n_sim, 'd07_niveis', n_niv, 'd07_historico', n_hist,
    'd09_semanas', n_sem, 'd09_metas', n_meta, 'd09_registros', n_mov_reg, 'd09_simulados', n_mov_sim));
end $$;

-- resultado em 23/09/2026 (demo.execucoes, acao = 'd07_d09'):
-- d07: 1 registro, 2 simulados, 1 nível, 1 histórico · d09: 2 semanas,
-- 8 metas (semana 1), 5 registros de 22/08 → 24/08, 0 simulados
select detalhe from demo.execucoes where acao = 'd07_d09' order by id desc limit 1;
