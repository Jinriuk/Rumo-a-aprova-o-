-- ============================================================
-- 0068 — questões integradas: resposta repetida que fechou a missão,
--        busca reivindicada uma vez só e "cheia" pela reposição inteira
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono. Depende da 0067.
-- ORIGEM: revisão do Codex no #192 (achado 2) e no #189 (dois achados).
--
--   1. quest_responder, retransmissão: a correção que fechou a missão,
--      reenviada porque a resposta HTTP se perdeu, devolvia só a correção,
--      sem missao_concluida. A tela seguia oferecendo "Continuar: mais N"
--      numa missão fechada. Agora devolve missao_concluida = true quando a
--      tentativa é do registro que fechou a missão.
--   2. quest_preparar_entrega: dois alunos na mesma missão (a trava
--      consultiva é por aluno) podiam ler ultima_busca_cheia = true antes
--      de qualquer um marcar a busca, e os dois recebiam 'buscar' com o
--      mesmo cursor: a mesma página paga duas vezes. Agora a busca é
--      reivindicada por UPDATE condicional, reavaliado depois da trava da
--      linha; quem perde segue com o estoque que houver.
--   3. "Cheia" descreve a reposição inteira, não cada página. A busca
--      guarda quanto falta (busca_faltam = 'faltam'); cada página guardada
--      desconta as novas; ultima_busca_cheia só fica true quando zerou.
--      Antes, a 1ª página cheia de questões repetidas marcava true e, se a
--      2ª chamada falhasse, o pedido seguinte furava a espera e chamava de
--      novo a Quest que acabou de falhar.
--
-- Aditiva (1 coluna; 4 funções reescritas com a mesma assinatura).
-- Idempotente. ROLLBACK no fim.
-- ============================================================

alter table app.quest_filtros_missao
  add column if not exists busca_faltam int;
comment on column app.quest_filtros_missao.busca_faltam is
  '0068: questões que a reposição em andamento ainda deve trazer. A busca grava o faltam; cada página guardada desconta as novas. ultima_busca_cheia só é true quando chega a zero.';

-- ------------------------------------------------------------
-- 1) Guardar (as duas versões)
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
         busca_faltam = greatest(coalesce(busca_faltam, 0) - (r ->> 'novas')::int, 0),
         ultima_busca_cheia = not coalesce(p_esgotada, false)
                              and coalesce(busca_faltam, 0) - (r ->> 'novas')::int <= 0,
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
           busca_faltam = greatest(coalesce(busca_faltam, 0) - (r ->> 'novas')::int, 0),
           ultima_busca_cheia = not coalesce(p_esgotada, false)
                                  and coalesce(busca_faltam, 0) - (r ->> 'novas')::int <= 0,
           atualizado_em = now()
     where missao_id = p_missao
    returning * into f;
  else
    update app.quest_filtros_missao
       set cursor = coalesce(p_cursor, cursor),
           esgotada_em = case when coalesce(p_esgotada, false) then now() else esgotada_em end,
           busca_faltam = greatest(coalesce(busca_faltam, 0) - (r ->> 'novas')::int, 0),
           ultima_busca_cheia = not coalesce(p_esgotada, false)
                                  and coalesce(busca_faltam, 0) - (r ->> 'novas')::int <= 0,
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
-- 2) Entregar: igual à 0067, com a busca reivindicada (0068)
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
  v_faltam  int;
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
    -- 0067: o que falta para o alvo (lote ou meta, até busca_max), não só
    -- para o lote. A Quest cobra por questão entregue.
    v_faltam := greatest(v_alvo - v_disp, v_tam - coalesce(cardinality(v_ids), 0));
    -- 0068: reivindica a busca. A condição é reavaliada pelo UPDATE depois
    -- da trava da linha: entre dois pedidos de alunos diferentes na mesma
    -- missão (a trava consultiva é por aluno), só um devolve 'buscar'; o
    -- outro segue com o estoque que houver, sem pagar a mesma página.
    -- busca_faltam conta o que a reposição inteira ainda deve trazer.
    update app.quest_filtros_missao fm
       set ultima_busca_em = now(), ultima_busca_cheia = null, busca_faltam = v_faltam
     where fm.missao_id = m.id and fm.esgotada_em is null
       and (fm.ultima_busca_em is null or fm.ultima_busca_cheia is true
            or fm.ultima_busca_em < now() - pg_catalog.make_interval(mins => (lim ->> 'rebusca_minutos')::int))
    returning * into f;
    if found then
      -- 0066: banca preferida até esgotar, depois a busca geral
      v_fase := case when f.banca_preferida is not null and f.preferida_esgotada_em is null
                     then 'preferida' else 'geral' end;
      return pg_catalog.jsonb_build_object(
        'estado', 'buscar', 'disponiveis', coalesce(cardinality(v_ids), 0),
        'faltam', v_faltam,
        'filtro', pg_catalog.jsonb_build_object(
          'materia', f.materia, 'assunto', f.assunto, 'assunto_id', f.assunto_id_fornecedor,
          'fase', v_fase,
          'banca', case when v_fase = 'preferida' then f.banca_preferida end,
          'cursor', case when v_fase = 'preferida' then f.cursor_preferida else f.cursor end));
    end if;
  end if;

  if coalesce(cardinality(v_ids), 0) = 0 then return '{"estado": "sem_questoes"}'; end if;

  insert into app.quest_entregas (pedido_id, escola_id, aluno_id, missao_id, tipo_pratica, questoes, expira_em)
  values (p_pedido, a.escola_id, a.id, m.id, v_tipo, v_ids,
          now() + pg_catalog.make_interval(hours => (lim ->> 'validade_lote_horas')::int))
  returning * into e;
  return pg_catalog.jsonb_build_object('estado', 'ok', 'entrega', app.quest_entrega_json(e.id));
end $$;

-- ------------------------------------------------------------
-- 3) Responder: igual à 0065, com missao_concluida na repetição (0068)
-- ------------------------------------------------------------
create or replace function public.quest_responder(
  p_usuario uuid, p_escola uuid, p_entrega uuid, p_questao uuid, p_resposta text, p_duracao_ms int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a         public.alunos;
  e         app.quest_entregas;
  q         app.quest_questoes;
  t         app.quest_tentativas;
  m         public.missoes;
  v_resp    text := upper(btrim(coalesce(p_resposta, '')));
  v_dur     int := case when p_duracao_ms between 0 and 3600000 then p_duracao_ms end;
  v_reg     uuid;
  v_fechou  boolean := false;
  v_lote    jsonb;
begin
  select * into a from public.alunos where usuario_id = p_usuario and escola_id = p_escola limit 1;
  if not found then return '{"estado": "sem_aluno"}'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quest:' || a.id::text, 0));

  select * into e from app.quest_entregas where id = p_entrega and aluno_id = a.id;
  if not found or p_questao is null or not (p_questao = any (e.questoes)) then
    return '{"estado": "nao_encontrada"}';
  end if;
  select * into q from app.quest_questoes where id = p_questao;

  -- retransmissão: a primeira correção vale, qualquer que seja a resposta nova
  select * into t from app.quest_tentativas where aluno_id = a.id and questao_id = p_questao;
  if found then
    -- 0068: se a resposta HTTP da correção que fechou a missão se perdeu, a
    -- repetição também diz missao_concluida: a tela não oferece mais
    -- "Continuar: mais N" numa missão já fechada (achado 2 do #192). Vale
    -- para a tentativa do registro que fechou a missão (o lote solta o
    -- registro ao fechar, então só as respostas até o fechamento estão nele).
    v_fechou := t.registro_id is not null
      and exists (select 1 from app.missao_registros mr
                    join public.aluno_missoes am on am.id = mr.aluno_missao_id
                   where mr.registro_id = t.registro_id and am.estado = 'concluida');
    return pg_catalog.jsonb_build_object('estado', 'ok', 'repetida', true, 'resposta', t.resposta,
      'acerto', t.acerto, 'gabarito', q.gabarito, 'missao_concluida', v_fechou);
  end if;

  if e.expira_em <= now() then return '{"estado": "expirada"}'; end if;
  if q.anulada then return '{"estado": "anulada"}'; end if;
  if v_resp !~ '^[A-J]$' or not exists (
       select 1 from pg_catalog.jsonb_array_elements(q.alternativas) x where x ->> 'letra' = v_resp) then
    return '{"estado": "resposta_invalida"}';
  end if;

  insert into app.quest_tentativas
    (entrega_id, escola_id, aluno_id, questao_id, missao_id, resposta, acerto, gabarito_versao, duracao_ms)
  values (e.id, a.escola_id, a.id, q.id, e.missao_id, v_resp, v_resp = q.gabarito, q.gabarito_versao, v_dur)
  returning * into t;

  -- Projeção: um registro de estudo por lote, pelo caminho da 0064.
  select * into m from public.missoes where id = e.missao_id;
  v_reg := e.registro_id;
  if v_reg is not null and not exists (select 1 from public.registros_estudo where id = v_reg) then
    v_reg := null;
  end if;

  if v_reg is null then
    begin
      insert into public.registros_estudo
        (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos, tipo_pratica, missao_id)
      values (a.escola_id, a.id, app.hoje_local(), m.materia_codigo, 'Questões integradas', 1, t.acerto::int,
              round(coalesce(v_dur, 0) / 60000.0)::int, e.tipo_pratica, m.id)
      returning id into v_reg;
    exception when sqlstate '22023' then
      -- a 0064 recusou (a missão saiu da fila ou foi desativada na escola
      -- depois do lote): a prática soma volume no assunto da missão e não
      -- conclui nada. A tentativa já está gravada.
      insert into public.registros_estudo
        (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos, tipo_pratica, assunto_id)
      values (a.escola_id, a.id, app.hoje_local(), m.materia_codigo, 'Questões integradas', 1, t.acerto::int,
              round(coalesce(v_dur, 0) / 60000.0)::int, 'livre', m.assunto_id)
      returning id into v_reg;
    end;
    update app.quest_entregas set registro_id = v_reg where id = e.id;
    update app.quest_tentativas set registro_id = v_reg where id = t.id;
  else
    update app.quest_tentativas set registro_id = v_reg where id = t.id;
    update public.registros_estudo r
       set questoes = r.questoes + 1,
           acertos  = coalesce(r.acertos, 0) + t.acerto::int,
           minutos  = (select round(coalesce(sum(x.duracao_ms), 0) / 60000.0)::int
                         from app.quest_tentativas x where x.registro_id = v_reg)
     where r.id = v_reg;
  end if;

  -- A missão fechou com este registro: o lote solta o registro e segue
  -- como revisão. Sem isso, a próxima resposta errada entraria no mesmo
  -- registro e o motor (que avalia o registro inteiro) reabriria a missão.
  if e.tipo_pratica = 'missao' and exists (
       select 1 from app.missao_registros mr
         join public.aluno_missoes am on am.id = mr.aluno_missao_id
        where mr.registro_id = v_reg and am.estado = 'concluida') then
    update app.quest_entregas set registro_id = null, tipo_pratica = 'revisao' where id = e.id;
    v_fechou := true;
  end if;

  select pg_catalog.jsonb_build_object(
           'total', cardinality(e.questoes),
           'respondidas', count(*),
           'acertos', count(*) filter (where x.acerto))
    into v_lote
    from app.quest_tentativas x
   where x.aluno_id = a.id and x.questao_id = any (e.questoes);

  return pg_catalog.jsonb_build_object('estado', 'ok', 'repetida', false, 'resposta', t.resposta,
    'acerto', t.acerto, 'gabarito', q.gabarito, 'missao_concluida', v_fechou, 'lote', v_lote);
end $$;

-- ------------------------------------------------------------
-- 4) Privilégios (create or replace mantém; repetidos por segurança)
-- ------------------------------------------------------------
revoke all on function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text) from public, anon, authenticated;
revoke all on function public.quest_guardar_questoes(uuid, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean) from public, anon, authenticated;
revoke all on function public.quest_responder(uuid, uuid, uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.quest_guardar_questoes(uuid, jsonb, text, boolean, text),
                          public.quest_guardar_questoes(uuid, jsonb, text, boolean),
                          public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean),
                          public.quest_responder(uuid, uuid, uuid, uuid, text, int) to service_role;

-- ============================================================
-- ROLLBACK (manual):
--   reaplicar da 0067 as seções 3, 4 e 5 (as duas quest_guardar_questoes,
--   quest_preparar_entrega e privilégios) e da 0065 a quest_responder.
--   (a coluna busca_faltam pode ficar: sem as funções ninguém a lê.
--    Apagá-la é segunda fase:
--    alter table app.quest_filtros_missao drop column busca_faltam;)
-- ============================================================
