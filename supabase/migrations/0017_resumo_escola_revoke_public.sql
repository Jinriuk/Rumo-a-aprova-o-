-- ============================================================
-- 0017 — ENDURECIMENTO: tira o EXECUTE implícito do PUBLIC sobre
-- resumo_escola(). No Postgres toda função nasce executável pelo
-- PUBLIC; como a 0016 é SECURITY DEFINER e fica exposta no schema
-- public (PostgREST → /rest/v1/rpc), isso a deixa chamável pelo
-- papel anon (deslogado). Na prática ela devolve vazio para anon
-- (sem JWT, app.tenant_id() é null), mas o acesso não deve existir:
-- só usuário logado consulta o painel. Mantém os GRANTs explícitos
-- da 0016 (authenticated, service_role).
-- (advisor: anon_security_definer_function_executable)
-- ============================================================

revoke execute on function public.resumo_escola() from public;
