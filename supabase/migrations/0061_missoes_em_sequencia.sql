-- ============================================================
-- 0061 — missões em sequência por matéria: cada registro conta para
--         uma missão só, depois de ela começar
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono. Depende da 0059 (coletor de erros, PR de
-- banco dos alertas): a falha do motor é registrada lá.
-- NUMERAÇÃO: depende da 0060 só pela numeração contígua.
-- Produção em 01/10/2026 (leitura do gestor): 0 registros, 0 linhas em
-- aluno_missoes, 0 eventos de missão, 26 missões com meta, nenhuma
-- missoes_escola com qtd_questoes. Nada a estornar nem a migrar.
--
-- O DEFEITO (0033, app.motor_avaliar_aluno)
--   Para cada missão, o motor somava TODOS os registros do aluno na
--   matéria, de todo o tempo, e comparava com a meta da missão. Medido
--   no Postgres local: um registro de 70 questões de Matemática com 86%
--   fechava as 3 missões da EsPCEx (70/60/70 a 82%) e pagava 270 XP;
--   apagar o registro não devolvia nada (o estorno da 0038 só pega
--   eventos que apontam para o registro). E o volume contava questões
--   sem acerto informado enquanto a acurácia não: 69 sem acerto + 1
--   certa fechavam as 3 com "100%".
--
-- A REGRA (aprovada pelo dono em 02/10/2026)
--   1. Fila por matéria: as missões automáticas (meta efetiva > 0,
--      ativas na escola, do concurso-alvo) em `missoes.ordem`, desempate
--      por id, a mesma ordem da tela da trilha. Uma em andamento por vez.
--   2. A missão começa no primeiro registro da matéria (com acertos)
--      recebido quando ela é a próxima. Registro anterior nunca conta; o
--      registro que fecha uma missão não conta para a seguinte.
--   3. Vínculo registro → missão gravado pelo motor (chave primária no
--      registro: um registro, no máximo uma missão). O horário é o do
--      servidor (app.registros_recebidos): o aluno pode alterar
--      criado_em e disciplina_codigo do próprio registro (RLS + grant).
--   4. Sem transbordo: o excedente do registro que fecha não passa adiante.
--   5. Volume e acurácia só sobre os registros da missão, e só registros
--      com acerto informado contam (o furo dos 69 + 1).
--   6. Apagar ou editar registro vinculado refaz a matéria a partir da
--      missão dele: missão que deixa de bater volta a "em andamento" e o
--      XP dela vira 'estornado'; as que começaram depois são refeitas
--      com os mesmos registros, na ordem de recebimento. As anteriores
--      não mudam.
--   7. Ledger: uma linha por aluno e missão, a chave de sempre
--      ('missao_motor:<aluno>:<missao>'). Concluir = 'valido'; desfazer =
--      'estornado'; concluir de novo volta a MESMA linha a 'valido'
--      (histórico na metadata). Índice único parcial: no máximo um evento
--      válido por aluno e missão.
--   8. Missão concluída antes desta migration fica concluída, com o XP
--      intacto, marcada 'legado', e nunca é recalculada. Linha antiga em
--      andamento (somava o histórico inteiro) sai: a missão recomeça pela
--      regra nova no próximo registro.
--   9. Concorrência: trava por aluno e matéria na transação + índice
--      único parcial "uma em andamento por aluno e matéria".
--  10. Nível, conquistas e o motor C0 não mudam. Missão concluída que a
--      escola desativa fica como está (congelada).
--   Falha do motor: além do WARNING, vira ocorrência no coletor da 0059
--   (origem 'banco:<função>', só o SQLSTATE, sem dado de aluno) e pede o
--   despacho do e-mail à Edge Function registrar-erro pelo pg_net, com a
--   URL do projeto no Vault ('project_url').
--
-- Também nesta migration: a Física da EsPCEx no catálogo passa a ter o
-- avançado por último (Eletricidade 6, Termologia 7, Mecânica 8), igual
-- à seed 20 regenerada.
--
-- Só cria e altera para mais; nada é removido. ROLLBACK no fim.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Catálogo: Física da EsPCEx com o avançado por último
-- ------------------------------------------------------------
with nova (id, ordem) as (values
  ('f5d04e14-2524-4445-87a1-ec9d1da20876'::uuid, 6),   -- Eletricidade fechada (intermediário)
  ('13569d25-7007-40d3-8772-c485089abd2c'::uuid, 7),   -- Termologia sem surpresa (intermediário)
  ('e79d814f-897a-498f-8fe4-a1ac8442307c'::uuid, 8))   -- Mecânica sob tempo (avançado)
update missoes m set ordem = n.ordem
  from nova n where m.id = n.id and m.exam_tag = 'espcex';

with nova (id, ordem) as (values
  ('f5d04e14-2524-4445-87a1-ec9d1da20876'::uuid, 6),
  ('13569d25-7007-40d3-8772-c485089abd2c'::uuid, 7),
  ('e79d814f-897a-498f-8fe4-a1ac8442307c'::uuid, 8))
update trilha_plano_missoes tpm
   set ordem = n.ordem,
       semana_sugerida = case when tp.tipo = 'reta_final' then 8 else 1 + (n.ordem % 9) end
  from nova n, trilha_planos tp
 where tpm.missao_id = n.id and tp.id = tpm.plano_id and tp.exam_tag = 'espcex';

-- ------------------------------------------------------------
-- 1) aluno_missoes: o que a fila precisa
-- ------------------------------------------------------------
alter table aluno_missoes
  add column if not exists materia_codigo text references materias (codigo),
  add column if not exists iniciada_em    timestamptz,
  add column if not exists regra          text not null default 'sequencial'
                                          check (regra in ('legado', 'sequencial')),
  add column if not exists meta_questoes  int check (meta_questoes is null or meta_questoes > 0),
  add column if not exists meta_acuracia  int check (meta_acuracia is null or meta_acuracia between 0 and 100);

update aluno_missoes am set materia_codigo = m.materia_codigo
  from missoes m where m.id = am.missao_id and am.materia_codigo is null;

-- Linhas da regra antiga (sem iniciada_em): concluída vira legado, com o
-- XP intacto; em andamento sai (era o somatório de todo o histórico, e
-- não carrega XP). Idempotente: linha da regra nova sempre tem iniciada_em.
update aluno_missoes set regra = 'legado'
 where iniciada_em is null and estado = 'concluida' and regra <> 'legado';
delete from aluno_missoes
 where iniciada_em is null and estado = 'em_andamento' and regra = 'sequencial';

create unique index if not exists uq_aluno_missoes_uma_em_andamento
  on aluno_missoes (aluno_id, materia_codigo) where estado = 'em_andamento';

-- no máximo um evento válido de missão do motor por aluno e missão
create unique index if not exists uq_evprog_missao_motor_valida
  on aluno_eventos_progresso (aluno_id, referencia_id)
  where tipo_evento = 'missao_concluida' and origem = 'motor_missao' and status = 'valido';

-- ------------------------------------------------------------
-- 2) Horário de recebimento do registro, do servidor. O gatilho tem nome
--    que ordena antes de trg_ped1_registro (gatilhos AFTER do mesmo
--    evento disparam em ordem alfabética): quando o motor roda, o
--    horário do registro novo já existe. Registro sem linha aqui
--    (anterior a esta migration ou da semeadura) nunca conta para missão.
-- ------------------------------------------------------------
-- clock_timestamp(), não now(): dentro de uma transação now() é o mesmo
-- para todos os registros, e a ordem de chegada de um lote se perderia.
create table if not exists app.registros_recebidos (
  registro_id uuid primary key references registros_estudo (id) on delete cascade,
  recebido_em timestamptz not null default clock_timestamp()
);

create or replace function app.registrar_recebimento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if app.motor_semeando() then return new; end if;
  insert into app.registros_recebidos (registro_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_missao_recebido on registros_estudo;
create trigger trg_missao_recebido
  after insert on registros_estudo
  for each row execute function app.registrar_recebimento();

-- ------------------------------------------------------------
-- 3) Vínculo registro → missão. Sem FK para registros_estudo de
--    propósito: no AFTER DELETE do registro o motor ainda precisa ler o
--    vínculo para saber qual missão refazer (uma FK em cascata o apagaria
--    antes). Quem limpa é o próprio motor. Some com a missão (cascata).
-- ------------------------------------------------------------
create table if not exists app.missao_registros (
  registro_id     uuid primary key,
  aluno_missao_id uuid not null references aluno_missoes (id) on delete cascade,
  vinculado_em    timestamptz not null default now()
);
create index if not exists idx_missao_registros_missao on app.missao_registros (aluno_missao_id);

revoke all on table app.registros_recebidos, app.missao_registros from public, anon, authenticated;
grant select, insert, update, delete on table app.registros_recebidos, app.missao_registros to service_role;
alter table app.registros_recebidos enable row level security;
alter table app.missao_registros    enable row level security;

-- ------------------------------------------------------------
-- 4) Falha de servidor no coletor da 0059 (sem dado de aluno) e pedido
--    de despacho do e-mail. O e-mail reservado no banco fica com
--    fila = true; a Edge Function registrar-erro, chamada pelo pg_net
--    com ?despachar=1 (ou no próximo relato do front), envia e marca.
-- ------------------------------------------------------------
alter table app.erros_emails add column if not exists fila boolean not null default false;

create or replace function app.relatar_falha_servidor(p_funcao text, p_sqlstate text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_origem text := left('banco:' || coalesce(p_funcao, 'desconhecida'), 60);
  v_r      jsonb;
  v_url    text;
begin
  v_r := public.coletor_registrar_erro(
    v_origem,
    md5(v_origem || '|' || coalesce(p_sqlstate, '')),
    pg_catalog.jsonb_build_object(
      'origem', v_origem,
      'mensagem', 'falha em ' || coalesce(p_funcao, '?') || ' (SQLSTATE ' || coalesce(p_sqlstate, '?')
                  || '); o registro do aluno foi gravado, o detalhe está no log do Postgres',
      'papel', 'servidor'),
    true);
  if not coalesce((v_r ->> 'enviar_email')::boolean, false) then return; end if;

  update app.erros_emails set fila = true where id = (v_r ->> 'email_id')::bigint;

  if to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'net' and p.proname = 'http_post') then
    return;  -- fica na fila; o próximo relato do front despacha
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s
   where s.name = 'project_url' order by s.created_at desc limit 1;
  v_url := btrim(coalesce(v_url, ''));
  if v_url !~ '^https?://[^[:space:]]+$' then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/registrar-erro?despachar=1',
    body := '{}'::jsonb,
    timeout_milliseconds := 10000);
exception when others then
  raise warning 'relatar_falha_servidor(%): %', p_funcao, sqlerrm;
end $$;

-- Pega até p_limite e-mails reservados pelo banco (fila = true) e devolve
-- o que a função precisa para montar cada um. Tirar da fila na mesma
-- transação evita que dois despachos mandem o mesmo e-mail.
create or replace function public.coletor_despachar_pendentes(p_limite int default 10)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  with alvo as (
    select e.id from app.erros_emails e
     where e.situacao = 'reservado' and e.fila
     order by e.id
     for update skip locked
     limit greatest(1, least(coalesce(p_limite, 10), 20))
  ), tirados as (
    update app.erros_emails e set fila = false
      from alvo where e.id = alvo.id
    returning e.id, e.fingerprint
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'email_id', t.id, 'fingerprint', g.fingerprint, 'ocorrencias', g.ocorrencias,
           'primeira_em', g.primeira_em, 'resultado', 'registrado',
           'evento', pg_catalog.jsonb_build_object(
             'origem', g.origem, 'mensagem', g.mensagem, 'pilha', null, 'componente', null,
             'rota', o.rota, 'release', o.release, 'papel', coalesce(o.papel, 'servidor'),
             'correlation_id', o.correlation_id))), '[]'::jsonb)
    into v
    from tirados t
    join app.erros_grupos g on g.fingerprint = t.fingerprint
    left join lateral (
      select x.rota, x.release, x.papel, x.correlation_id from app.erros_ocorrencias x
       where x.fingerprint = t.fingerprint order by x.criado_em desc limit 1) o on true;
  return v;
end $$;

-- ------------------------------------------------------------
-- 5) A fila de missões automáticas de um aluno numa matéria
-- ------------------------------------------------------------
create or replace function app.missoes_fila(p_aluno uuid, p_materia text)
returns table (missao_id uuid, posicao int, meta_questoes int, meta_acuracia int, xp int)
language sql stable security definer set search_path = '' as $$
  select m.id,
         (row_number() over (order by m.ordem, m.id))::int,
         coalesce(me.qtd_questoes, m.meta_questoes),
         coalesce(m.meta_acuracia, 0),
         coalesce(me.xp, m.xp_sugerido, 0)
    from public.alunos a
    join public.concursos c on c.id = a.concurso_id
    join public.missoes m on m.exam_tag = c.codigo and m.materia_codigo = p_materia
    left join public.missoes_escola me on me.missao_id = m.id and me.escola_id = a.escola_id
   where a.id = p_aluno
     and coalesce(me.ativa, true)
     and coalesce(me.qtd_questoes, m.meta_questoes) > 0
   order by m.ordem, m.id
$$;

-- ------------------------------------------------------------
-- 6) O coração: refaz a distribuição dos registros de UMA matéria.
--    p_desde (aluno_missoes.id): refaz essa missão e as iniciadas depois
--      dela; as anteriores ficam como estão.
--    sem p_desde: refaz só a em andamento (caminho do registro novo).
--    p_novo: registro candidato que ainda não tem vínculo (novo, ou
--      editado e sem vínculo); entra se foi recebido a partir do início
--      da primeira missão refeita (ou nesta transação, se não há missão
--      em andamento: começa a fila).
-- ------------------------------------------------------------
create or replace function app.missoes_reprocessar(
  p_aluno uuid, p_materia text, p_desde uuid default null, p_novo uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_escola    uuid;
  v_exam      text;
  v_desde_em  timestamptz;
  v_desde_row public.aluno_missoes;
  v_refazer   uuid[] := '{}';   -- aluno_missoes.id refeitas (na ordem em que foram iniciadas)
  v_antes     jsonb := '{}';    -- missao_id -> estado anterior
  v_ordem     uuid[] := '{}';   -- missão a receber registros, em ordem
  v_meta_q    int[]  := '{}';
  v_meta_a    int[]  := '{}';
  v_xp        int[]  := '{}';
  v_recebeu   uuid[] := '{}';   -- missões que receberam ao menos um registro
  v_i         int := 0;
  v_atual     int := 0;         -- índice em v_ordem da missão que está recebendo
  v_q         int := 0;
  v_a         int := 0;
  v_inicio    timestamptz;
  r           record;
  f           record;
  -- resultado, por posição em v_ordem
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

  -- refeitas: sequenciais da matéria iniciadas a partir de v_desde_em,
  -- menos as concluídas que saíram da fila (congeladas: "o que concluiu fica")
  select coalesce(array_agg(am.id order by am.iniciada_em, am.id), '{}'),
         coalesce(jsonb_object_agg(am.missao_id::text, am.estado), '{}')
    into v_refazer, v_antes
    from public.aluno_missoes am
   where v_desde_em is not null
     and am.aluno_id = p_aluno and am.materia_codigo = p_materia and am.regra = 'sequencial'
     and am.iniciada_em >= v_desde_em
     and not (am.estado = 'concluida'
              and am.missao_id not in (select q.missao_id from app.missoes_fila(p_aluno, p_materia) q));

  -- (b) ordem de distribuição: as refeitas na ordem em que começaram (se
  --     ainda estão na fila), depois as da fila que o aluno nunca começou
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

  -- (c) distribui os registros, na ordem em que o servidor os recebeu
  for r in
    select re.id, re.questoes, re.acertos, rr.recebido_em
      from public.registros_estudo re
      join app.registros_recebidos rr on rr.registro_id = re.id
     where re.aluno_id = p_aluno and re.disciplina_codigo = p_materia and re.acertos is not null
       and (re.id in (select mr.registro_id from app.missao_registros mr
                       where mr.aluno_missao_id = any (v_refazer))
            or (re.id = p_novo
                and not exists (select 1 from app.missao_registros mr where mr.registro_id = re.id)
                and rr.recebido_em >= coalesce(v_desde_em, now())))
     order by rr.recebido_em, re.id
  loop
    if v_atual = 0 then
      v_i := v_i + 1;
      exit when v_i > coalesce(array_length(v_ordem, 1), 0);   -- fila acabou: o resto não conta
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

  -- (d) grava: vínculos das refeitas saem e entram os novos
  delete from app.missao_registros where aluno_missao_id = any (v_refazer);
  if p_novo is not null then delete from app.missao_registros where registro_id = p_novo; end if;

  -- missões refeitas que não receberam registro: deixam de existir para o
  -- aluno (voltam a ser "a seguir"); se estavam concluídas, estorno abaixo
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
      -- XP no ledger do C0: mesma linha por aluno e missão; volta a valer
      -- se já tinha sido estornada (histórico na metadata)
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

-- ------------------------------------------------------------
-- 7) Aplica um registro inserido, alterado ou apagado. Falha nunca
--    derruba o registro: vira ocorrência no coletor e WARNING.
-- ------------------------------------------------------------
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
     and not exists (select 1 from app.missao_registros where registro_id = (p_new).id) then
    perform app.missoes_reprocessar((p_new).aluno_id, (p_new).disciplina_codigo, null, (p_new).id);
  end if;
exception when others then
  get stacked diagnostics v_estado = returned_sqlstate;
  perform app.relatar_falha_servidor('motor_missoes', v_estado);
  raise warning 'motor de missões falhou (SQLSTATE %): %', v_estado, sqlerrm;
end $$;

-- Reavalia as missões em andamento do aluno (operador ou motor_avaliar_aluno):
-- sem registro novo, só recalcula o que já está vinculado. Idempotente.
create or replace function app.missoes_reavaliar_aluno(p_aluno uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select am.materia_codigo from public.aluno_missoes am
            where am.aluno_id = p_aluno and am.estado = 'em_andamento' and am.regra = 'sequencial' loop
    perform app.missoes_reprocessar(p_aluno, r.materia_codigo, null, null);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 8) Motor da PED1 (0033) sem o laço de missões: nível e conquistas
--    seguem iguais. A falha também vai ao coletor.
-- ------------------------------------------------------------
create or replace function app.motor_avaliar_aluno(p_aluno uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_escola uuid;
  v_exam   text;
  v_streak int;
  v_estado text;
  r        record;
begin
  select escola_id into v_escola from alunos where id = p_aluno;
  v_exam := app.exam_tag_do_aluno(p_aluno);
  if v_escola is null or v_exam is null then return; end if;

  -- ----- MISSÕES: regra sequencial (0061); aqui só reavalia a em andamento -----
  perform app.missoes_reavaliar_aluno(p_aluno);

  -- ----- NÍVEL por matéria (calculado), nunca sobre 'manual' (igual à 0033) -----
  for r in
    select re.disciplina_codigo as materia,
           sum(questoes)::int as q,
           case when sum(questoes) filter (where acertos is not null) > 0
                then round(100.0 * sum(acertos) filter (where acertos is not null)
                           / sum(questoes) filter (where acertos is not null))::int end as acc
    from registros_estudo re
    where re.aluno_id = p_aluno
    group by re.disciplina_codigo
  loop
    if r.q >= 20 and r.acc is not null then
      insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem, motivo)
      values (
        v_escola, p_aluno, r.materia,
        case when r.acc < 40 then 'base'
             when r.acc >= 70 and r.q >= 100 then 'avancado'
             else 'intermediario' end,
        'calculado', 'recalculado pelo motor de progresso (PED1)'
      )
      on conflict (aluno_id, escopo) do update
        set nivel = excluded.nivel, origem = 'calculado', motivo = excluded.motivo, atualizado_em = now()
        where aluno_niveis.origem in ('calculado', 'validar');
    end if;
  end loop;

  -- ----- CONQUISTAS data-driven (igual à 0033; escrita desligada na 0037) -----
  v_streak := app.motor_streak_dias(p_aluno);
  for r in select codigo, criterio from conquistas where tipo = 'constancia' and criterio ? 'dias' loop
    if v_streak >= coalesce((r.criterio->>'dias')::int, 2147483647) then
      perform app.motor_conquista_xp(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

  for r in select codigo, criterio from conquistas where tipo = 'volume' loop
    if exists (
      select 1 from registros_estudo re
      where re.aluno_id = p_aluno and re.data >= (current_date - 30)
      having coalesce(sum(questoes), 0) >= coalesce((r.criterio->>'questoes')::int, 2147483647)
         and (sum(questoes) filter (where acertos is not null) = 0
              or round(100.0 * coalesce(sum(acertos) filter (where acertos is not null), 0)
                       / nullif(sum(questoes) filter (where acertos is not null), 0))
                 >= coalesce((r.criterio->>'acuracia_min')::int, 0))
    ) then
      perform app.motor_conquista_xp(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

  for r in select codigo, criterio from conquistas where tipo in ('materia', 'alavancagem') and criterio ? 'materia' loop
    if exists (
      select 1 from registros_estudo re
      where re.aluno_id = p_aluno and re.disciplina_codigo = (r.criterio->>'materia') and re.acertos is not null
      group by re.disciplina_codigo
      having sum(questoes) >= 20
         and round(100.0 * sum(acertos) / nullif(sum(questoes), 0)) >= coalesce((r.criterio->>'acuracia_min')::int, 2147483647)
    ) then
      perform app.motor_conquista_xp(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

exception when others then
  get stacked diagnostics v_estado = returned_sqlstate;
  perform app.relatar_falha_servidor('motor_avaliar_aluno', v_estado);
  raise warning 'motor_avaliar_aluno(%) [PED1] falhou: %', p_aluno, sqlerrm;
end $$;

-- O gatilho da PED1 passa o registro ao motor de missões e depois roda
-- nível e conquistas, como antes. Para na semeadura, como antes.
create or replace function app.trg_ped1_registro() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if app.motor_semeando() then return coalesce(new, old); end if;
  perform app.missoes_aplicar(tg_op, old, new);
  perform app.motor_avaliar_aluno(coalesce(new.aluno_id, old.aluno_id));
  return coalesce(new, old);
end $$;

-- ------------------------------------------------------------
-- 9) Quem executa: ninguém com token de usuário (classe c/d/s da C-S06)
-- ------------------------------------------------------------
revoke all on function app.registrar_recebimento() from public, anon, authenticated;
revoke all on function app.relatar_falha_servidor(text, text) from public, anon, authenticated;
revoke all on function public.coletor_despachar_pendentes(int) from public, anon, authenticated;
revoke all on function app.missoes_fila(uuid, text) from public, anon, authenticated;
revoke all on function app.missoes_reprocessar(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function app.missoes_aplicar(text, public.registros_estudo, public.registros_estudo) from public, anon, authenticated;
revoke all on function app.missoes_reavaliar_aluno(uuid) from public, anon, authenticated;
grant execute on function public.coletor_despachar_pendentes(int) to service_role;
grant execute on function app.relatar_falha_servidor(text, text) to service_role;
grant execute on function app.missoes_fila(uuid, text) to service_role;
grant execute on function app.missoes_reprocessar(uuid, text, uuid, uuid) to service_role;
grant execute on function app.missoes_aplicar(text, public.registros_estudo, public.registros_estudo) to service_role;
grant execute on function app.missoes_reavaliar_aluno(uuid) to service_role;
-- motor_avaliar_aluno e trg_ped1_registro: o create or replace mantém os
-- privilégios da 0057 (só service_role / ninguém)

comment on table app.missao_registros is
  '0061: vínculo registro → missão (um registro, no máximo uma missão). Escrito só pelo motor.';
comment on table app.registros_recebidos is
  '0061: horário do servidor em que o registro chegou (o aluno edita criado_em; este não).';

-- ============================================================
-- ROLLBACK (manual; volta ao motor da 0033)
--   recriar app.motor_avaliar_aluno e app.trg_ped1_registro com os
--   corpos da 0033;
--   drop trigger trg_missao_recebido on registros_estudo;
--   drop function app.missoes_aplicar(text, public.registros_estudo, public.registros_estudo),
--     app.missoes_reavaliar_aluno(uuid), app.missoes_reprocessar(uuid, text, uuid, uuid),
--     app.missoes_fila(uuid, text), app.registrar_recebimento(),
--     app.relatar_falha_servidor(text, text), public.coletor_despachar_pendentes(int);
--   drop table app.missao_registros, app.registros_recebidos;
--   drop index uq_aluno_missoes_uma_em_andamento, uq_evprog_missao_motor_valida;
--   (as colunas novas de aluno_missoes e app.erros_emails.fila podem ficar)
--   Física EsPCEx: ordem 6 Mecânica, 7 Eletricidade, 8 Termologia.
-- O XP concedido pela regra nova fica no ledger (append-only).
-- ============================================================
