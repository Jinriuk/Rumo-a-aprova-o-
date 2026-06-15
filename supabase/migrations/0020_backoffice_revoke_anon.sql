-- ============================================================
-- 0020 — ENDURECIMENTO do backoffice: revoga EXECUTE do anon
-- ------------------------------------------------------------
-- Mesmo caso da 0018 (resumo_escola): no Supabase o papel `anon`
-- recebe EXECUTE por PRIVILÉGIO PADRÃO, então o `revoke from public`
-- da 0019 não tira o anon das funções SECURITY DEFINER expostas no
-- schema public. Revoga explicitamente. As funções já devolvem dado
-- seguro para anon (false / "acesso negado"), mas o acesso não deve
-- existir — só usuário logado pergunta. Em banco vanilla é no-op.
-- ============================================================

revoke execute on function public.sou_super_admin()   from anon;
revoke execute on function public.backoffice_escolas() from anon;
