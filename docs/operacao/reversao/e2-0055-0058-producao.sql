-- REVERSÃO de 0058, 0057, 0056 e 0055, gerada do estado de postgres em 2026-09-24 21:58:57.708691+00
-- Postgres 17.6
begin;
revoke all on public.escolas from authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.escolas to authenticated;
revoke all on function app.backfill_progresso(uuid) from public, anon, authenticated, service_role;
revoke all on function app.desbloquear_conquista_basica(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function app.estornar_progresso_de_origem() from public, anon, authenticated, service_role;
revoke all on function app.exam_tag_do_aluno(uuid) from public, anon, authenticated, service_role;
revoke all on function app.lgpd_excluir(uuid) from public, anon, authenticated, service_role;
revoke all on function app.lgpd_exportar(uuid) from public, anon, authenticated, service_role;
revoke all on function app.lgpd_usuarios_do_aluno(uuid) from public, anon, authenticated, service_role;
revoke all on function app.motor_avaliar_aluno(uuid) from public, anon, authenticated, service_role;
revoke all on function app.motor_conquista_xp(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function app.motor_streak_dias(uuid) from public, anon, authenticated, service_role;
revoke all on function app.progresso_de_missao() from public, anon, authenticated, service_role;
revoke all on function app.progresso_de_registro() from public, anon, authenticated, service_role;
revoke all on function app.progresso_de_simulado() from public, anon, authenticated, service_role;
revoke all on function app.registrar_nivel_historico() from public, anon, authenticated, service_role;
revoke all on function app.tenant_operacional() from public, anon, authenticated, service_role;
revoke all on function app.trg_ped1_registro() from public, anon, authenticated, service_role;
grant execute on function app.backfill_progresso(uuid) to public;
grant execute on function app.backfill_progresso(uuid) to service_role;
grant execute on function app.desbloquear_conquista_basica(uuid, uuid, text, text) to public;
grant execute on function app.estornar_progresso_de_origem() to public;
grant execute on function app.exam_tag_do_aluno(uuid) to public;
grant execute on function app.exam_tag_do_aluno(uuid) to authenticated;
grant execute on function app.exam_tag_do_aluno(uuid) to service_role;
grant execute on function app.lgpd_excluir(uuid) to service_role;
grant execute on function app.lgpd_exportar(uuid) to service_role;
grant execute on function app.lgpd_usuarios_do_aluno(uuid) to service_role;
grant execute on function app.motor_avaliar_aluno(uuid) to public;
grant execute on function app.motor_conquista_xp(uuid, uuid, text, text) to public;
grant execute on function app.motor_streak_dias(uuid) to public;
grant execute on function app.motor_streak_dias(uuid) to authenticated;
grant execute on function app.motor_streak_dias(uuid) to service_role;
grant execute on function app.progresso_de_missao() to public;
grant execute on function app.progresso_de_registro() to public;
grant execute on function app.progresso_de_simulado() to public;
grant execute on function app.registrar_nivel_historico() to public;
grant execute on function app.tenant_operacional() to public;
grant execute on function app.tenant_operacional() to authenticated;
grant execute on function app.tenant_operacional() to service_role;
grant execute on function app.trg_ped1_registro() to public;
CREATE OR REPLACE FUNCTION app.lgpd_excluir(p_aluno uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION app.lgpd_exportar(p_aluno uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION app.lgpd_usuarios_do_aluno(p_aluno uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
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

  return v_usuarios;
end $function$
;
CREATE OR REPLACE FUNCTION app.tenant_operacional()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
  select coalesce(
    (select e.status not in ('suspensa', 'cancelada')
       from escolas e where e.id = app.tenant_id()),
    true)
$function$
;
drop policy if exists aluno_missoes_coord_del on public.aluno_missoes;
drop policy if exists aluno_missoes_coord_ins on public.aluno_missoes;
drop policy if exists aluno_missoes_coord_upd on public.aluno_missoes;
drop policy if exists aluno_niveis_coord_del on public.aluno_niveis;
drop policy if exists aluno_niveis_coord_ins on public.aluno_niveis;
drop policy if exists aluno_niveis_coord_upd on public.aluno_niveis;
drop policy if exists aluno_onboarding_coord_del on public.aluno_onboarding;
drop policy if exists aluno_onboarding_coord_ins on public.aluno_onboarding;
drop policy if exists aluno_onboarding_coord_upd on public.aluno_onboarding;
drop policy if exists config_escola_coord_del on public.config_escola;
drop policy if exists config_escola_coord_ins on public.config_escola;
drop policy if exists config_escola_coord_upd on public.config_escola;
drop policy if exists conq_coord_del on public.aluno_conquistas;
drop policy if exists conq_coord_ins on public.aluno_conquistas;
drop policy if exists conq_coord_upd on public.aluno_conquistas;
drop policy if exists evprog_ajuste_coordenacao on public.aluno_eventos_progresso;
drop policy if exists logs_coordenacao_insert on public.logs_coordenacao;
drop policy if exists logs_insert on public.logs_acesso;
drop policy if exists missoes_escola_coord_del on public.missoes_escola;
drop policy if exists missoes_escola_coord_ins on public.missoes_escola;
drop policy if exists missoes_escola_coord_upd on public.missoes_escola;
drop policy if exists xp_coord_del on public.aluno_xp_eventos;
drop policy if exists xp_coord_ins on public.aluno_xp_eventos;
drop policy if exists xp_coord_upd on public.aluno_xp_eventos;
create policy aluno_missoes_coord_del on public.aluno_missoes as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_missoes_coord_ins on public.aluno_missoes as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_missoes_coord_upd on public.aluno_missoes as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_niveis_coord_del on public.aluno_niveis as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_niveis_coord_ins on public.aluno_niveis as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_niveis_coord_upd on public.aluno_niveis as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_onboarding_coord_del on public.aluno_onboarding as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_onboarding_coord_ins on public.aluno_onboarding as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy aluno_onboarding_coord_upd on public.aluno_onboarding as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy config_escola_coord_del on public.config_escola as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy config_escola_coord_ins on public.config_escola as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy config_escola_coord_upd on public.config_escola as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy conq_coord_del on public.aluno_conquistas as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy conq_coord_ins on public.aluno_conquistas as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy conq_coord_upd on public.aluno_conquistas as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy evprog_ajuste_coordenacao on public.aluno_eventos_progresso as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text) AND (tipo_evento = 'ajuste_coordenacao'::text)));
create policy logs_coordenacao_insert on public.logs_coordenacao as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (usuario_id = app.usuario_id()) AND (papel = app.papel()) AND (papel = 'coordenacao'::text)));
create policy logs_insert on public.logs_acesso as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (usuario_id = app.usuario_id()) AND (papel = app.papel())));
create policy missoes_escola_coord_del on public.missoes_escola as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy missoes_escola_coord_ins on public.missoes_escola as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy missoes_escola_coord_upd on public.missoes_escola as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy xp_coord_del on public.aluno_xp_eventos as PERMISSIVE for DELETE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy xp_coord_ins on public.aluno_xp_eventos as PERMISSIVE for INSERT to authenticated with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
create policy xp_coord_upd on public.aluno_xp_eventos as PERMISSIVE for UPDATE to authenticated using (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text))) with check (((escola_id = app.tenant_id()) AND (app.papel() = 'coordenacao'::text)));
alter table public.aluno_conquistas drop constraint if exists aluno_conquistas_aluno_mesma_escola_fkey;
alter table public.aluno_eventos_progresso drop constraint if exists aluno_eventos_progresso_aluno_mesma_escola_fkey;
alter table public.aluno_missoes drop constraint if exists aluno_missoes_aluno_mesma_escola_fkey;
alter table public.aluno_niveis drop constraint if exists aluno_niveis_aluno_mesma_escola_fkey;
alter table public.aluno_onboarding drop constraint if exists aluno_onboarding_aluno_mesma_escola_fkey;
alter table public.aluno_xp_eventos drop constraint if exists aluno_xp_eventos_aluno_mesma_escola_fkey;
alter table public.alunos drop constraint if exists alunos_usuario_mesma_escola_fkey;
alter table public.alunos_turmas drop constraint if exists alunos_turmas_aluno_mesma_escola_fkey;
alter table public.alunos_turmas drop constraint if exists alunos_turmas_turma_mesma_escola_fkey;
alter table public.consentimentos drop constraint if exists consentimentos_aluno_mesma_escola_fkey;
alter table public.meta_atividades drop constraint if exists meta_atividades_meta_mesma_escola_fkey;
alter table public.metas drop constraint if exists metas_aluno_mesma_escola_fkey;
alter table public.registros_estudo drop constraint if exists registros_estudo_aluno_mesma_escola_fkey;
alter table public.simulados drop constraint if exists simulados_aluno_mesma_escola_fkey;
alter table public.vinculos_responsaveis drop constraint if exists vinculos_aluno_mesma_escola_fkey;
alter table public.vinculos_responsaveis drop constraint if exists vinculos_responsavel_mesma_escola_fkey;
alter table public.alunos drop constraint if exists alunos_id_escola_key;
alter table public.metas drop constraint if exists metas_id_escola_key;
alter table public.turmas drop constraint if exists turmas_id_escola_key;
alter table public.usuarios drop constraint if exists usuarios_id_escola_key;
commit;


-- ------------------------------------------------------------
-- Ledger (só se a reversão for de fato executada): apagar as quatro
-- linhas que o apply_migration gravou, para o checador não acusar o
-- que já não está no banco.
--   delete from supabase_migrations.schema_migrations
--    where name in ('0055_coerencia_tenant', '0056_tenant_operacional_nega_por_padrao',
--                   '0057_revoga_execute_funcoes_internas', '0058_escolas_colunas_por_papel');
-- Efeito: devolve a produção ao estado de 24/09 anterior à janela, INCLUSIVE
-- as falhas que as quatro migrations fecham (a FK cruzada entre escolas,
-- a suspensão incompleta, as funções internas executáveis e as colunas
-- do backoffice abertas). Reverter reabre esses furos.
-- Os corpos de função acima saem com os bytes que o banco devolveu,
-- inclusive os finais de linha CRLF e os comentários, para o prosrc
-- voltar idêntico ao de antes.
