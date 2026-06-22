-- ============================================================
-- 0029 — DB2-B: consolida multiple_permissive_policies sem alterar
-- comportamento. Onde uma tabela tinha UMA policy FOR ALL para a
-- coordenação, o Postgres a expande em SELECT/INSERT/UPDATE/DELETE e
-- o linter acusa "multiple permissive policies" no SELECT (somado às
-- policies de leitura do aluno/responsável). Quebrar a policy FOR ALL
-- em INSERT/UPDATE/DELETE explícitos (sem SELECT) remove a duplicidade
-- no caminho de leitura mantendo exatamente a mesma matriz de acesso.
-- Aditiva e idempotente.
-- ============================================================

drop policy if exists conq_coordenacao on public.aluno_conquistas;
create policy conq_coord_ins on public.aluno_conquistas for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy conq_coord_upd on public.aluno_conquistas for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy conq_coord_del on public.aluno_conquistas for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

drop policy if exists aluno_niveis_coordenacao on public.aluno_niveis;
create policy aluno_niveis_coord_ins on public.aluno_niveis for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_niveis_coord_upd on public.aluno_niveis for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_niveis_coord_del on public.aluno_niveis for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

drop policy if exists aluno_onboarding_coordenacao on public.aluno_onboarding;
create policy aluno_onboarding_coord_ins on public.aluno_onboarding for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_onboarding_coord_upd on public.aluno_onboarding for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_onboarding_coord_del on public.aluno_onboarding for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

drop policy if exists xp_coordenacao on public.aluno_xp_eventos;
create policy xp_coord_ins on public.aluno_xp_eventos for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy xp_coord_upd on public.aluno_xp_eventos for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy xp_coord_del on public.aluno_xp_eventos for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

drop policy if exists config_escola_coordenacao on public.config_escola;
create policy config_escola_coord_ins on public.config_escola for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy config_escola_coord_upd on public.config_escola for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy config_escola_coord_del on public.config_escola for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

drop policy if exists missoes_escola_coordenacao on public.missoes_escola;
create policy missoes_escola_coord_ins on public.missoes_escola for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy missoes_escola_coord_upd on public.missoes_escola for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy missoes_escola_coord_del on public.missoes_escola for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

drop policy if exists vinculos_coordenacao on public.vinculos_responsaveis;
drop policy if exists vinculos_responsavel_select on public.vinculos_responsaveis;
create policy vinculos_select on public.vinculos_responsaveis for select to authenticated
  using ((escola_id = app.tenant_id()) and app.tenant_operacional()
    and ((app.papel() = 'coordenacao') or (responsavel_id = app.usuario_id())));
create policy vinculos_coord_ins on public.vinculos_responsaveis for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional());
create policy vinculos_coord_upd on public.vinculos_responsaveis for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional())
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional());
create policy vinculos_coord_del on public.vinculos_responsaveis for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional());
