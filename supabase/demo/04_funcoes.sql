-- ============================================================
-- DEMO 04 — funções da "semana 4 em repetição"
-- ------------------------------------------------------------
-- SÓ projeto de demonstração. Idempotente (create or replace).
--
-- O ciclo, em uma frase: toda segunda-feira o Meridiano volta a ser
-- a gravação das semanas 1 a 4, com a semana 4 começando na segunda
-- corrente; o que a gravação data de hoje em diante fica numa fila e
-- entra no produto dia a dia, às 00:10, sempre com a data de ontem.
--
--   demo.gravar(segunda)      tira a fotografia (uma vez; já feita)
--   demo.virar_semana(hoje)   apaga o dinâmico do Meridiano e reinsere
--                             a gravação ancorada na segunda de `hoje`
--   demo.liberar(hoje)        move da fila o que vence até `hoje`; se a
--                             âncora não é desta semana, refaz a semana
--   demo.pausar(bool)         desliga/religa as duas acima
--
-- GATILHOS: a reprodução roda com session_replication_role = replica,
-- que desliga os gatilhos de usuário SÓ nesta transação (nenhuma outra
-- sessão, de nenhum tenant, é afetada). Os eventos de XP e o estado
-- derivado (níveis) vêm da gravação, com os mesmos ids e carimbos.
-- Por que não "recálculo" (gatilhos ligados): o XP até ficaria
-- estável, porque a virada apaga todos os eventos do Meridiano antes
-- de reinserir. Mas (1) cada rodada geraria eventos com id e criado_em
-- novos, então a mesma data não daria o mesmo estado e rodar duas
-- vezes não seria idempotente — é isso que o teste pega quando o
-- replica é removido; e (2) o motor PED1 (trg_ped1_registro)
-- recalcularia os níveis a partir de dados parciais a cada reinsert, e
-- o histórico de níveis ganharia uma linha a cada mudança, semana após
-- semana.
--   Efeito colateral de replica: as FKs e os ON DELETE CASCADE também
--   não disparam. Por isso os filhos são apagados antes dos pais, à
--   mão, e todo insert faz join com alunos do Meridiano.
--   set_config() não serve: o supautils do Supabase só libera o
--   parâmetro pelo comando SET, daí o EXECUTE 'set local ...'.
-- ============================================================

-- ── guardas ─────────────────────────────────────────────────────────
-- Regra 3 do documento: antes de qualquer escrita, o tenant tem de ser
-- o Meridiano com plano demo. E a trilha que o mecanismo re-ancora
-- (trilha_semanas não tem escola_id) não pode ter passado a ser usada
-- por outra escola.
create or replace function demo.checar_tenant() returns void
  language plpgsql set search_path = '' as
$$
begin
  if not exists (select 1 from public.escolas where id = demo.escola() and plano = 'demo') then
    raise exception 'demo: escola % ausente ou fora do plano demo — nada foi escrito', demo.escola();
  end if;
  if exists (select 1 from public.alunos where trilha_id = demo.trilha() and escola_id <> demo.escola())
     or exists (select 1 from public.metas where trilha_id = demo.trilha() and escola_id <> demo.escola()) then
    raise exception 'demo: a trilha % é usada por outro tenant — re-ancorar as semanas mexeria nele', demo.trilha();
  end if;
end
$$;

create or replace function demo.segunda_de(p date) returns date
  language sql immutable set search_path = '' as
$$ select p - (extract(isodow from p)::int - 1) $$;

-- ── gravar: a fotografia das semanas 1..N, relativa à segunda da N ──
-- Grava o estado ATUAL do Meridiano até o domingo da semana que começa
-- em p_ancora. Rodada uma vez, em 23/09/2026, com p_ancora = 14/09
-- (semana 4), depois do D07/D09 e antes de qualquer virada — o estado
-- do banco nesse momento é o das capturas de 19/09 (a única diferença
-- é a semana 5 que a virada global gerou em 21/09, que fica de fora).
--
-- Quando cada coisa "acontece" na reprodução (libera_dia):
--   registro e simulado: no dia seguinte à data (o das 00:10);
--   conclusão de atividade: os carimbos gravados não servem — as 89
--   conclusões do seed têm todas o mesmo instante (18/09 17:39:20
--   UTC). Reproduzi-los deixaria a Helena em 0/7 de segunda a sexta,
--   estudando todo dia. A conclusão vai para o primeiro dia da semana
--   em que o aluno registrou a MESMA matéria; sem isso, o último dia
--   com registro na semana; sem registro, a sexta-feira (o dia do
--   carimbo gravado). Aparece no dia seguinte, como o resto;
--   evento de XP: junto com a sua origem (registro, simulado ou
--   atividade); evento sem origem gravada, no dia seguinte ao criado_em.
create or replace function demo.gravar(p_ancora date) returns jsonb
  language plpgsql set search_path = '' as
$$
declare
  v_fim    date := p_ancora + 6;
  v_semana int;
  v_res    jsonb;
begin
  perform demo.checar_tenant();
  if extract(isodow from p_ancora) <> 1 then
    raise exception 'demo.gravar: a âncora precisa ser uma segunda-feira (recebeu %)', p_ancora;
  end if;
  select numero into v_semana from public.trilha_semanas
   where trilha_id = demo.trilha() and inicio = p_ancora;
  if v_semana is null then
    raise exception 'demo.gravar: nenhuma semana da trilha começa em % (o D09 rodou?)', p_ancora;
  end if;

  truncate demo.gravacao_semanas, demo.gravacao_registros, demo.gravacao_simulados,
           demo.gravacao_metas, demo.gravacao_meta_atividades, demo.gravacao_eventos,
           demo.gravacao_niveis, demo.gravacao_nivel_historico;

  insert into demo.gravacao_semanas (numero, dia_inicio, dia_fim)
  select numero, inicio - p_ancora, fim - p_ancora
    from public.trilha_semanas where trilha_id = demo.trilha();

  insert into demo.gravacao_registros
    (id, aluno_id, dia, disciplina_codigo, topico, questoes, acertos, minutos, obs, criado_hora, libera_dia)
  select r.id, r.aluno_id, r.data - p_ancora, r.disciplina_codigo, r.topico, r.questoes, r.acertos,
         r.minutos, r.obs,
         time '19:00' + (row_number() over (partition by r.aluno_id, r.data order by r.criado_em, r.id) - 1)::int
                        * interval '25 minutes',
         r.data - p_ancora + 1
    from public.registros_estudo r
    join public.alunos a on a.id = r.aluno_id and a.escola_id = demo.escola()
   where r.escola_id = demo.escola() and r.data <= v_fim;

  insert into demo.gravacao_simulados
    (id, aluno_id, nome, dia, acertos, exam_tag, redacao_nota, criado_hora, libera_dia)
  select s.id, s.aluno_id, s.nome, s.data - p_ancora, s.acertos, s.exam_tag, s.redacao_nota,
         time '18:30', s.data - p_ancora + 1
    from public.simulados s
    join public.alunos a on a.id = s.aluno_id and a.escola_id = demo.escola()
   where s.escola_id = demo.escola() and s.data <= v_fim;

  insert into demo.gravacao_metas (id, aluno_id, semana_numero)
  select m.id, m.aluno_id, m.semana_numero
    from public.metas m
    join public.alunos a on a.id = m.aluno_id and a.escola_id = demo.escola()
   where m.escola_id = demo.escola() and m.trilha_id = demo.trilha()
     and m.semana_numero <= v_semana;

  insert into demo.gravacao_meta_atividades
    (id, meta_id, atividade_modelo_id, estado, dia_conclusao, libera_dia)
  select ma.id, ma.meta_id, ma.atividade_modelo_id, ma.estado, c.dia, c.dia + 1
    from public.meta_atividades ma
    join demo.gravacao_metas gm on gm.id = ma.meta_id
    join demo.gravacao_semanas s on s.numero = gm.semana_numero
    join public.atividades_modelo am on am.id = ma.atividade_modelo_id
    left join lateral (
      select coalesce(
               (select min(g.dia) from demo.gravacao_registros g
                 where g.aluno_id = gm.aluno_id and g.dia between s.dia_inicio and s.dia_fim
                   and g.disciplina_codigo = am.disciplina_codigo),
               (select max(g.dia) from demo.gravacao_registros g
                 where g.aluno_id = gm.aluno_id and g.dia between s.dia_inicio and s.dia_fim),
               s.dia_inicio + 4) as dia
       where ma.estado = 'concluida'
    ) c on true
   where ma.escola_id = demo.escola();

  -- estornados ficam fora da história: são o rastro do D07 (e de
  -- qualquer correção futura), não algo que "aconteceu" na semana.
  insert into demo.gravacao_eventos
    (id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta,
     metadata, idempotency_key, criado_por, dia, criado_hora, libera_dia)
  select e.id, e.aluno_id, e.exam_tag, e.tipo_evento, e.origem, e.referencia_tabela, e.referencia_id,
         e.xp_delta, e.metadata, e.idempotency_key, e.criado_por,
         coalesce(gr.dia, gs.dia, gma.dia_conclusao,
                  (e.criado_em at time zone 'America/Sao_Paulo')::date - p_ancora),
         coalesce(gr.criado_hora, gs.criado_hora,
                  case when gma.id is not null then time '20:40' end,
                  (e.criado_em at time zone 'America/Sao_Paulo')::time),
         coalesce(gr.libera_dia, gs.libera_dia, gma.libera_dia,
                  (e.criado_em at time zone 'America/Sao_Paulo')::date - p_ancora + 1)
    from public.aluno_eventos_progresso e
    join public.alunos a on a.id = e.aluno_id and a.escola_id = demo.escola()
    left join demo.gravacao_registros gr
           on e.referencia_tabela = 'registros_estudo' and gr.id = e.referencia_id
    left join demo.gravacao_simulados gs
           on e.referencia_tabela = 'simulados' and gs.id = e.referencia_id
    left join demo.gravacao_meta_atividades gma
           on e.referencia_tabela = 'meta_atividades' and gma.id = e.referencia_id and gma.estado = 'concluida'
   where e.escola_id = demo.escola()
     and e.status = 'valido'
     and case coalesce(e.referencia_tabela, '')
           when 'registros_estudo' then gr.id is not null
           when 'simulados'        then gs.id is not null
           when 'meta_atividades'  then gma.id is not null
           else (e.criado_em at time zone 'America/Sao_Paulo')::date <= v_fim
         end;

  insert into demo.gravacao_niveis
  select n.* from public.aluno_niveis n
    join public.alunos a on a.id = n.aluno_id and a.escola_id = demo.escola()
   where n.escola_id = demo.escola();

  insert into demo.gravacao_nivel_historico
  select h.* from public.aluno_nivel_historico h
    join public.alunos a on a.id = h.aluno_id and a.escola_id = demo.escola()
   where h.escola_id = demo.escola();

  v_res := jsonb_build_object(
    'ancora', p_ancora, 'semana', v_semana,
    'semanas',         (select count(*) from demo.gravacao_semanas),
    'registros',       (select count(*) from demo.gravacao_registros),
    'simulados',       (select count(*) from demo.gravacao_simulados),
    'metas',           (select count(*) from demo.gravacao_metas),
    'meta_atividades', (select count(*) from demo.gravacao_meta_atividades),
    'concluidas',      (select count(*) from demo.gravacao_meta_atividades where estado = 'concluida'),
    'eventos',         (select count(*) from demo.gravacao_eventos),
    'niveis',          (select count(*) from demo.gravacao_niveis),
    'nivel_historico', (select count(*) from demo.gravacao_nivel_historico),
    'xp_por_aluno',    (select jsonb_object_agg(a.nome, coalesce(x.xp, 0) order by a.nome)
                          from public.alunos a
                          left join (select aluno_id, sum(xp_delta) as xp
                                       from demo.gravacao_eventos group by aluno_id) x on x.aluno_id = a.id
                         where a.escola_id = demo.escola()));

  insert into demo.execucoes (acao, hoje, ancora, detalhe)
  values ('gravar', app.hoje_local(), p_ancora, v_res);
  return v_res;
end
$$;

-- ── aplicar a fila (interna: exige replica e âncora já definidos) ───
create or replace function demo._aplicar_fila(p_hoje date) returns jsonb
  language plpgsql set search_path = '' as
$$
declare
  v_seg date := (select ancora from demo.estado);
  n_reg int; n_sim int; n_ma int; n_ev int; n_fila int;
begin
  if v_seg is null then
    raise exception 'demo: sem âncora — rode demo.virar_semana() primeiro';
  end if;
  if current_setting('session_replication_role') <> 'replica' then
    raise exception 'demo._aplicar_fila: só roda com os gatilhos desligados (chame demo.liberar)';
  end if;

  insert into public.registros_estudo
    (id, escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos, obs, criado_em)
  select g.id, demo.escola(), g.aluno_id, v_seg + g.dia, g.disciplina_codigo, g.topico, g.questoes,
         g.acertos, g.minutos, g.obs, ((v_seg + g.dia) + g.criado_hora) at time zone 'America/Sao_Paulo'
    from demo.fila f
    join demo.gravacao_registros g on g.id = f.id
    join public.alunos a on a.id = g.aluno_id and a.escola_id = demo.escola()
   where f.tabela = 'registros_estudo' and f.libera_em <= p_hoje
  on conflict do nothing;
  get diagnostics n_reg = row_count;

  insert into public.simulados
    (id, escola_id, aluno_id, nome, data, acertos, exam_tag, redacao_nota, criado_em)
  select g.id, demo.escola(), g.aluno_id, g.nome, v_seg + g.dia, g.acertos, g.exam_tag, g.redacao_nota,
         ((v_seg + g.dia) + g.criado_hora) at time zone 'America/Sao_Paulo'
    from demo.fila f
    join demo.gravacao_simulados g on g.id = f.id
    join public.alunos a on a.id = g.aluno_id and a.escola_id = demo.escola()
   where f.tabela = 'simulados' and f.libera_em <= p_hoje
  on conflict do nothing;
  get diagnostics n_sim = row_count;

  -- só conclui o que ainda está pendente: se alguém mexeu na
  -- atividade durante uma demonstração, a mão da pessoa prevalece
  -- até a próxima segunda.
  update public.meta_atividades ma
     set estado = 'concluida',
         atualizado_em = ((v_seg + g.dia_conclusao) + time '20:40') at time zone 'America/Sao_Paulo'
    from demo.fila f
    join demo.gravacao_meta_atividades g on g.id = f.id
   where f.tabela = 'meta_atividades' and f.libera_em <= p_hoje
     and ma.id = g.id and ma.escola_id = demo.escola() and ma.estado = 'pendente';
  get diagnostics n_ma = row_count;

  -- evento só entra se a origem existe (e, para atividade, se está
  -- concluída). `on conflict do nothing` sem alvo cobre também a chave
  -- de idempotência: se a atividade foi concluída ao vivo, o gatilho
  -- já gravou o XP dela e este não duplica.
  insert into public.aluno_eventos_progresso
    (id, escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id,
     xp_delta, metadata, status, idempotency_key, criado_por, criado_em)
  select g.id, demo.escola(), g.aluno_id, g.exam_tag, g.tipo_evento, g.origem, g.referencia_tabela,
         g.referencia_id, g.xp_delta, g.metadata, 'valido', g.idempotency_key, g.criado_por,
         ((v_seg + g.dia) + g.criado_hora) at time zone 'America/Sao_Paulo'
    from demo.fila f
    join demo.gravacao_eventos g on g.id = f.id
    join public.alunos a on a.id = g.aluno_id and a.escola_id = demo.escola()
   where f.tabela = 'aluno_eventos_progresso' and f.libera_em <= p_hoje
     and case coalesce(g.referencia_tabela, '')
           when 'registros_estudo' then exists (select 1 from public.registros_estudo x where x.id = g.referencia_id)
           when 'simulados'        then exists (select 1 from public.simulados x where x.id = g.referencia_id)
           when 'meta_atividades'  then exists (select 1 from public.meta_atividades x
                                                 where x.id = g.referencia_id and x.estado = 'concluida')
           else true
         end
  on conflict do nothing;
  get diagnostics n_ev = row_count;

  delete from demo.fila where libera_em <= p_hoje;
  get diagnostics n_fila = row_count;

  return jsonb_build_object('registros', n_reg, 'simulados', n_sim, 'atividades_concluidas', n_ma,
                            'eventos', n_ev, 'saiu_da_fila', n_fila,
                            'na_fila', (select count(*) from demo.fila));
end
$$;

-- ── virada semanal: segunda 00:00 de Brasília ───────────────────────
create or replace function demo.virar_semana(p_hoje date default null) returns jsonb
  language plpgsql set search_path = '' as
$$
declare
  v_hoje date := coalesce(p_hoje, app.hoje_local());
  v_seg  date := demo.segunda_de(v_hoje);
  v_srr  text := current_setting('session_replication_role');
  v_res  jsonb;
  n_metas int; n_ma int; n_niv int; n_hist int;
begin
  perform demo.checar_tenant();
  if (select pausado from demo.estado) then
    insert into demo.execucoes (acao, hoje, detalhe)
    values ('pausado', v_hoje, '{"chamada": "virar_semana"}');
    return jsonb_build_object('pausado', true);
  end if;
  if not exists (select 1 from demo.gravacao_registros) then
    raise exception 'demo: gravação vazia — rode demo.gravar(<segunda da semana 4>) antes';
  end if;
  if (select count(*) from demo.gravacao_semanas)
     <> (select count(*) from public.trilha_semanas where trilha_id = demo.trilha()) then
    raise exception 'demo: a trilha mudou de número de semanas desde a gravação — regrave';
  end if;

  execute 'set local session_replication_role = replica';

  -- 1. apaga o dinâmico do Meridiano (filhos antes dos pais: sem cascata em replica)
  delete from public.meta_atividades         where escola_id = demo.escola();
  delete from public.metas                   where escola_id = demo.escola();
  delete from public.aluno_eventos_progresso where escola_id = demo.escola();
  delete from public.simulados               where escola_id = demo.escola();
  delete from public.registros_estudo        where escola_id = demo.escola();
  delete from public.aluno_missoes           where escola_id = demo.escola();
  delete from public.aluno_nivel_historico   where escola_id = demo.escola();
  delete from public.aluno_niveis            where escola_id = demo.escola();
  delete from demo.fila;

  -- 2. re-ancora as 9 semanas: a semana gravada vira a semana corrente
  update public.trilha_semanas ts
     set inicio = v_seg + g.dia_inicio, fim = v_seg + g.dia_fim
    from demo.gravacao_semanas g
   where ts.trilha_id = demo.trilha() and ts.numero = g.numero;
  update demo.estado set ancora = v_seg, atualizado_em = now();

  -- 3. metas e atividades existem desde a segunda (o motor gera a meta
  --    da semana às 00:05); conclusões futuras nascem pendentes
  insert into public.metas
    (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status, gerada_em)
  select g.id, demo.escola(), g.aluno_id, demo.trilha(), g.semana_numero, ts.inicio, ts.fim,
         case when ts.fim < v_hoje then 'fechada' else 'ativa' end,
         (ts.inicio + time '00:05') at time zone 'America/Sao_Paulo'
    from demo.gravacao_metas g
    join public.alunos a on a.id = g.aluno_id and a.escola_id = demo.escola()
    join public.trilha_semanas ts on ts.trilha_id = demo.trilha() and ts.numero = g.semana_numero
   where ts.inicio <= v_hoje;
  get diagnostics n_metas = row_count;

  insert into public.meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado, atualizado_em)
  select g.id, demo.escola(), g.meta_id, g.atividade_modelo_id,
         case when g.estado = 'concluida' then 'pendente' else g.estado end,
         m.gerada_em
    from demo.gravacao_meta_atividades g
    join public.metas m on m.id = g.meta_id and m.escola_id = demo.escola();
  get diagnostics n_ma = row_count;

  -- 4. estado derivado, como gravado
  insert into public.aluno_niveis
  select n.* from demo.gravacao_niveis n
    join public.alunos a on a.id = n.aluno_id and a.escola_id = demo.escola();
  get diagnostics n_niv = row_count;
  insert into public.aluno_nivel_historico overriding system value
  select h.* from demo.gravacao_nivel_historico h
    join public.alunos a on a.id = h.aluno_id and a.escola_id = demo.escola();
  get diagnostics n_hist = row_count;

  -- 5. tudo o que "acontece" vai para a fila; o que já venceu sai agora
  insert into demo.fila (tabela, id, libera_em)
  select 'registros_estudo', id, v_seg + libera_dia from demo.gravacao_registros
  union all
  select 'simulados', id, v_seg + libera_dia from demo.gravacao_simulados
  union all
  select 'meta_atividades', g.id, v_seg + g.libera_dia
    from demo.gravacao_meta_atividades g
    join public.metas m on m.id = g.meta_id
   where g.estado = 'concluida'
  union all
  select 'aluno_eventos_progresso', id, v_seg + libera_dia from demo.gravacao_eventos;

  v_res := demo._aplicar_fila(v_hoje)
        || jsonb_build_object('ancora', v_seg, 'metas', n_metas, 'meta_atividades', n_ma,
                              'niveis', n_niv, 'nivel_historico', n_hist);

  execute 'set local session_replication_role = ' || quote_literal(v_srr);

  insert into demo.execucoes (acao, hoje, ancora, detalhe) values ('virar_semana', v_hoje, v_seg, v_res);
  return v_res;
end
$$;

-- ── liberação diária: 00:10 de Brasília ─────────────────────────────
create or replace function demo.liberar(p_hoje date default null) returns jsonb
  language plpgsql set search_path = '' as
$$
declare
  v_hoje date := coalesce(p_hoje, app.hoje_local());
  v_srr  text := current_setting('session_replication_role');
  v_res  jsonb;
begin
  perform demo.checar_tenant();
  if (select pausado from demo.estado) then
    insert into demo.execucoes (acao, hoje, detalhe)
    values ('pausado', v_hoje, '{"chamada": "liberar"}');
    return jsonb_build_object('pausado', true);
  end if;

  -- a virada de segunda não rodou (ou é a primeira vez): refaz a
  -- semana inteira em vez de liberar fila de outra âncora
  if (select ancora from demo.estado) is distinct from demo.segunda_de(v_hoje) then
    return demo.virar_semana(v_hoje) || jsonb_build_object('autocorrecao', true);
  end if;

  execute 'set local session_replication_role = replica';
  v_res := demo._aplicar_fila(v_hoje);
  execute 'set local session_replication_role = ' || quote_literal(v_srr);

  insert into demo.execucoes (acao, hoje, ancora, detalhe)
  values ('liberar', v_hoje, (select ancora from demo.estado), v_res);
  return v_res;
end
$$;

-- ── pausa: o Meridiano para de ser reproduzido (e volta a envelhecer)
create or replace function demo.pausar(p_pausado boolean default true) returns void
  language plpgsql set search_path = '' as
$$
begin
  update demo.estado set pausado = p_pausado, atualizado_em = now();
  insert into demo.execucoes (acao, hoje, detalhe)
  values (case when p_pausado then 'pausar' else 'retomar' end, app.hoje_local(), '{}');
end
$$;

-- nada daqui é chamável por quem não é dono
revoke all on all functions in schema demo from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all functions in schema demo from %I', r);
    end if;
  end loop;
end $$;
