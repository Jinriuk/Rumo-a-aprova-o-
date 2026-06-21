-- ============================================================
-- 0029_db2_policies_consolidadas — DB2-B
-- ------------------------------------------------------------
-- Remove os 7 avisos `multiple_permissive_policies` SEM alterar
-- comportamento. Em 6 tabelas, a política `FOR ALL` da coordenação
-- sobrepunha, no SELECT, a política `_select` já existente (idêntica em
-- escopo) — então separamos a coordenação em políticas de ESCRITA
-- (INSERT/UPDATE/DELETE) e deixamos o SELECT a cargo da `_select`.
-- Em `vinculos_responsaveis`, a coordenação só lia pela `FOR ALL`, então
-- unimos as duas leituras (coordenação OU responsável) numa única
-- política de SELECT equivalente e mantivemos as escritas da coordenação.
--
-- INVARIANTES PRESERVADAS (verificadas em teste):
--   • nenhum acesso novo é aberto; nenhum acesso legítimo é bloqueado;
--   • a suspensão de escola continua valendo onde já valia
--     (tenant_operacional mantido exatamente onde estava — só existia em
--      vinculos; as tabelas de gamificação NÃO tinham esse gate e NÃO
--      passam a ter);
--   • aluno/responsável/coordenação/superadmin inalterados.
-- Idempotente: usa `drop policy if exists` + `create policy`.
-- ============================================================

-- ---------- 6 tabelas: split FOR ALL (coordenação) -> escrita ----------
-- Padrão: qual/with_check = escola_id = tenant_id() AND papel() = 'coordenacao'

-- aluno_conquistas
drop policy if exists conq_coordenacao on public.aluno_conquistas;
create policy conq_coord_ins on public.aluno_conquistas for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy conq_coord_upd on public.aluno_conquistas for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy conq_coord_del on public.aluno_conquistas for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

-- aluno_niveis
drop policy if exists aluno_niveis_coordenacao on public.aluno_niveis;
create policy aluno_niveis_coord_ins on public.aluno_niveis for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_niveis_coord_upd on public.aluno_niveis for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_niveis_coord_del on public.aluno_niveis for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

-- aluno_onboarding
drop policy if exists aluno_onboarding_coordenacao on public.aluno_onboarding;
create policy aluno_onboarding_coord_ins on public.aluno_onboarding for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_onboarding_coord_upd on public.aluno_onboarding for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy aluno_onboarding_coord_del on public.aluno_onboarding for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

-- aluno_xp_eventos
drop policy if exists xp_coordenacao on public.aluno_xp_eventos;
create policy xp_coord_ins on public.aluno_xp_eventos for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy xp_coord_upd on public.aluno_xp_eventos for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy xp_coord_del on public.aluno_xp_eventos for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

-- config_escola
drop policy if exists config_escola_coordenacao on public.config_escola;
create policy config_escola_coord_ins on public.config_escola for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy config_escola_coord_upd on public.config_escola for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy config_escola_coord_del on public.config_escola for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

-- missoes_escola
drop policy if exists missoes_escola_coordenacao on public.missoes_escola;
create policy missoes_escola_coord_ins on public.missoes_escola for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy missoes_escola_coord_upd on public.missoes_escola for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'))
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));
create policy missoes_escola_coord_del on public.missoes_escola for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao'));

-- ---------- vinculos_responsaveis: unir SELECT + split escrita ----------
drop policy if exists vinculos_coordenacao on public.vinculos_responsaveis;
drop policy if exists vinculos_responsavel_select on public.vinculos_responsaveis;
-- SELECT unificado: coordenação OU responsável, ambos com tenant_operacional
create policy vinculos_select on public.vinculos_responsaveis for select to authenticated
  using ((escola_id = app.tenant_id()) and app.tenant_operacional()
    and ((app.papel() = 'coordenacao') or (responsavel_id = app.usuario_id())));
-- escritas da coordenação (preserva tenant_operacional, como antes)
create policy vinculos_coord_ins on public.vinculos_responsaveis for insert to authenticated
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional());
create policy vinculos_coord_upd on public.vinculos_responsaveis for update to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional())
  with check ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional());
create policy vinculos_coord_del on public.vinculos_responsaveis for delete to authenticated
  using ((escola_id = app.tenant_id()) and (app.papel() = 'coordenacao') and app.tenant_operacional());
