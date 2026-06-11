-- ============================================================
-- 0003 — MOTOR DE ESTUDO (servidor) + LGPD
-- ------------------------------------------------------------
-- A virada de semana é REGRA SAGRADA preservada da versão atual:
--   - por data LOCAL (America/Sao_Paulo), vira à meia-noite do Brasil;
--   - semana ativa = aquela cujo intervalo [inicio, fim] contém hoje
--     (limites INCLUSIVOS, igual ao currentWeek() do App.jsx);
--   - antes da 1ª semana, vale a 1ª; depois da última, vale a última.
-- Roda no servidor, agendada (0004) — não depende de o aluno abrir o app.
--
-- Estas funções NÃO são executáveis pelo usuário logado: só o
-- servidor (service role / cron) chama. A coordenação não gera
-- meta; o aluno não gera meta. O motor gera.
-- ============================================================

create or replace function app.hoje_local() returns date
language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Semana da trilha correspondente a uma data (espelho exato do
-- currentWeek() da versão atual).
create or replace function app.semana_da_data(p_trilha uuid, p_data date)
returns trilha_semanas
language plpgsql stable security definer set search_path = public, app as $$
declare
  s trilha_semanas;
begin
  select * into s from trilha_semanas
    where trilha_id = p_trilha and inicio <= p_data and fim >= p_data
    order by numero limit 1;
  if found then return s; end if;

  select * into s from trilha_semanas where trilha_id = p_trilha order by numero limit 1;
  if not found then
    raise exception 'trilha % sem semanas', p_trilha;
  end if;
  if p_data < s.inicio then return s; end if;          -- antes da 1ª: vale a 1ª

  select * into s from trilha_semanas where trilha_id = p_trilha order by numero desc limit 1;
  return s;                                            -- depois da última: vale a última
end $$;

-- Gera (idempotente) a meta de um aluno para a semana que cobre
-- p_hoje. Se a meta daquela semana já existe, devolve a existente
-- sem tocar em nada — rodar duas vezes não duplica.
create or replace function app.gerar_meta(p_aluno uuid, p_hoje date default null)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_hoje    date := coalesce(p_hoje, app.hoje_local());
  v_aluno   alunos;
  v_semana  trilha_semanas;
  v_meta_id uuid;
begin
  select * into v_aluno from alunos where id = p_aluno;
  if not found then raise exception 'aluno % não existe', p_aluno; end if;
  if v_aluno.trilha_id is null then raise exception 'aluno % sem trilha', p_aluno; end if;

  v_semana := app.semana_da_data(v_aluno.trilha_id, v_hoje);

  select id into v_meta_id from metas
    where aluno_id = p_aluno and trilha_id = v_aluno.trilha_id and semana_numero = v_semana.numero;
  if found then return v_meta_id; end if;

  insert into metas (escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
    values (v_aluno.escola_id, p_aluno, v_aluno.trilha_id, v_semana.numero,
            v_semana.inicio, v_semana.fim,
            case when v_hoje <= v_semana.fim then 'ativa' else 'fechada' end)
    returning id into v_meta_id;

  insert into meta_atividades (escola_id, meta_id, atividade_modelo_id)
    select v_aluno.escola_id, v_meta_id, am.id
    from atividades_modelo am
    where am.trilha_id = v_aluno.trilha_id and am.semana_numero = v_semana.numero
    order by am.ordem;

  return v_meta_id;
end $$;

-- A virada: fecha metas vencidas e garante a meta da semana
-- corrente para todo aluno com trilha. Agendada por dia (0004);
-- aceita uma data explícita para teste.
create or replace function app.virar_semana(p_hoje date default null)
returns table (metas_fechadas int, metas_geradas int)
language plpgsql security definer set search_path = public, app as $$
declare
  v_hoje     date := coalesce(p_hoje, app.hoje_local());
  v_fechadas int;
  v_geradas  int := 0;
  r record;
begin
  -- fecha o que venceu (fim < hoje, limites inclusivos preservados)
  update metas set status = 'fechada' where status = 'ativa' and fim < v_hoje;
  get diagnostics v_fechadas = row_count;

  -- gera a meta corrente de quem ainda não tem
  for r in
    select a.id from alunos a
    where a.trilha_id is not null
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

-- ============================================================
-- LGPD — pedidos do titular (Doc 6, 4.6). Exportar e apagar têm
-- que funcionar DE VERDADE. Só o servidor executa (a Edge Function
-- lgpd-titular valida que quem pede é a coordenação da escola).
-- ============================================================

create or replace function app.lgpd_exportar(p_aluno uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'gerado_em', now(),
    'aluno', to_jsonb(a) - 'usuario_id',
    'turmas', coalesce((select jsonb_agg(t.nome) from alunos_turmas at_
                        join turmas t on t.id = at_.turma_id where at_.aluno_id = a.id), '[]'::jsonb),
    'metas', coalesce((select jsonb_agg(to_jsonb(m) order by m.semana_numero) from metas m where m.aluno_id = a.id), '[]'::jsonb),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object(
                        'meta_id', ma.meta_id, 'atividade', am.texto, 'estado', ma.estado))
                        from meta_atividades ma
                        join metas m on m.id = ma.meta_id
                        join atividades_modelo am on am.id = ma.atividade_modelo_id
                        where m.aluno_id = a.id), '[]'::jsonb),
    'registros_estudo', coalesce((select jsonb_agg(to_jsonb(r) order by r.data) from registros_estudo r where r.aluno_id = a.id), '[]'::jsonb),
    'simulados', coalesce((select jsonb_agg(to_jsonb(s) order by s.data) from simulados s where s.aluno_id = a.id), '[]'::jsonb),
    'consentimentos', coalesce((select jsonb_agg(to_jsonb(c)) from consentimentos c where c.aluno_id = a.id), '[]'::jsonb),
    'logs_acesso', coalesce((select jsonb_agg(to_jsonb(l) order by l.em) from logs_acesso l where l.aluno_id = a.id), '[]'::jsonb)
  ) into v
  from alunos a where a.id = p_aluno;

  if v is null then raise exception 'aluno % não existe', p_aluno; end if;
  return v;
end $$;

-- Apaga o dado do aluno. Devolve os ids de usuário (aluno e
-- responsáveis que ficaram sem nenhum vínculo) para a Edge Function
-- remover também as contas no Auth. O log de acesso fica: é trilha
-- de auditoria da escola, não dado de estudo do menor.
create or replace function app.lgpd_excluir(p_aluno uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_aluno alunos;
  v_usuarios uuid[] := '{}';
  r record;
begin
  select * into v_aluno from alunos where id = p_aluno;
  if not found then raise exception 'aluno % não existe', p_aluno; end if;

  if v_aluno.usuario_id is not null then
    v_usuarios := v_usuarios || v_aluno.usuario_id;
  end if;

  -- responsáveis cujo ÚNICO vínculo é este aluno perdem a conta junto
  for r in
    select v.responsavel_id from vinculos_responsaveis v
    where v.aluno_id = p_aluno
      and not exists (select 1 from vinculos_responsaveis v2
                      where v2.responsavel_id = v.responsavel_id and v2.aluno_id <> p_aluno)
  loop
    v_usuarios := v_usuarios || r.responsavel_id;
  end loop;

  -- cascata: metas, meta_atividades, registros, simulados, vínculos,
  -- consentimentos e alunos_turmas caem com o aluno (FKs on delete cascade)
  delete from alunos where id = p_aluno;
  delete from usuarios where id = any (v_usuarios);

  return jsonb_build_object('aluno_id', p_aluno, 'usuarios_removidos', to_jsonb(v_usuarios));
end $$;

-- Nada disso é executável pelo usuário comum: revoga tudo e
-- concede só ao service_role (o "cofre" — Doc 5).
revoke all on function app.semana_da_data(uuid, date),
              app.gerar_meta(uuid, date),
              app.virar_semana(date),
              app.lgpd_exportar(uuid),
              app.lgpd_excluir(uuid)
  from public, authenticated, anon;

grant execute on function app.hoje_local() to authenticated, service_role;
grant execute on function app.semana_da_data(uuid, date),
                  app.gerar_meta(uuid, date),
                  app.virar_semana(date),
                  app.lgpd_exportar(uuid),
                  app.lgpd_excluir(uuid)
  to service_role;
