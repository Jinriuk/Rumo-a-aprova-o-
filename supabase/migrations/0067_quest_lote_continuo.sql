-- ============================================================
-- 0067 — questões integradas: lote seguido sem espera, busca à frente
--        e limite por questões na hora
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono. Depende da 0066.
-- ORIGEM: defeito em produção, 17/10/2026. Lote 1 às 22:34:40 (busca na
--   Quest, 5 FGV); o aluno respondeu em ~45 s e pediu "Mais questões" às
--   ~22:35. Recebeu "Não há questão nova... registre manualmente": a
--   busca anterior era de menos de 2 minutos (rebusca_minutos) e a 0065
--   bloqueava qualquer busca nesse intervalo. Às 22:40 funcionou. Missão
--   "Organização administrativa", meta 20.
--
-- A REGRA
--   1. Espera só depois de busca ruim. app.quest_filtros_missao ganha
--      ultima_busca_cheia: null quando a busca sai (em andamento ou falhou:
--      a Edge Function não chega a guardar), e o resultado de
--      quest_guardar_questoes depois (true = a Quest devolveu tudo o que
--      foi pedido). rebusca_minutos só segura a próxima busca quando a
--      última não foi cheia: veio curta, vazia, falhou ou ainda está em
--      andamento (duas abas do mesmo aluno, ou dois alunos na mesma
--      missão, não pagam a mesma página duas vezes).
--   2. Busca à frente. Sem estoque que feche o lote, a busca pede
--      min(meta da missão − questões que o aluno já fez nela, busca_max),
--      nunca menos que o lote. O lote sai do tamanho pedido; o resto fica
--      guardado e serve a todos os alunos da missão sem nova chamada.
--      "Já fez" é aluno_missoes.questoes_acumuladas (o que conta para a
--      meta, manual ou integrado). Revisão (meta batida): só o lote.
--   3. Limite por aluno: 60 questões por hora (no lugar de 6 lotes por
--      hora) e 120 por dia, como antes. O lote é cortado para caber.
--
-- CUSTO
--   A primeira busca de cada missão pede até 20 questões (120 créditos com
--   gabarito), no lugar de 5. Não é gasto a mais: é o estoque que o aluno
--   ia pedir nos próximos lotes da mesma missão, e serve aos outros
--   alunos. Teto por pedido continua 2 chamadas (FGV e geral): 40
--   questões, 240 créditos.
--
-- Aditiva (1 coluna; 3 funções reescritas com a mesma assinatura;
-- quest_limites com outra chave). Idempotente. ROLLBACK no fim.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Coluna
-- ------------------------------------------------------------
alter table app.quest_filtros_missao
  add column if not exists ultima_busca_cheia boolean;
comment on column app.quest_filtros_missao.ultima_busca_cheia is
  '0067: a última busca na Quest devolveu tudo o que pediu. null = em andamento ou falhou. Só busca não cheia segura a próxima por rebusca_minutos.';

-- ------------------------------------------------------------
-- 2) Limites
-- ------------------------------------------------------------
create or replace function app.quest_limites() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"lote_padrao": 10, "lote_max": 20, "questoes_dia": 120, "questoes_hora": 60,
           "busca_max": 20, "validade_lote_horas": 6, "rebusca_minutos": 2}'::jsonb
$$;

-- ------------------------------------------------------------
-- 3) Guardar (as duas versões): grava se a busca veio cheia
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
         ultima_busca_cheia = not coalesce(p_esgotada, false),
         atualizado_em = now()
   where missao_id = p_missao;
  return (r ->> 'guardadas')::int;
end $$;

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
           ultima_busca_cheia = not coalesce(p_esgotada, false),
           atualizado_em = now()
     where missao_id = p_missao
    returning * into f;
  else
    update app.quest_filtros_missao
       set cursor = coalesce(p_cursor, cursor),
           esgotada_em = case when coalesce(p_esgotada, false) then now() else esgotada_em end,
           ultima_busca_cheia = not coalesce(p_esgotada, false),
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
-- 4) Entregar: igual à 0066, com os três pontos marcados com 0067
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
  v_disp    int;
  v_meta    int;
  v_feitas  int;
  v_alvo    int;
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

  -- limite por aluno: questões entregues hoje (data local) e na última hora
  -- (a janela de uma hora não depende do dia: não zera à meia-noite).
  -- 0067: por hora conta questões, não lotes (lote de 5, 10 ou 20).
  select coalesce(sum(cardinality(en.questoes))
                    filter (where (en.criada_em at time zone 'America/Sao_Paulo')::date = app.hoje_local()), 0),
         coalesce(sum(cardinality(en.questoes)) filter (where en.criada_em > now() - interval '1 hour'), 0)
    into v_dia, v_hora
    from app.quest_entregas en
   where en.aluno_id = a.id
     and en.criada_em > now() - interval '2 days';
  if v_dia >= (lim ->> 'questoes_dia')::int then
    return '{"estado": "limite", "motivo": "questoes_dia"}';
  end if;
  if v_hora >= (lim ->> 'questoes_hora')::int then
    return '{"estado": "limite", "motivo": "questoes_hora"}';
  end if;
  v_tam := least(v_tam, (lim ->> 'questoes_dia')::int - v_dia, (lim ->> 'questoes_hora')::int - v_hora);

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

  -- 0067: a espera de rebusca_minutos só vale depois de busca curta, vazia,
  -- em andamento ou que falhou (ultima_busca_cheia não true). Busca que
  -- veio cheia não segura o próximo lote.
  if coalesce(cardinality(v_ids), 0) < v_tam and not p_sem_busca and f.esgotada_em is null
     and (f.ultima_busca_em is null or f.ultima_busca_cheia is true
          or f.ultima_busca_em < now() - pg_catalog.make_interval(mins => (lim ->> 'rebusca_minutos')::int)) then
    update app.quest_filtros_missao set ultima_busca_em = now(), ultima_busca_cheia = null where missao_id = m.id;
    -- 0067: busca à frente. Pede o que falta para a meta da missão (o que o
    -- aluno ainda não resolveu nela), até busca_max, e nunca menos que o
    -- lote. O lote sai do tamanho pedido; o resto fica no estoque, que serve
    -- a todos os alunos sem nova chamada.
    select count(*) into v_disp
      from app.quest_questao_missao qm
      join app.quest_questoes q on q.id = qm.questao_id
     where qm.missao_id = m.id and not q.anulada and not q.desatualizada
       and not exists (select 1 from app.quest_tentativas t where t.aluno_id = a.id and t.questao_id = q.id)
       and not exists (select 1 from app.quest_entregas en
                        where en.aluno_id = a.id and en.expira_em > now() and q.id = any (en.questoes));
    select coalesce(me.qtd_questoes, m.meta_questoes) into v_meta
      from (select 1) x left join public.missoes_escola me on me.missao_id = m.id and me.escola_id = a.escola_id;
    select coalesce(max(am.questoes_acumuladas), 0) into v_feitas
      from public.aluno_missoes am where am.aluno_id = a.id and am.missao_id = m.id;
    v_alvo := greatest(v_tam, least(coalesce(v_meta, 0) - v_feitas, (lim ->> 'busca_max')::int));
    -- 0066: banca preferida até esgotar, depois a busca geral
    v_fase := case when f.banca_preferida is not null and f.preferida_esgotada_em is null
                   then 'preferida' else 'geral' end;
    return pg_catalog.jsonb_build_object(
      'estado', 'buscar', 'disponiveis', coalesce(cardinality(v_ids), 0),
      -- 0067: o que falta para o alvo (lote ou meta, até busca_max), não só
      -- para o lote. A Quest cobra por questão entregue.
      'faltam', greatest(v_alvo - v_disp, v_tam - coalesce(cardinality(v_ids), 0)),
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
-- 5) Privilégios (create or replace mantém; repetidos por segurança)
-- ------------------------------------------------------------
revoke all on function app.quest_limites() from public, anon, authenticated;
revoke all on function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text) from public, anon, authenticated;
revoke all on function public.quest_guardar_questoes(uuid, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text),
                          public.quest_guardar_questoes(uuid, jsonb, text, boolean),
                          public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean) to service_role;

-- ============================================================
-- ROLLBACK (manual):
--   reaplicar da 0066 as seções 3, 4 e 5 (as duas quest_guardar_questoes e
--   quest_preparar_entrega) e o bloco de privilégios; reaplicar da 0065 a
--   seção 2 (app.quest_limites, com lotes_hora).
--   (a coluna ultima_busca_cheia pode ficar: sem as funções ninguém a lê.
--    Apagá-la é segunda fase:
--    alter table app.quest_filtros_missao drop column ultima_busca_cheia;)
-- ============================================================
