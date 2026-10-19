-- ============================================================
-- DEMO (bdjkgrzfzoamchdpobbl) — 0066 com guarda e ledger.
-- Trecho entre INICIO e FIM = supabase/migrations/0066_quest_banca_preferida.sql
-- de faab87d, md5 6b43d7b8d839c3142aa5137ce6cc493c.
-- Depois: publicar a questoes-integradas de faab87d e só então os filtros.
-- ============================================================
begin;
do $$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where name like '0066%') then raise exception 'guarda: a 0066 já está no ledger'; end if;
  if (select name from supabase_migrations.schema_migrations order by version desc limit 1) <> '0065_quest_questoes_integradas' then raise exception 'guarda: a última não é a 0065'; end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 67 then raise exception 'guarda: o ledger não tem 67 linhas'; end if;
end $$;
-- >>> INICIO 0066 <<<
-- ============================================================
-- 0066 — questões integradas: banca preferida primeiro, depois qualquer banca
-- ------------------------------------------------------------
-- APROVAÇÃO: desenho aprovado pelo dono em 16/10/2026 (FGV = SIM). Não
-- aplicar em demonstração nem em produção sem aprovação explícita do
-- dono. Depende da 0065.
-- ORIGEM: P1.1, docs/operacao/questoes-integradas-quest.md, seção
--   "Banca preferida (0066)".
--
-- O PROBLEMA
--   A 0065 busca na Quest sem banca. O CFO PMERJ é FGV, e a medição de
--   04/10 mostrou que FGV sozinha não fecha: das 16 missões ligadas, só
--   M01-ADM (41), M02-ADM (32) e M02-CONST (142) têm 20 ou mais questões
--   FGV; M01-CPP e M03-CPM têm 0. A regra é FGV primeiro e, quando acabar,
--   qualquer banca.
--
-- A REGRA
--   1. app.quest_filtros_missao ganha banca_preferida (null = sem
--      preferência, comportamento da 0065), cursor_preferida (paginação
--      da busca com banca) e preferida_esgotada_em (a busca com banca
--      acabou). esgotada_em continua significando "a busca geral acabou".
--   2. quest_preparar_entrega (mesma assinatura): enquanto houver banca
--      preferida não esgotada, o pedido de busca sai com fase 'preferida',
--      a banca e o cursor_preferida; depois, fase 'geral', sem banca e com
--      o cursor geral. O estoque guardado é servido com a banca preferida
--      primeiro.
--   3. quest_guardar_questoes ganha uma versão com p_fase (obrigatório,
--      sem default, para a chamada de 4 argumentos não ficar ambígua):
--      grava o cursor e o "esgotou" da fase certa e devolve quantas
--      questões eram NOVAS para a missão e qual seria a próxima busca.
--      A Edge Function usa isso para fazer, no máximo, uma segunda busca
--      no mesmo pedido quando o lote ficou curto (FGV acabou, ou a busca
--      geral devolveu questões já guardadas).
--   4. A versão de 4 argumentos continua existindo e faz o que fazia
--      (fase geral): a função publicada antes desta migration segue
--      funcionando até o novo deploy.
--
-- CUSTO
--   Na fase geral, as questões FGV já guardadas voltam da Quest e são
--   cobradas de novo (6 créditos cada); o banco não duplica. O teto por
--   missão é o total FGV dela (M02-CONST: 142 × 6 = 852 créditos), por
--   percurso: se o filtro mudar e os cursores zerarem, paga de novo.
--
-- ORDEM DE PUBLICAÇÃO
--   0066 → deploy da questoes-integradas → filtros com banca_preferida.
--   Com banca_preferida preenchida e a função antiga no ar, a função
--   antiga buscaria sem banca a partir do cursor_preferida e gravaria no
--   cursor geral, recomeçando a paginação geral.
--
-- Aditiva (3 colunas novas, 1 função nova, 2 funções reescritas com a
-- mesma assinatura). Idempotente. ROLLBACK no fim.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Colunas
-- ------------------------------------------------------------
alter table app.quest_filtros_missao
  add column if not exists banca_preferida text
    check (banca_preferida is null or length(banca_preferida) between 1 and 100),
  add column if not exists cursor_preferida text
    check (cursor_preferida is null or length(cursor_preferida) between 1 and 200),
  add column if not exists preferida_esgotada_em timestamptz;

comment on column app.quest_filtros_missao.banca_preferida is
  '0066: banca buscada primeiro (nome exato da Quest). null = sem preferência.';
comment on column app.quest_filtros_missao.cursor_preferida is
  '0066: paginação (after_id) da busca com banca_preferida. null = do começo.';
comment on column app.quest_filtros_missao.preferida_esgotada_em is
  '0066: a busca com banca_preferida acabou; daí em diante, a busca geral.';

-- ------------------------------------------------------------
-- 2) Guardar os itens (um lugar só para as duas versões de guardar)
-- ------------------------------------------------------------
-- SECURITY INVOKER de propósito: só é chamada de dentro das
-- quest_guardar_questoes (SECURITY DEFINER), e ninguém mais a executa.
-- 'novas' conta as questões que a missão ainda não tinha: questão
-- repetida não fecha lote de ninguém.
create or replace function app.quest_guardar_itens(p_missao uuid, p_itens jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it      jsonb;
  v_id    uuid;
  v_nova  int;
  n       int := 0;
  k       int := 0;
begin
  for it in select * from pg_catalog.jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    insert into app.quest_questoes as q
      (id_externo, banca, orgao, cargo, ano, materia_fornecedor, assunto_fornecedor, tipo,
       enunciado, alternativas, gabarito, anulada, desatualizada)
    values (it ->> 'id_externo', it ->> 'banca', it ->> 'orgao', it ->> 'cargo', (it ->> 'ano')::int,
            it ->> 'materia', it ->> 'assunto', it ->> 'tipo', it ->> 'enunciado', it -> 'alternativas',
            it ->> 'gabarito', coalesce((it ->> 'anulada')::boolean, false),
            coalesce((it ->> 'desatualizada')::boolean, false))
    on conflict (fornecedor, id_externo) do update set
      banca = excluded.banca, orgao = excluded.orgao, cargo = excluded.cargo, ano = excluded.ano,
      materia_fornecedor = excluded.materia_fornecedor, assunto_fornecedor = excluded.assunto_fornecedor,
      tipo = excluded.tipo, enunciado = excluded.enunciado, alternativas = excluded.alternativas,
      gabarito = excluded.gabarito,
      gabarito_versao = q.gabarito_versao + case when q.gabarito <> excluded.gabarito then 1 else 0 end,
      anulada = excluded.anulada, desatualizada = excluded.desatualizada, atualizada_em = now()
    returning q.id into v_id;
    insert into app.quest_questao_missao (missao_id, questao_id) values (p_missao, v_id) on conflict do nothing;
    get diagnostics v_nova = row_count;
    n := n + 1;
    k := k + v_nova;
  end loop;
  return pg_catalog.jsonb_build_object('guardadas', n, 'novas', k);
end $$;

-- ------------------------------------------------------------
-- 3) Guardar, versão da 0065 (4 argumentos): fase geral, como antes
-- ------------------------------------------------------------
create or replace function public.quest_guardar_questoes(
  p_missao uuid, p_itens jsonb, p_cursor text default null, p_esgotada boolean default false
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not exists (select 1 from app.quest_filtros_missao where missao_id = p_missao) then
    raise exception 'quest: missão sem filtro' using errcode = '22023';
  end if;
  r := app.quest_guardar_itens(p_missao, p_itens);
  update app.quest_filtros_missao
     set cursor = coalesce(p_cursor, cursor),
         esgotada_em = case when p_esgotada then now() else esgotada_em end,
         atualizado_em = now()
   where missao_id = p_missao;
  return (r ->> 'guardadas')::int;
end $$;

-- ------------------------------------------------------------
-- 4) Guardar com fase (0066)
-- ------------------------------------------------------------
-- Devolve {guardadas, novas, proxima}. proxima é a busca que viria a
-- seguir ({fase, banca, cursor}) ou null quando as duas acabaram.
create or replace function public.quest_guardar_questoes(
  p_missao uuid, p_itens jsonb, p_cursor text, p_esgotada boolean, p_fase text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f  app.quest_filtros_missao;
  r  jsonb;
begin
  if p_fase is null or p_fase not in ('preferida', 'geral') then
    raise exception 'quest: fase inválida' using errcode = '22023';
  end if;
  -- trava a linha: duas buscas da mesma missão não cruzam os cursores
  select * into f from app.quest_filtros_missao where missao_id = p_missao for update;
  if not found then
    raise exception 'quest: missão sem filtro' using errcode = '22023';
  end if;
  if p_fase = 'preferida' and f.banca_preferida is null then
    raise exception 'quest: missão sem banca preferida' using errcode = '22023';
  end if;

  r := app.quest_guardar_itens(p_missao, p_itens);

  if p_fase = 'preferida' then
    update app.quest_filtros_missao
       set cursor_preferida = coalesce(p_cursor, cursor_preferida),
           preferida_esgotada_em = case when coalesce(p_esgotada, false) then now() else preferida_esgotada_em end,
           atualizado_em = now()
     where missao_id = p_missao
    returning * into f;
  else
    update app.quest_filtros_missao
       set cursor = coalesce(p_cursor, cursor),
           esgotada_em = case when coalesce(p_esgotada, false) then now() else esgotada_em end,
           atualizado_em = now()
     where missao_id = p_missao
    returning * into f;
  end if;

  return r || pg_catalog.jsonb_build_object('proxima',
    case
      when f.banca_preferida is not null and f.preferida_esgotada_em is null
        then pg_catalog.jsonb_build_object('fase', 'preferida', 'banca', f.banca_preferida, 'cursor', f.cursor_preferida)
      when f.esgotada_em is null
        then pg_catalog.jsonb_build_object('fase', 'geral', 'banca', null, 'cursor', f.cursor)
    end);
end $$;

-- ------------------------------------------------------------
-- 5) Entregar: igual à 0065, com a fase da busca e a banca preferida
--    primeiro no estoque (marcado com 0066 nos dois pontos)
-- ------------------------------------------------------------
create or replace function public.quest_preparar_entrega(
  p_usuario uuid, p_escola uuid, p_missao uuid, p_pedido uuid,
  p_tamanho int default null, p_sem_busca boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  lim       jsonb := app.quest_limites();
  v_tam     int;
  a         public.alunos;
  v_exam    text;
  m         public.missoes;
  f         app.quest_filtros_missao;
  e         app.quest_entregas;
  v_tipo    text;
  v_ids     uuid[];
  v_dia     int;
  v_hora    int;
  v_fase    text;
begin
  v_tam := least(greatest(coalesce(p_tamanho, (lim ->> 'lote_padrao')::int), 1), (lim ->> 'lote_max')::int);
  if p_usuario is null or p_escola is null or p_missao is null or p_pedido is null then
    return '{"estado": "pedido_invalido"}';
  end if;

  select * into a from public.alunos
   where usuario_id = p_usuario and escola_id = p_escola limit 1;
  if not found then return '{"estado": "sem_aluno"}'; end if;
  select c.codigo into v_exam from public.concursos c where c.id = a.concurso_id;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quest:' || a.id::text, 0));

  -- pedido repetido (retransmissão do navegador): o mesmo lote
  select * into e from app.quest_entregas where aluno_id = a.id and pedido_id = p_pedido;
  if found then
    return pg_catalog.jsonb_build_object('estado', 'ok', 'repetido', true, 'entrega', app.quest_entrega_json(e.id));
  end if;

  select * into m from public.missoes where id = p_missao;
  if not found or v_exam is null or m.exam_tag <> v_exam then
    return '{"estado": "missao_invalida"}';
  end if;
  if exists (select 1 from public.missoes_escola me
              where me.missao_id = m.id and me.escola_id = a.escola_id and me.ativa = false) then
    return '{"estado": "missao_invalida"}';
  end if;

  select * into f from app.quest_filtros_missao where missao_id = m.id;
  if not found or not f.ativo then return '{"estado": "indisponivel"}'; end if;

  -- 'missao' só na da vez; 'revisao' em missão já iniciada (0064)
  if app.quest_missao_da_vez(a.id, m.materia_codigo) = m.id then
    v_tipo := 'missao';
  elsif exists (select 1 from public.aluno_missoes am where am.aluno_id = a.id and am.missao_id = m.id) then
    v_tipo := 'revisao';
  else
    return '{"estado": "fora_da_vez"}';
  end if;

  -- lote aberto da mesma missão com questão por responder: retoma
  select * into e from app.quest_entregas en
   where en.aluno_id = a.id and en.missao_id = m.id and en.expira_em > now()
     and exists (select 1 from unnest(en.questoes) x(qid)
                  where not exists (select 1 from app.quest_tentativas t
                                     where t.aluno_id = a.id and t.questao_id = x.qid))
   order by en.criada_em desc limit 1;
  if found then
    return pg_catalog.jsonb_build_object('estado', 'ok', 'retomado', true, 'entrega', app.quest_entrega_json(e.id));
  end if;

  -- limite por aluno: questões entregues hoje (data local) e lotes na última hora
  -- (a janela de uma hora não depende do dia: não zera à meia-noite)
  select coalesce(sum(cardinality(en.questoes))
                    filter (where (en.criada_em at time zone 'America/Sao_Paulo')::date = app.hoje_local()), 0),
         count(*) filter (where en.criada_em > now() - interval '1 hour')
    into v_dia, v_hora
    from app.quest_entregas en
   where en.aluno_id = a.id
     and en.criada_em > now() - interval '2 days';
  if v_hora >= (lim ->> 'lotes_hora')::int then
    return '{"estado": "limite", "motivo": "lotes_hora"}';
  end if;
  v_tam := least(v_tam, (lim ->> 'questoes_dia')::int - v_dia);
  if v_tam <= 0 then return '{"estado": "limite", "motivo": "questoes_dia"}'; end if;

  -- questões guardadas da missão que o aluno nunca respondeu e que não
  -- estão em outro lote dele ainda aberto. 0066: a banca preferida vem
  -- primeiro; dentro de cada grupo, ordem estável por aluno.
  select coalesce(array_agg(x.id order by x.preferida desc, x.chave), '{}') into v_ids from (
    select q.id, pg_catalog.md5(a.id::text || q.id::text) as chave,
           coalesce(pg_catalog.upper(q.banca) = pg_catalog.upper(f.banca_preferida), false) as preferida
      from app.quest_questao_missao qm
      join app.quest_questoes q on q.id = qm.questao_id
     where qm.missao_id = m.id and not q.anulada and not q.desatualizada
       and not exists (select 1 from app.quest_tentativas t where t.aluno_id = a.id and t.questao_id = q.id)
       and not exists (select 1 from app.quest_entregas en
                        where en.aluno_id = a.id and en.expira_em > now() and q.id = any (en.questoes))
     order by 3 desc, 2 limit v_tam) x;

  if coalesce(cardinality(v_ids), 0) < v_tam and not p_sem_busca and f.esgotada_em is null
     and (f.ultima_busca_em is null
          or f.ultima_busca_em < now() - pg_catalog.make_interval(mins => (lim ->> 'rebusca_minutos')::int)) then
    update app.quest_filtros_missao set ultima_busca_em = now() where missao_id = m.id;
    -- 0066: banca preferida até esgotar, depois a busca geral
    v_fase := case when f.banca_preferida is not null and f.preferida_esgotada_em is null
                   then 'preferida' else 'geral' end;
    return pg_catalog.jsonb_build_object(
      'estado', 'buscar', 'disponiveis', coalesce(cardinality(v_ids), 0),
      -- só o que falta para este lote: a Quest cobra por questão entregue
      'faltam', v_tam - coalesce(cardinality(v_ids), 0),
      'filtro', pg_catalog.jsonb_build_object(
        'materia', f.materia, 'assunto', f.assunto, 'assunto_id', f.assunto_id_fornecedor,
        'fase', v_fase,
        'banca', case when v_fase = 'preferida' then f.banca_preferida end,
        'cursor', case when v_fase = 'preferida' then f.cursor_preferida else f.cursor end));
  end if;

  if coalesce(cardinality(v_ids), 0) = 0 then return '{"estado": "sem_questoes"}'; end if;

  insert into app.quest_entregas (pedido_id, escola_id, aluno_id, missao_id, tipo_pratica, questoes, expira_em)
  values (p_pedido, a.escola_id, a.id, m.id, v_tipo, v_ids,
          now() + pg_catalog.make_interval(hours => (lim ->> 'validade_lote_horas')::int))
  returning * into e;
  return pg_catalog.jsonb_build_object('estado', 'ok', 'entrega', app.quest_entrega_json(e.id));
end $$;

-- ------------------------------------------------------------
-- 6) Privilégios
-- ------------------------------------------------------------
revoke all on function app.quest_guardar_itens(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text) from public, anon, authenticated;
revoke all on function public.quest_guardar_questoes(uuid, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text),
                          public.quest_guardar_questoes(uuid, jsonb, text, boolean),
                          public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean) to service_role;

-- ============================================================
-- ROLLBACK (manual):
--   drop function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text);
--   reaplicar da 0065 as seções 4 (quest_preparar_entrega) e 5
--     (quest_guardar_questoes de 4 argumentos) e o bloco de privilégios;
--   drop function app.quest_guardar_itens(uuid, jsonb);
--   (as três colunas podem ficar: sem as funções ninguém as lê.
--    Apagá-las é segunda fase:
--    alter table app.quest_filtros_missao drop column banca_preferida,
--      drop column cursor_preferida, drop column preferida_esgotada_em;)
-- ============================================================
-- >>> FIM 0066 <<<
insert into supabase_migrations.schema_migrations (version, name) values (to_char(now() at time zone 'utc','YYYYMMDDHH24MISS'), '0066_quest_banca_preferida');
commit;
