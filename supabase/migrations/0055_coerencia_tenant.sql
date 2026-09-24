-- ============================================================
-- 0055 — Linha ligada a aluno, turma, meta ou usuário é da MESMA escola
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono, pedida em prompt próprio (Etapa 2,
-- trava 3). Escrita e ensaiada só em Postgres local descartável.
-- URGÊNCIA: antes da SEGUNDA escola real. Com uma escola só não há
-- outro tenant para atingir; com duas, o furo abaixo vale.
-- NUMERAÇÃO: o roteiro da Etapa 2 reservava 0055 para a C-S04 e 0056
-- para os grants. Este achado apareceu na matriz de autorização (fatia
-- 2) e pede correção própria; a C-S04 e os grants andam uma casa.
-- DEPENDÊNCIA: nenhuma além da 0054. Não reescreve função nova de ciclo.
--
-- O ACHADO (matriz de autorização, Etapa 2, 24/09/2026)
--   As policies de escrita conferem `escola_id = tenant` NA LINHA, mas as
--   FKs (`aluno_id`, `turma_id`, `meta_id`, `usuario_id`,
--   `responsavel_id`) apontam só para o `id`. FK não passa por RLS.
--   Então a coordenação da escola A grava, na própria escola, uma linha
--   que aponta para aluno, turma ou conta da escola B. Provado em banco
--   local, cada caso numa transação desfeita:
--
--   1. EXCLUSÃO DE CONTA ENTRE ESCOLAS. A aponta o usuario_id de um aluno
--      seu (alunos_update só confere a escola do aluno) ou um vínculo de
--      responsável para a conta da coordenação de B, e pede a exclusão
--      LGPD desse aluno. lgpd_usuarios_do_aluno devolve a conta de B, e a
--      Edge Function lgpd-titular apaga essa conta no Auth e no banco.
--   2. LEITURA ENTRE ESCOLAS. A planta aluno_onboarding para o aluno B1
--      (PK aluno_id). Quando B1 responde o onboarding, o upsert de
--      salvar_onboarding_aluno cai na linha de A: A lê as respostas de
--      B1 e a coordenação de B não vê nada.
--   3. LEITURA ENTRE ESCOLAS PELA EXPORTAÇÃO LGPD. A matricula um aluno
--      seu numa turma de B; lgpd_exportar junta turmas só por aluno_id
--      e devolve o nome da turma de B. Pelo mesmo caminho, linhas que A
--      planta apontando para B1 (consentimento, log de acesso) entram
--      na exportação LGPD que B fizer do próprio aluno.
--
--   Todos exigem conhecer o UUID de algo da outra escola, que a API não
--   entrega (a RLS não deixa ler). É condição, não defesa: UUID vaza por
--   print, suporte, log, planilha.
--
-- O QUE MUDA
--   (a) Unique (id, escola_id) em alunos, usuarios, turmas e metas: é o
--       alvo que a FK composta precisa. Não muda nada do que já existe
--       (id já é único).
--   (b) FK composta (filho.pai_id, filho.escola_id) → pai (id, escola_id)
--       em toda tabela que liga linha de uma escola a aluno, turma, meta
--       ou usuário. O banco passa a recusar a linha cruzada para
--       QUALQUER escritor, inclusive service_role e SECURITY DEFINER.
--       Mesmo ON DELETE da FK simples que já existia (cascade, ou set
--       null só em alunos.usuario_id). As FKs simples ficam.
--   (c) Defesa em profundidade nas funções LGPD: as contas que caem são
--       só as da MESMA escola do aluno e do papel certo (aluno para
--       usuario_id, responsável para vínculo); a exportação filtra por
--       escola em tudo o que junta, inclusive logs_acesso.
--   (d) logs_insert: o log de acesso só aponta para aluno da mesma escola
--       que o usuário enxerga.
--
-- O QUE FICA DE FORA, DE PROPÓSITO
--   logs_acesso e aluno_nivel_historico não têm FK para aluno: são
--   registro que sobrevive à exclusão do aluno (0001, linha 220). Não
--   ganham FK composta; logs_acesso é tratado em (c) e (d), e
--   aluno_nivel_historico só é escrito pelo gatilho de aluno_niveis, que
--   com (b) já nasce coerente.
--
-- PRÉ-CONDIÇÃO MEDIDA (24/09/2026, só leitura, demo e produção)
--   Zero linhas violariam as FKs novas nos dois ambientes; zero vínculos
--   com conta que não é de responsável; zero alunos com conta que não é
--   de aluno. A aplicação valida as constraints e passa. (No demo há 1
--   log de acesso de aluno já excluído: esperado, logs_acesso não ganha
--   FK.)
--
-- ROLLBACK
--   drop das constraints *_mesma_escola_fkey e *_id_escola_key; reaplicar
--   app.lgpd_exportar (0003), app.lgpd_usuarios_do_aluno e app.lgpd_excluir
--   (0036) e a policy logs_insert (0002). Nenhum dado é alterado.
-- ============================================================

-- (a) alvos das FKs compostas
alter table alunos   add constraint alunos_id_escola_key   unique (id, escola_id);
alter table usuarios add constraint usuarios_id_escola_key unique (id, escola_id);
alter table turmas   add constraint turmas_id_escola_key   unique (id, escola_id);
alter table metas    add constraint metas_id_escola_key    unique (id, escola_id);

-- (b) filho e pai na mesma escola
alter table metas add constraint metas_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table meta_atividades add constraint meta_atividades_meta_mesma_escola_fkey
  foreign key (meta_id, escola_id) references metas (id, escola_id) on delete cascade;
alter table registros_estudo add constraint registros_estudo_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table simulados add constraint simulados_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table alunos_turmas add constraint alunos_turmas_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table alunos_turmas add constraint alunos_turmas_turma_mesma_escola_fkey
  foreign key (turma_id, escola_id) references turmas (id, escola_id) on delete cascade;
alter table vinculos_responsaveis add constraint vinculos_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table vinculos_responsaveis add constraint vinculos_responsavel_mesma_escola_fkey
  foreign key (responsavel_id, escola_id) references usuarios (id, escola_id) on delete cascade;
alter table consentimentos add constraint consentimentos_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table aluno_xp_eventos add constraint aluno_xp_eventos_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table aluno_conquistas add constraint aluno_conquistas_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table aluno_missoes add constraint aluno_missoes_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table aluno_niveis add constraint aluno_niveis_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table aluno_onboarding add constraint aluno_onboarding_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
alter table aluno_eventos_progresso add constraint aluno_eventos_progresso_aluno_mesma_escola_fkey
  foreign key (aluno_id, escola_id) references alunos (id, escola_id) on delete cascade;
-- conta do aluno: ao apagar a conta, só usuario_id vira nulo (escola_id é not null)
alter table alunos add constraint alunos_usuario_mesma_escola_fkey
  foreign key (usuario_id, escola_id) references usuarios (id, escola_id) on delete set null (usuario_id);

-- (c) LGPD: só contas da mesma escola e do papel certo; exportação filtrada por escola
create or replace function app.lgpd_usuarios_do_aluno(p_aluno uuid) returns uuid[]
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_aluno alunos;
  v_usuarios uuid[] := '{}';
  r record;
begin
  select * into v_aluno from alunos where id = p_aluno;
  if not found then raise exception 'aluno % não existe', p_aluno; end if;

  -- a conta do aluno só cai se for conta de ALUNO desta escola
  if v_aluno.usuario_id is not null and exists (
       select 1 from usuarios u
       where u.id = v_aluno.usuario_id and u.escola_id = v_aluno.escola_id and u.papel = 'aluno') then
    v_usuarios := v_usuarios || v_aluno.usuario_id;
  end if;

  -- responsáveis DESTA escola cujo ÚNICO vínculo é este aluno perdem a conta junto
  for r in
    select v.responsavel_id from vinculos_responsaveis v
    join usuarios u on u.id = v.responsavel_id
    where v.aluno_id = p_aluno
      and u.escola_id = v_aluno.escola_id and u.papel = 'responsavel'
      and not exists (select 1 from vinculos_responsaveis v2
                      where v2.responsavel_id = v.responsavel_id and v2.aluno_id <> p_aluno)
  loop
    v_usuarios := v_usuarios || r.responsavel_id;
  end loop;

  return v_usuarios;
end $$;

-- a exclusão usa a MESMA lista: uma regra só para quem cai no Auth e no banco
create or replace function app.lgpd_excluir(p_aluno uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_usuarios uuid[];
begin
  v_usuarios := app.lgpd_usuarios_do_aluno(p_aluno); -- levanta 'aluno não existe'

  -- cascata: metas, meta_atividades, registros, simulados, vínculos,
  -- consentimentos e alunos_turmas caem com o aluno (FKs on delete cascade)
  delete from alunos where id = p_aluno;
  delete from usuarios where id = any (v_usuarios);

  return jsonb_build_object('aluno_id', p_aluno, 'usuarios_removidos', to_jsonb(v_usuarios));
end $$;

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
                             where l.aluno_id = a.id and l.escola_id = a.escola_id), '[]'::jsonb)
  ) into v
  from alunos a where a.id = p_aluno;

  if v is null then raise exception 'aluno % não existe', p_aluno; end if;
  return v;
end $$;

-- (d) o log de acesso só aponta para aluno da mesma escola que o usuário enxerga.
-- A subconsulta roda como o usuário, com a RLS de alunos: coordenação vê os
-- alunos da escola; aluno, o próprio; responsável, o vinculado. Escola
-- suspensa não vê aluno nenhum, então também não grava log.
drop policy if exists logs_insert on logs_acesso;
create policy logs_insert on logs_acesso for insert to authenticated
  with check (
    escola_id = app.tenant_id() and usuario_id = app.usuario_id() and papel = app.papel()
    and exists (select 1 from alunos a where a.id = logs_acesso.aluno_id and a.escola_id = logs_acesso.escola_id)
  );
