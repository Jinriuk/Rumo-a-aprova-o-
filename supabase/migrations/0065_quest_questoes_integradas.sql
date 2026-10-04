-- ============================================================
-- 0065 — questões integradas (Quest API): guardar, entregar sem
--        gabarito, corrigir no servidor, gravar a tentativa uma vez só
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono. Depende da 0061 (motor sequencial) e da
-- 0064 (registro com missão e assunto).
-- ORIGEM: P1.1 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_
--   Auditoria_do_Banco.md, seção 9 (9.1 campos, 9.2 fluxo, 9.3 gate).
--   A Quest autorizou guardar questão e gabarito na nossa base.
--
-- QUEM ESCREVE
--   Só a Edge Function `questoes-integradas`, com a chave de serviço,
--   pelas funções public.quest_* abaixo (EXECUTE só para service_role).
--   As tabelas ficam no schema `app`, que o PostgREST não expõe, e sem
--   GRANT para anon/authenticated: o navegador não lê gabarito, nem
--   tentativa, nem lote de ninguém (nem o próprio) pela API de dados.
--   A chave da Quest (secret QUEST_API_KEY) vive só na função; o banco
--   nunca a vê.
--
-- O FLUXO (seção 9.2)
--   1. quest_preparar_entrega: confere aluno, escola, concurso e missão;
--      decide se a prática é 'missao' (a da vez na fila da matéria) ou
--      'revisao' (missão já iniciada); aplica o limite por aluno; monta
--      o lote com questões guardadas que o aluno ainda não respondeu.
--      Faltou questão: devolve estado 'buscar' com o filtro da missão, a
--      função busca na Quest, guarda (quest_guardar_questoes) e pede de
--      novo com p_sem_busca. O lote volta SEM gabarito.
--   2. quest_responder: corrige no servidor e grava a tentativa. Chave
--      única (aluno, questão): retransmitir a mesma resposta (ou outra)
--      devolve a primeira correção, sem segunda tentativa, sem segundo
--      registro e sem XP duplicado.
--   3. Projeção: as tentativas de um lote viram UM registro de estudo
--      (questoes/acertos somados), tipo_pratica 'missao' ou 'revisao' com
--      missao_id. Daí em diante é o caminho da 0064: o gatilho confere a
--      missão e o motor da 0061 decide se conta. Quando a missão fecha,
--      o lote solta o registro e passa a 'revisao': a resposta seguinte
--      não reabre a missão (o motor avalia o registro inteiro).
--   4. O aluno não edita nem apaga, pelo navegador, o registro que veio
--      de questões corrigidas no servidor (gatilho de guarda).
--   5. Sem Quest (fora do ar, limite, sem filtro, sem questão): nada aqui
--      bloqueia o registro manual, que segue pelo caminho de sempre.
--
-- O BOTÃO
--   Só aparece para missão com filtro em app.quest_filtros_missao e
--   ativo = true (default false). Ligar é UPDATE do operador depois de
--   medir a cobertura (scripts/quest-cobertura.mjs). Esta migration não
--   liga nada e não traz filtro nenhum.
--
-- FORA DE ESCOPO (documentado, não resolvido aqui)
--   - Conciliação de sessão manual × Quest: o aluno que registrar à mão
--     as mesmas questões conta duas vezes. A tela avisa; o banco não
--     tem como saber.
--   - Regravar tentativas antigas quando a Quest muda o gabarito: a
--     tentativa guarda a gabarito_versao com que foi corrigida.
--
-- Aditiva (tabelas novas; app.lgpd_exportar ganha uma chave).
-- Idempotente. ROLLBACK no fim.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabelas
-- ------------------------------------------------------------

-- Filtro da missão na Quest. Conteúdo do operador, como o catálogo.
create table if not exists app.quest_filtros_missao (
  missao_id             uuid primary key references public.missoes (id) on delete cascade,
  materia               text not null check (length(materia) between 1 and 200),
  assunto               text check (assunto is null or length(assunto) between 1 and 300),
  assunto_id_fornecedor text check (assunto_id_fornecedor is null or length(assunto_id_fornecedor) between 1 and 100),
  ativo                 boolean not null default false,
  observacao            text,
  proxima_pagina        int not null default 1 check (proxima_pagina >= 1),
  esgotada_em           timestamptz,
  ultima_busca_em       timestamptz,
  atualizado_em         timestamptz not null default now()
);
comment on table app.quest_filtros_missao is
  '0065: filtro da missão na Quest API. ativo=false (default) esconde o botão; ligar só depois de medir a cobertura.';

create table if not exists app.quest_questoes (
  id                 uuid primary key default gen_random_uuid(),
  fornecedor         text not null default 'quest' check (fornecedor = 'quest'),
  id_externo         text not null check (length(id_externo) between 1 and 100),
  banca              text,
  orgao              text,
  cargo              text,
  ano                int check (ano is null or ano between 1950 and 2100),
  materia_fornecedor text,
  assunto_fornecedor text,
  tipo               text not null check (tipo in ('multipla_escolha', 'certo_errado')),
  enunciado          text not null check (length(enunciado) between 1 and 20000),
  alternativas       jsonb not null check (jsonb_typeof(alternativas) = 'array'),
  gabarito           text not null check (gabarito ~ '^[A-J]$'),
  gabarito_versao    int not null default 1,
  anulada            boolean not null default false,
  desatualizada      boolean not null default false,
  obtida_em          timestamptz not null default now(),
  atualizada_em      timestamptz not null default now(),
  unique (fornecedor, id_externo)
);
comment on table app.quest_questoes is
  '0065: questão e gabarito guardados (autorização da Quest). Só a Edge Function lê; o gabarito sai só depois da resposta.';

-- De qual missão a questão veio (uma questão pode servir a mais de uma).
create table if not exists app.quest_questao_missao (
  missao_id  uuid not null references public.missoes (id) on delete cascade,
  questao_id uuid not null references app.quest_questoes (id) on delete cascade,
  primary key (missao_id, questao_id)
);

create table if not exists app.quest_entregas (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null,
  escola_id    uuid not null,
  aluno_id     uuid not null,
  missao_id    uuid not null references public.missoes (id) on delete cascade,
  tipo_pratica text not null check (tipo_pratica in ('missao', 'revisao')),
  questoes     uuid[] not null check (cardinality(questoes) between 1 and 50),
  registro_id  uuid references public.registros_estudo (id) on delete set null,
  criada_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  unique (aluno_id, pedido_id),
  foreign key (aluno_id, escola_id) references public.alunos (id, escola_id) on delete cascade
);
create index if not exists idx_quest_entregas_aluno on app.quest_entregas (aluno_id, criada_em desc);
create index if not exists idx_quest_entregas_registro on app.quest_entregas (registro_id) where registro_id is not null;
comment on table app.quest_entregas is
  '0065: lote entregue ao aluno. pedido_id torna o pedido idempotente; registro_id é a projeção em registros_estudo.';

create table if not exists app.quest_tentativas (
  id              uuid primary key default gen_random_uuid(),
  entrega_id      uuid not null references app.quest_entregas (id) on delete cascade,
  escola_id       uuid not null,
  aluno_id        uuid not null,
  questao_id      uuid not null references app.quest_questoes (id),
  missao_id       uuid references public.missoes (id) on delete set null,
  resposta        text not null check (resposta ~ '^[A-J]$'),
  acerto          boolean not null,
  gabarito_versao int not null,
  duracao_ms      int check (duracao_ms is null or duracao_ms between 0 and 3600000),
  registro_id     uuid references public.registros_estudo (id) on delete set null,
  respondida_em   timestamptz not null default now(),
  unique (aluno_id, questao_id),
  foreign key (aluno_id, escola_id) references public.alunos (id, escola_id) on delete cascade
);
create index if not exists idx_quest_tentativas_entrega on app.quest_tentativas (entrega_id);
create index if not exists idx_quest_tentativas_registro on app.quest_tentativas (registro_id) where registro_id is not null;
comment on table app.quest_tentativas is
  '0065: uma tentativa por aluno e questão, corrigida no servidor. Repetição devolve a primeira.';

-- Nada disto é da API de dados. RLS ligada e sem policy: nega por padrão
-- mesmo se um GRANT aparecer um dia.
do $$
declare t text;
begin
  foreach t in array array['quest_filtros_missao', 'quest_questoes', 'quest_questao_missao',
                           'quest_entregas', 'quest_tentativas'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('revoke all on app.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on app.%I to service_role', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2) Limites (um lugar só; a função e os testes leem daqui)
-- ------------------------------------------------------------
create or replace function app.quest_limites() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"lote_padrao": 10, "lote_max": 20, "questoes_dia": 120, "lotes_hora": 6,
           "validade_lote_horas": 6, "rebusca_minutos": 2}'::jsonb
$$;

-- ------------------------------------------------------------
-- 3) Auxiliares
-- ------------------------------------------------------------

-- A missão da vez na fila da matéria: a em andamento; sem ela, a
-- primeira da fila que o aluno ainda não começou. Mesma regra que o
-- painel usa para mostrar "Praticar esta missão".
create or replace function app.quest_missao_da_vez(p_aluno uuid, p_materia text) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select am.missao_id from public.aluno_missoes am
      where am.aluno_id = p_aluno and am.materia_codigo = p_materia
        and am.estado = 'em_andamento' and am.regra = 'sequencial'
      order by am.iniciada_em limit 1),
    (select q.missao_id from app.missoes_fila(p_aluno, p_materia) q
      where not exists (select 1 from public.aluno_missoes am
                         where am.aluno_id = p_aluno and am.missao_id = q.missao_id)
      order by q.posicao limit 1))
$$;

-- O lote como o aluno vê: sem gabarito da questão ainda não respondida.
create or replace function app.quest_entrega_json(p_entrega uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', e.id, 'missao_id', e.missao_id, 'tipo_pratica', e.tipo_pratica, 'expira_em', e.expira_em,
    'questoes', coalesce((
      select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'id', q.id, 'banca', q.banca, 'orgao', q.orgao, 'cargo', q.cargo, 'ano', q.ano,
                 'tipo', q.tipo, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
                 'respondida', t.id is not null)
               || case when t.id is null then '{}'::jsonb
                       else pg_catalog.jsonb_build_object('resposta', t.resposta, 'acerto', t.acerto,
                                                          'gabarito', q.gabarito) end
               order by x.pos)
        from unnest(e.questoes) with ordinality as x(questao_id, pos)
        join app.quest_questoes q on q.id = x.questao_id
        left join app.quest_tentativas t on t.aluno_id = e.aluno_id and t.questao_id = q.id), '[]'::jsonb))
  from app.quest_entregas e where e.id = p_entrega
$$;

-- ------------------------------------------------------------
-- 4) Entregar
-- ------------------------------------------------------------
-- p_usuario/p_escola vêm do token conferido pela função (auth.getUser),
-- nunca do corpo do pedido.
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
  select coalesce(sum(cardinality(en.questoes)), 0),
         count(*) filter (where en.criada_em > now() - interval '1 hour')
    into v_dia, v_hora
    from app.quest_entregas en
   where en.aluno_id = a.id
     and (en.criada_em at time zone 'America/Sao_Paulo')::date = app.hoje_local();
  if v_hora >= (lim ->> 'lotes_hora')::int then
    return '{"estado": "limite", "motivo": "lotes_hora"}';
  end if;
  v_tam := least(v_tam, (lim ->> 'questoes_dia')::int - v_dia);
  if v_tam <= 0 then return '{"estado": "limite", "motivo": "questoes_dia"}'; end if;

  -- questões guardadas da missão que o aluno nunca respondeu e que não
  -- estão em outro lote dele ainda aberto. Ordem estável por aluno.
  select coalesce(array_agg(x.id order by x.chave), '{}') into v_ids from (
    select q.id, pg_catalog.md5(a.id::text || q.id::text) as chave
      from app.quest_questao_missao qm
      join app.quest_questoes q on q.id = qm.questao_id
     where qm.missao_id = m.id and not q.anulada and not q.desatualizada
       and not exists (select 1 from app.quest_tentativas t where t.aluno_id = a.id and t.questao_id = q.id)
       and not exists (select 1 from app.quest_entregas en
                        where en.aluno_id = a.id and en.expira_em > now() and q.id = any (en.questoes))
     order by 2 limit v_tam) x;

  if coalesce(cardinality(v_ids), 0) < v_tam and not p_sem_busca and f.esgotada_em is null
     and (f.ultima_busca_em is null
          or f.ultima_busca_em < now() - pg_catalog.make_interval(mins => (lim ->> 'rebusca_minutos')::int)) then
    update app.quest_filtros_missao set ultima_busca_em = now() where missao_id = m.id;
    return pg_catalog.jsonb_build_object(
      'estado', 'buscar', 'disponiveis', coalesce(cardinality(v_ids), 0),
      'filtro', pg_catalog.jsonb_build_object(
        'materia', f.materia, 'assunto', f.assunto, 'assunto_id', f.assunto_id_fornecedor,
        'pagina', f.proxima_pagina));
  end if;

  if coalesce(cardinality(v_ids), 0) = 0 then return '{"estado": "sem_questoes"}'; end if;

  insert into app.quest_entregas (pedido_id, escola_id, aluno_id, missao_id, tipo_pratica, questoes, expira_em)
  values (p_pedido, a.escola_id, a.id, m.id, v_tipo, v_ids,
          now() + pg_catalog.make_interval(hours => (lim ->> 'validade_lote_horas')::int))
  returning * into e;
  return pg_catalog.jsonb_build_object('estado', 'ok', 'entrega', app.quest_entrega_json(e.id));
end $$;

-- ------------------------------------------------------------
-- 5) Guardar o que veio da Quest
-- ------------------------------------------------------------
-- p_itens já normalizados pela função (_shared/quest.ts):
--   [{id_externo, banca, orgao, cargo, ano, materia, assunto, tipo,
--     enunciado, alternativas: [{letra, texto}], gabarito, anulada, desatualizada}]
-- Gabarito que muda na Quest sobe a versão; tentativa antiga mantém a dela.
create or replace function public.quest_guardar_questoes(
  p_missao uuid, p_itens jsonb, p_proxima_pagina int default null, p_esgotada boolean default false
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  it   jsonb;
  v_id uuid;
  n    int := 0;
begin
  if not exists (select 1 from app.quest_filtros_missao where missao_id = p_missao) then
    raise exception 'quest: missão sem filtro' using errcode = '22023';
  end if;
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
    n := n + 1;
  end loop;

  update app.quest_filtros_missao
     set proxima_pagina = coalesce(p_proxima_pagina, proxima_pagina),
         esgotada_em = case when p_esgotada then now() else esgotada_em end,
         atualizado_em = now()
   where missao_id = p_missao;
  return n;
end $$;

-- ------------------------------------------------------------
-- 6) Responder: corrige, grava uma vez, projeta no registro
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
    return pg_catalog.jsonb_build_object('estado', 'ok', 'repetida', true, 'resposta', t.resposta,
      'acerto', t.acerto, 'gabarito', q.gabarito);
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
-- 7) Guarda: registro corrigido no servidor não se edita pelo app
-- ------------------------------------------------------------
-- A RLS deixa o aluno editar e apagar os próprios registros (0002). Para
-- os que vieram de questões integradas, isso desfaria a correção no
-- servidor (bastaria trocar acertos). Só a escrita de CLIENTE direta é
-- barrada; o servidor (motor, LGPD, restauração) e a cascata da exclusão
-- do aluno (pg_trigger_depth > 1) passam.
create or replace function app.quest_registro_guarda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cliente boolean := coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') <> ''
                       and coalesce((pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')
                           in ('authenticated', 'anon');
begin
  if v_cliente and pg_catalog.pg_trigger_depth() = 1
     and exists (select 1 from app.quest_tentativas t where t.registro_id = old.id) then
    raise exception 'registro de estudo: questões corrigidas no servidor não podem ser editadas nem apagadas'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_quest_registro_guarda on registros_estudo;
create trigger trg_quest_registro_guarda
  before update or delete on registros_estudo
  for each row execute function app.quest_registro_guarda();

-- ------------------------------------------------------------
-- 8) Para o front: em quais missões o botão aparece
-- ------------------------------------------------------------
-- Só ids de missão do concurso do próprio aluno com filtro ativo.
-- Nada de questão, gabarito ou filtro sai daqui.
create or replace function public.quest_missoes_disponiveis() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select f.missao_id
    from app.quest_filtros_missao f
    join public.missoes m on m.id = f.missao_id
    join public.concursos c on c.codigo = m.exam_tag
    join public.alunos a on a.concurso_id = c.id
   where f.ativo
     and a.id = app.meu_aluno_id()
     and app.tenant_operacional()
     and not exists (select 1 from public.missoes_escola me
                      where me.missao_id = m.id and me.escola_id = a.escola_id and me.ativa = false)
$$;

-- ------------------------------------------------------------
-- 9) LGPD: o dossiê do aluno leva as tentativas
-- ------------------------------------------------------------
-- Igual à 0055, mais 'questoes_integradas'. Sem enunciado: é conteúdo do
-- fornecedor, não dado do aluno; vai a identificação da questão.
create or replace function app.lgpd_exportar(p_aluno uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'gerado_em', now(),
    'aluno', to_jsonb(a) - 'usuario_id',
    'turmas', coalesce((select jsonb_agg(t.nome) from alunos_turmas at_
                        join turmas t on t.id = at_.turma_id
                        where at_.aluno_id = a.id and at_.escola_id = a.escola_id and t.escola_id = a.escola_id), '[]'::jsonb),
    'metas', coalesce((select jsonb_agg(to_jsonb(m) order by m.semana_numero) from metas m
                       where m.aluno_id = a.id and m.escola_id = a.escola_id), '[]'::jsonb),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object(
                        'meta_id', ma.meta_id, 'atividade', am.texto, 'estado', ma.estado))
                        from meta_atividades ma
                        join metas m on m.id = ma.meta_id
                        join atividades_modelo am on am.id = ma.atividade_modelo_id
                        where m.aluno_id = a.id and m.escola_id = a.escola_id and ma.escola_id = a.escola_id), '[]'::jsonb),
    'registros_estudo', coalesce((select jsonb_agg(to_jsonb(r) order by r.data) from registros_estudo r
                                  where r.aluno_id = a.id and r.escola_id = a.escola_id), '[]'::jsonb),
    'simulados', coalesce((select jsonb_agg(to_jsonb(s) order by s.data) from simulados s
                           where s.aluno_id = a.id and s.escola_id = a.escola_id), '[]'::jsonb),
    'consentimentos', coalesce((select jsonb_agg(to_jsonb(c)) from consentimentos c
                                where c.aluno_id = a.id and c.escola_id = a.escola_id), '[]'::jsonb),
    -- logs_acesso não tem FK (sobrevive à exclusão): o filtro por escola é a única barreira
    'logs_acesso', coalesce((select jsonb_agg(to_jsonb(l) order by l.em) from logs_acesso l
                             where l.aluno_id = a.id and l.escola_id = a.escola_id), '[]'::jsonb),
    -- 0065
    'questoes_integradas', coalesce((select jsonb_agg(jsonb_build_object(
                             'fornecedor', q.fornecedor, 'questao', q.id_externo, 'banca', q.banca, 'ano', q.ano,
                             'missao_id', t.missao_id, 'resposta', t.resposta, 'acerto', t.acerto,
                             'duracao_ms', t.duracao_ms, 'respondida_em', t.respondida_em)
                             order by t.respondida_em)
                             from app.quest_tentativas t join app.quest_questoes q on q.id = t.questao_id
                             where t.aluno_id = a.id and t.escola_id = a.escola_id), '[]'::jsonb)
  ) into v
  from alunos a where a.id = p_aluno;

  if v is null then raise exception 'aluno % não existe', p_aluno; end if;
  return v;
end $$;

-- ------------------------------------------------------------
-- 10) Privilégios
-- ------------------------------------------------------------
revoke all on function app.quest_limites() from public, anon, authenticated;
revoke all on function app.quest_missao_da_vez(uuid, text) from public, anon, authenticated;
revoke all on function app.quest_entrega_json(uuid) from public, anon, authenticated;
revoke all on function app.quest_registro_guarda() from public, anon, authenticated;
revoke all on function public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean) from public, anon, authenticated;
revoke all on function public.quest_guardar_questoes(uuid, jsonb, int, boolean) from public, anon, authenticated;
revoke all on function public.quest_responder(uuid, uuid, uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.quest_missoes_disponiveis() from public, anon;
grant execute on function public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean),
                          public.quest_guardar_questoes(uuid, jsonb, int, boolean),
                          public.quest_responder(uuid, uuid, uuid, uuid, text, int) to service_role;
grant execute on function public.quest_missoes_disponiveis() to authenticated, service_role;
-- internas (classe d do C-S06): só outra SECURITY DEFINER ou o operador
grant execute on function app.quest_missao_da_vez(uuid, text), app.quest_entrega_json(uuid) to service_role;

-- ============================================================
-- ROLLBACK (manual):
--   drop trigger trg_quest_registro_guarda on registros_estudo;
--   drop function public.quest_preparar_entrega(uuid, uuid, uuid, uuid, int, boolean),
--     public.quest_guardar_questoes(uuid, jsonb, int, boolean),
--     public.quest_responder(uuid, uuid, uuid, uuid, text, int),
--     public.quest_missoes_disponiveis(), app.quest_registro_guarda(),
--     app.quest_entrega_json(uuid), app.quest_missao_da_vez(uuid, text), app.quest_limites();
--   reaplicar app.lgpd_exportar da 0055;
--   (as tabelas app.quest_* podem ficar: sem as funções ninguém as usa.
--    Os registros de estudo já projetados ficam como registros comuns.
--    Apagar as tabelas é segunda fase.)
-- ============================================================
