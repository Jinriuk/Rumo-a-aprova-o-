-- ============================================================
-- 0056 — C-S04: escola ausente ou inválida NEGA; escola parada não escreve
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono, pedida em prompt próprio (Etapa 2,
-- trava 3). Escrita e ensaiada só em Postgres local descartável.
-- NUMERAÇÃO: o roteiro da Etapa 2 chamava esta de 0055; a 0055 virou a
-- correção urgente de coerência de tenant (#138). Esta não depende dela.
--
-- O ACHADO (auditoria, C-S04)
--   app.tenant_operacional() era
--     coalesce((select status not in ('suspensa','cancelada')
--               from escolas where id = app.tenant_id()), true)
--   → escola do token INEXISTENTE ou AUSENTE respondia "operacional".
--   Provado na matriz de autorização (Etapa 2, fatia 2): token com
--   escola_id que não existe e token de coordenação sem escola_id, os
--   dois recebiam true.
--
-- O QUE A MATRIZ MEDIU SOBRE O ALCANCE
--   Nenhuma persona passa HOJE só pelo fallback: toda policy que usa o
--   porteiro também exige `escola_id = app.tenant_id()`, e toda linha
--   tem FK para escolas. O caso mais perto é a turma da escola
--   fantasma: a RLS deixava passar e a FK de escolas barrava. É regra
--   incompleta, não furo explorável — e a correção tira a dependência
--   dessas duas coincidências.
--
-- O ACHADO DE COBERTURA (C-S04b, matriz, fatia 2)
--   A 0027 pôs o porteiro só em parte das policies da coordenação.
--   Coordenação de escola SUSPENSA ou CANCELADA, com sessão aberta,
--   ainda gravava em: config_escola, missoes_escola, logs_coordenacao,
--   aluno_xp_eventos, aluno_conquistas, aluno_missoes, aluno_niveis,
--   aluno_onboarding e aluno_eventos_progresso (ajuste). Não é entre
--   escolas; fura a suspensão.
--
-- O QUE MUDA
--   1) app.tenant_operacional():
--        • token SEM escola → só o super admin ativo (internal_admins),
--          por regra EXPLÍCITA; qualquer outro → false;
--        • token COM escola → a escola precisa EXISTIR e não estar
--          suspensa nem cancelada; escola que não existe → false.
--      O super admin continua não dependendo disto: opera pelas RPCs do
--      backoffice (porteiro eh_super_admin) e as policies que usam este
--      porteiro também exigem escola_id = tenant, que para ele não casa.
--   2) As policies de ESCRITA da coordenação nas nove tabelas acima
--      ganham `and app.tenant_operacional()`, igual às da 0027.
--
-- O QUE NÃO MUDA
--   Leitura da própria configuração, missões e gamificação pela
--   coordenação de escola suspensa continua: é dado da própria escola,
--   e a 0027 manteve legível o que a tela "Acesso suspenso" precisa.
--   Fechar essa leitura é decisão de produto, registrada em
--   docs/e2-seguranca.md.
--
-- ROLLBACK: reaplicar app.tenant_operacional da 0027 e as policies de
-- escrita da 0029 (gamificação, configuração, missões), da 0022
-- (logs_coordenacao_insert) e da 0024 (evprog_ajuste_coordenacao).
-- ============================================================

-- 1) o porteiro nega por padrão
create or replace function app.tenant_operacional() returns boolean
language sql stable security definer set search_path = public, app as $$
  select case
    -- sem escola no token: só o operador interno, por regra explícita
    when app.tenant_id() is null then app.eh_super_admin()
    -- com escola: ela tem que existir e estar com acesso ativo
    else coalesce(
      (select e.status not in ('suspensa', 'cancelada') from escolas e where e.id = app.tenant_id()),
      false)
  end
$$;
grant execute on function app.tenant_operacional() to authenticated, service_role;

-- 2) escrita da coordenação: o porteiro nas nove tabelas que a 0027 deixou de fora
do $$
declare
  t record;
begin
  for t in select * from (values
      ('aluno_conquistas',  'conq_coord'),
      ('aluno_missoes',     'aluno_missoes_coord'),
      ('aluno_niveis',      'aluno_niveis_coord'),
      ('aluno_onboarding',  'aluno_onboarding_coord'),
      ('aluno_xp_eventos',  'xp_coord'),
      ('config_escola',     'config_escola_coord'),
      ('missoes_escola',    'missoes_escola_coord')
    ) as v(tabela, prefixo)
  loop
    execute format('drop policy if exists %I on public.%I', t.prefixo || '_ins', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.prefixo || '_upd', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.prefixo || '_del', t.tabela);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())$p$,
      t.prefixo || '_ins', t.tabela);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())
      with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())$p$,
      t.prefixo || '_upd', t.tabela);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using (escola_id = app.tenant_id() and app.papel() = 'coordenacao' and app.tenant_operacional())$p$,
      t.prefixo || '_del', t.tabela);
  end loop;
end $$;

drop policy if exists logs_coordenacao_insert on public.logs_coordenacao;
create policy logs_coordenacao_insert on public.logs_coordenacao for insert to authenticated
  with check (
    escola_id = app.tenant_id() and usuario_id = app.usuario_id()
    and papel = app.papel() and papel = 'coordenacao' and app.tenant_operacional()
  );

drop policy if exists evprog_ajuste_coordenacao on public.aluno_eventos_progresso;
create policy evprog_ajuste_coordenacao on public.aluno_eventos_progresso for insert to authenticated
  with check (
    escola_id = app.tenant_id() and app.papel() = 'coordenacao'
    and tipo_evento = 'ajuste_coordenacao' and app.tenant_operacional()
  );
