-- ============================================================
-- 0064 — registro de estudo leva missão e assunto, conferidos no servidor
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono. Depende da 0061 (motor sequencial).
-- ORIGEM: P0.4 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_
--   Auditoria_do_Banco.md, seção 4.1; casos da seção 12.
--
-- O DEFEITO (0061, app.missoes_reprocessar, passo c)
--   A fila credita à missão em andamento QUALQUER registro da matéria
--   com acertos. registros_estudo.topico é texto livre. Medido no
--   Postgres local: missão "Ato administrativo" em andamento, o aluno
--   registra 20 questões de licitação em Direito Administrativo, e a
--   missão de atos fecha com elas.
--
-- A REGRA
--   1. registros_estudo.tipo_pratica:
--        legado   regra da 0061 sem mudança (conta para a missão em
--                 andamento da matéria). É o DEFAULT da coluna: as linhas
--                 anteriores a esta migration e o que o SERVIDOR grava
--                 sem dizer o tipo (seeds, repetição semanal da demo,
--                 restauração de backup, provas). Cliente nunca grava.
--        livre    o que o cliente grava sem dizer o tipo. Soma volume,
--                 acurácia, nível e conquistas como sempre; NUNCA conclui
--                 missão.
--        missao   prática da missão `missao_id`. Só conta para ela, e
--                 só quando ela é a da vez na fila da matéria.
--        revisao  revisão de uma missão já iniciada. Fica ligada ao
--                 assunto dela; não conta para nenhuma missão.
--   2. Servidor confere, num gatilho BEFORE (não confia no navegador):
--      missão do concurso do aluno, da mesma matéria do registro, ativa
--      na escola; para 'missao', automática (na fila); para 'revisao',
--      já iniciada pelo aluno. O assunto do registro é o da missão:
--      outro assunto enviado é recusado. Registro livre pode levar um
--      assunto, que também é conferido (concurso e matéria do aluno).
--   3. Editar ou apagar reprocessa como na 0061 (mesmo ledger, uma linha
--      por aluno e missão: sem XP órfão nem duplicado). Trocar o tipo de
--      um registro vinculado tira o vínculo e refaz a fila.
--
-- TRANSIÇÃO
--   As linhas existentes viram 'legado' pelo DEFAULT da coluna nova
--   (sem UPDATE: nenhum gatilho dispara, o motor não roda). O DEFAULT
--   fica 'legado' de propósito: os caminhos do servidor que inserem
--   registro sem conhecer a coluna (demo._aplicar_fila, o restauro
--   `insert ... select *` do backup de 23/09, seeds) seguem na regra
--   da 0061 sem precisar ser reescritos nem reaplicados. Insert de
--   CLIENTE com 'legado' (o default) vira 'livre' no gatilho.
--   Um front sem o PR irmão grava 'livre' e, portanto, deixa de
--   avançar missão: aplicar esta migration junto com o PR de front.
--
-- Aditiva. Idempotente. ROLLBACK no fim.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Colunas
-- ------------------------------------------------------------
alter table registros_estudo
  add column if not exists tipo_pratica text not null default 'legado',
  add column if not exists missao_id    uuid references missoes (id) on delete set null,
  add column if not exists assunto_id   uuid references assuntos (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'registros_estudo_tipo_pratica_check') then
    alter table registros_estudo add constraint registros_estudo_tipo_pratica_check
      check (tipo_pratica in ('legado', 'livre', 'missao', 'revisao'));
  end if;
  -- livre e legado nunca levam missão. Missão/revisão com missao_id nulo
  -- só acontece se a missão for apagada do catálogo depois (on delete set
  -- null): o gatilho exige a missão em toda escrita.
  if not exists (select 1 from pg_constraint where conname = 'registros_estudo_missao_por_tipo') then
    alter table registros_estudo add constraint registros_estudo_missao_por_tipo
      check (tipo_pratica in ('missao', 'revisao') or missao_id is null);
  end if;
end $$;

create index if not exists idx_registros_missao on registros_estudo (missao_id) where missao_id is not null;

comment on column registros_estudo.tipo_pratica is
  '0064: legado (default: anteriores à 0064 e escritas do servidor; regra da 0061) | livre (cliente sem tipo; não conclui missão) | missao (conta só para missao_id, na vez dela) | revisao (de missão já iniciada; não conta).';
comment on column registros_estudo.missao_id is
  '0064: missão praticada ou revisada. Conferida no servidor (concurso, matéria, escola).';
comment on column registros_estudo.assunto_id is
  '0064: assunto do registro. Em missao/revisao é o da missão (o servidor preenche); em livre, conferido contra concurso e matéria.';

-- ------------------------------------------------------------
-- 2) Conferência no servidor
-- ------------------------------------------------------------
-- SECURITY DEFINER: lê catálogo, fila e progresso sem depender da RLS de
-- quem escreve. O papel de quem escreve vem de current_user, que dentro
-- de uma função definer seria o dono; por isso session_user não serve e
-- usamos a claim de papel do PostgREST (request.jwt.claims) para saber
-- se a escrita vem de um cliente. Sem claim (psql, motor, restauração),
-- é servidor.
create or replace function app.registro_conferir_pratica() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cliente boolean := coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') <> ''
                       and coalesce((pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')
                           in ('authenticated', 'anon');
  v_exam    text;
  v_escola  uuid;
  v_assunto uuid := new.assunto_id;   -- o assunto que o cliente ENVIOU
  m         public.missoes;
begin
  -- No UPDATE, assunto igual ao de antes não foi enviado: é o valor que
  -- já estava na linha. Trocar a missão sem mexer no assunto recalcula
  -- o assunto pela missão nova, em vez de acusar divergência.
  if tg_op = 'UPDATE' and new.assunto_id is not distinct from old.assunto_id then
    v_assunto := null;
  end if;

  if new.tipo_pratica = 'legado' and v_cliente then
    -- OLD só existe no UPDATE; o PL/pgSQL não garante curto-circuito.
    -- No INSERT, 'legado' é o default da coluna: o cliente não disse o
    -- tipo (ou pediu legado), e registro de cliente sem tipo é livre.
    if tg_op = 'INSERT' then
      new.tipo_pratica := 'livre';
    elsif old.tipo_pratica <> 'legado' then
      raise exception 'registro de estudo: o tipo "legado" é reservado aos registros anteriores à 0064'
        using errcode = '22023';
    end if;
  end if;

  select c.codigo, a.escola_id into v_exam, v_escola
    from public.alunos a join public.concursos c on c.id = a.concurso_id
   where a.id = new.aluno_id;

  if new.tipo_pratica in ('missao', 'revisao') then
    if new.missao_id is null then
      -- a missão saiu do catálogo (on delete set null): o servidor órfana
      -- o registro, que segue somando volume. Cliente nunca manda isso.
      if tg_op = 'UPDATE' and not v_cliente and old.missao_id is not null then
        return new;
      end if;
      raise exception 'registro de estudo: informe a missão praticada' using errcode = '22023';
    end if;
    select * into m from public.missoes where id = new.missao_id;
    if not found or v_exam is null or m.exam_tag <> v_exam then
      raise exception 'registro de estudo: a missão não pertence ao concurso do aluno' using errcode = '22023';
    end if;
    if m.materia_codigo <> new.disciplina_codigo then
      raise exception 'registro de estudo: a matéria do registro (%) não é a da missão (%)',
        new.disciplina_codigo, m.materia_codigo using errcode = '22023';
    end if;
    if exists (select 1 from public.missoes_escola me
                where me.missao_id = m.id and me.escola_id = v_escola and me.ativa = false) then
      raise exception 'registro de estudo: a missão está desativada na escola' using errcode = '22023';
    end if;
    if v_assunto is not null and v_assunto is distinct from m.assunto_id then
      raise exception 'registro de estudo: o assunto enviado não é o da missão' using errcode = '22023';
    end if;
    new.assunto_id := m.assunto_id;

    if new.tipo_pratica = 'missao'
       and not exists (select 1 from app.missoes_fila(new.aluno_id, new.disciplina_codigo) q where q.missao_id = m.id) then
      raise exception 'registro de estudo: esta missão não tem acompanhamento automático; registre como estudo livre'
        using errcode = '22023';
    end if;
    if new.tipo_pratica = 'revisao'
       and not exists (select 1 from public.aluno_missoes am where am.aluno_id = new.aluno_id and am.missao_id = m.id) then
      raise exception 'registro de estudo: só dá para revisar uma missão já iniciada' using errcode = '22023';
    end if;
  else
    if new.missao_id is not null then
      raise exception 'registro de estudo: registro % não leva missão', new.tipo_pratica using errcode = '22023';
    end if;
    -- saiu de missão/revisão ou trocou de matéria sem mandar assunto: o
    -- assunto herdado da linha não vale mais
    if tg_op = 'UPDATE' and v_assunto is null
       and (old.tipo_pratica in ('missao', 'revisao') or new.disciplina_codigo is distinct from old.disciplina_codigo) then
      new.assunto_id := null;
    end if;
    if new.assunto_id is not null and not exists (
         select 1 from public.assuntos s
          where s.id = new.assunto_id and s.exam_tag = v_exam and s.materia_codigo = new.disciplina_codigo) then
      raise exception 'registro de estudo: o assunto não é do concurso e da matéria do aluno' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

revoke all on function app.registro_conferir_pratica() from public, anon, authenticated;

drop trigger if exists trg_registro_conferir_pratica on registros_estudo;
create trigger trg_registro_conferir_pratica
  before insert or update of tipo_pratica, missao_id, assunto_id, disciplina_codigo, aluno_id
  on registros_estudo
  for each row execute function app.registro_conferir_pratica();

-- ------------------------------------------------------------
-- 3) Motor: só legado e missão da vez contam
-- ------------------------------------------------------------
-- Igual à 0061, com duas mudanças marcadas "0064" no passo (c).
create or replace function app.missoes_reprocessar(
  p_aluno uuid, p_materia text, p_desde uuid default null, p_novo uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_escola    uuid;
  v_exam      text;
  v_desde_em  timestamptz;
  v_desde_row public.aluno_missoes;
  v_refazer   uuid[] := '{}';
  v_antes     jsonb := '{}';
  v_ordem     uuid[] := '{}';
  v_meta_q    int[]  := '{}';
  v_meta_a    int[]  := '{}';
  v_xp        int[]  := '{}';
  v_recebeu   uuid[] := '{}';
  v_i         int := 0;
  v_atual     int := 0;
  v_alvo      int := 0;
  v_q         int := 0;
  v_a         int := 0;
  v_inicio    timestamptz;
  r           record;
  f           record;
  res_inicio  timestamptz[] := '{}';
  res_q       int[] := '{}';
  res_a       int[] := '{}';
  res_fim     timestamptz[] := '{}';
  lk_reg      uuid[] := '{}';
  lk_pos      int[]  := '{}';
  v_id        uuid;
  v_acc       int;
  v_concluiu  boolean;
begin
  select a.escola_id, c.codigo into v_escola, v_exam
    from public.alunos a join public.concursos c on c.id = a.concurso_id
   where a.id = p_aluno;
  if v_escola is null or v_exam is null or p_materia is null then return; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('missoes:' || p_aluno::text || ':' || p_materia, 0));

  -- (a) quais missões refazer
  if p_desde is not null then
    select * into v_desde_row from public.aluno_missoes where id = p_desde;
    if not found or v_desde_row.regra = 'legado' then return; end if;
    v_desde_em := v_desde_row.iniciada_em;
  else
    select am.iniciada_em into v_desde_em from public.aluno_missoes am
     where am.aluno_id = p_aluno and am.materia_codigo = p_materia
       and am.estado = 'em_andamento' and am.regra = 'sequencial';
  end if;

  select coalesce(array_agg(am.id order by am.iniciada_em, am.id), '{}'),
         coalesce(jsonb_object_agg(am.missao_id::text, am.estado), '{}')
    into v_refazer, v_antes
    from public.aluno_missoes am
   where v_desde_em is not null
     and am.aluno_id = p_aluno and am.materia_codigo = p_materia and am.regra = 'sequencial'
     and am.iniciada_em >= v_desde_em
     and not (am.estado = 'concluida'
              and am.missao_id not in (select q.missao_id from app.missoes_fila(p_aluno, p_materia) q));

  -- (b) ordem de distribuição
  for f in
    select q.missao_id, q.meta_questoes, q.meta_acuracia, q.xp, am.iniciada_em
      from app.missoes_fila(p_aluno, p_materia) q
      left join public.aluno_missoes am on am.aluno_id = p_aluno and am.missao_id = q.missao_id
     where am.id is null or am.id = any (v_refazer)
     order by (am.id is null), am.iniciada_em, q.posicao
  loop
    v_ordem  := v_ordem  || f.missao_id;
    v_meta_q := v_meta_q || f.meta_questoes;
    v_meta_a := v_meta_a || f.meta_acuracia;
    v_xp     := v_xp     || f.xp;
  end loop;

  -- (c) distribui os registros, na ordem em que o servidor os recebeu.
  --     0064: só 'legado' (regra da 0061) e 'missao' entram; livre e
  --     revisão nunca contam.
  for r in
    select re.id, re.questoes, re.acertos, re.tipo_pratica, re.missao_id, rr.recebido_em
      from public.registros_estudo re
      join app.registros_recebidos rr on rr.registro_id = re.id
     where re.aluno_id = p_aluno and re.disciplina_codigo = p_materia and re.acertos is not null
       and re.tipo_pratica in ('legado', 'missao')
       and (re.id in (select mr.registro_id from app.missao_registros mr
                       where mr.aluno_missao_id = any (v_refazer))
            or (re.id = p_novo
                and not exists (select 1 from app.missao_registros mr where mr.registro_id = re.id)
                and rr.recebido_em >= coalesce(v_desde_em, now())))
     order by rr.recebido_em, re.id
  loop
    v_alvo := case when v_atual = 0 then v_i + 1 else v_atual end;
    exit when v_alvo > coalesce(array_length(v_ordem, 1), 0);   -- fila acabou: o resto não conta
    -- 0064: prática de missão só conta para a missão da vez; de outra
    -- missão, fica sem vínculo (soma volume, não conclui nada)
    continue when r.tipo_pratica = 'missao' and r.missao_id is distinct from v_ordem[v_alvo];
    if v_atual = 0 then
      v_i := v_alvo;
      v_atual := v_i; v_q := 0; v_a := 0; v_inicio := r.recebido_em;
    end if;
    lk_reg := lk_reg || r.id;
    lk_pos := lk_pos || v_atual;
    v_q := v_q + r.questoes;
    v_a := v_a + r.acertos;
    res_inicio[v_atual] := v_inicio;
    res_q[v_atual] := v_q;
    res_a[v_atual] := v_a;
    if v_q >= v_meta_q[v_atual] and round(100.0 * v_a / v_q) >= v_meta_a[v_atual] then
      res_fim[v_atual] := r.recebido_em;
      v_atual := 0;
    end if;
  end loop;

  -- (d) grava
  delete from app.missao_registros where aluno_missao_id = any (v_refazer);
  if p_novo is not null then delete from app.missao_registros where registro_id = p_novo; end if;

  for v_i in 1 .. coalesce(array_length(v_ordem, 1), 0) loop
    if res_inicio[v_i] is not null then v_recebeu := v_recebeu || v_ordem[v_i]; end if;
  end loop;
  delete from public.aluno_missoes am
   where am.id = any (v_refazer) and not (am.missao_id = any (v_recebeu));

  for v_i in 1 .. coalesce(array_length(v_ordem, 1), 0) loop
    continue when res_inicio[v_i] is null;
    v_acc := round(100.0 * res_a[v_i] / res_q[v_i])::int;
    v_concluiu := res_fim[v_i] is not null;
    insert into public.aluno_missoes as am
      (escola_id, aluno_id, missao_id, exam_tag, materia_codigo, regra, estado, iniciada_em,
       questoes_acumuladas, acuracia, meta_questoes, meta_acuracia, xp_concedido, concluida_em, atualizado_em)
    values (v_escola, p_aluno, v_ordem[v_i], v_exam, p_materia, 'sequencial',
            case when v_concluiu then 'concluida' else 'em_andamento' end, res_inicio[v_i],
            res_q[v_i], v_acc, v_meta_q[v_i], v_meta_a[v_i],
            case when v_concluiu then v_xp[v_i] else 0 end, res_fim[v_i], now())
    on conflict (aluno_id, missao_id) do update set
      materia_codigo = excluded.materia_codigo, regra = 'sequencial', estado = excluded.estado,
      iniciada_em = excluded.iniciada_em, questoes_acumuladas = excluded.questoes_acumuladas,
      acuracia = excluded.acuracia, meta_questoes = excluded.meta_questoes,
      meta_acuracia = excluded.meta_acuracia, xp_concedido = excluded.xp_concedido,
      concluida_em = excluded.concluida_em, atualizado_em = now()
    returning am.id into v_id;

    insert into app.missao_registros (registro_id, aluno_missao_id)
    select lk_reg[k], v_id from generate_subscripts(lk_pos, 1) k where lk_pos[k] = v_i;

    if v_concluiu then
      insert into public.aluno_eventos_progresso as ev
        (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id,
         xp_delta, metadata, idempotency_key)
      values (v_escola, p_aluno, v_exam, 'missao_concluida', 'motor_missao', 'missoes', v_ordem[v_i], v_xp[v_i],
              pg_catalog.jsonb_build_object('volume', res_q[v_i], 'acuracia', v_acc, 'regra', 'sequencial'),
              'missao_motor:' || p_aluno::text || ':' || v_ordem[v_i]::text)
      on conflict (idempotency_key) do update set
        status = 'valido',
        metadata = ev.metadata || pg_catalog.jsonb_build_object(
          'volume', res_q[v_i], 'acuracia', v_acc,
          'historico', coalesce(ev.metadata -> 'historico', '[]'::jsonb)
                       || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('revalidado_em', now())))
      where ev.status = 'estornado';
      update public.aluno_missoes am set xp_concedido = ev.xp_delta
        from public.aluno_eventos_progresso ev
       where am.id = v_id
         and ev.idempotency_key = 'missao_motor:' || p_aluno::text || ':' || v_ordem[v_i]::text
         and am.xp_concedido is distinct from ev.xp_delta;
    end if;
  end loop;

  -- (e) estorno: estava concluída antes e não está mais
  update public.aluno_eventos_progresso ev
     set status = 'estornado',
         metadata = ev.metadata || pg_catalog.jsonb_build_object(
           'historico', coalesce(ev.metadata -> 'historico', '[]'::jsonb)
                        || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
                             'estornado_em', now(), 'motivo', 'registro da missão apagado ou alterado')))
   where ev.aluno_id = p_aluno and ev.tipo_evento = 'missao_concluida' and ev.origem = 'motor_missao'
     and ev.status = 'valido'
     and ev.referencia_id in (select (k)::uuid from jsonb_each_text(v_antes) as e(k, v) where v = 'concluida')
     and not exists (select 1 from public.aluno_missoes am
                      where am.aluno_id = p_aluno and am.missao_id = ev.referencia_id and am.estado = 'concluida');
end $$;

-- missoes_aplicar: igual à 0061, mas registro novo que não pode contar
-- (livre, revisão) não aciona a fila à toa.
create or replace function app.missoes_aplicar(
  p_op text, p_old public.registros_estudo, p_new public.registros_estudo
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_missao  uuid;
  v_materia text;
  v_estado  text;
begin
  if p_op in ('UPDATE', 'DELETE') then
    select mr.aluno_missao_id, am.materia_codigo into v_missao, v_materia
      from app.missao_registros mr join public.aluno_missoes am on am.id = mr.aluno_missao_id
     where mr.registro_id = (p_old).id;
    if p_op = 'DELETE' then delete from app.missao_registros where registro_id = (p_old).id; end if;
    if v_missao is not null then
      perform app.missoes_reprocessar((p_old).aluno_id, v_materia, v_missao, null);
    end if;
  end if;

  if p_op in ('INSERT', 'UPDATE') and (p_new).acertos is not null
     and (p_new).tipo_pratica in ('legado', 'missao')
     and not exists (select 1 from app.missao_registros where registro_id = (p_new).id) then
    perform app.missoes_reprocessar((p_new).aluno_id, (p_new).disciplina_codigo, null, (p_new).id);
  end if;
exception when others then
  get stacked diagnostics v_estado = returned_sqlstate;
  perform app.relatar_falha_servidor('motor_missoes', v_estado);
  raise warning 'motor de missões falhou (SQLSTATE %): %', v_estado, sqlerrm;
end $$;

-- os create or replace mantêm os privilégios da 0061 (só service_role)

-- ============================================================
-- ROLLBACK (manual; volta à regra da 0061 para todos os registros):
--   drop trigger trg_registro_conferir_pratica on registros_estudo;
--   drop function app.registro_conferir_pratica();
--   reaplicar app.missoes_reprocessar e app.missoes_aplicar da 0061;
--   alter table registros_estudo drop constraint registros_estudo_missao_por_tipo,
--     drop constraint registros_estudo_tipo_pratica_check;
--   (as colunas podem ficar: sem o gatilho e com o motor da 0061 elas
--    são ignoradas. Removê-las é segunda fase.)
-- ============================================================
