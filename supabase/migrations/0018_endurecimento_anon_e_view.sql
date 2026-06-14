-- ============================================================
-- 0018 — ENDURECIMENTO (completa a 0017) + view de recorrência
-- ------------------------------------------------------------
-- 1) No Supabase, o papel `anon` recebe EXECUTE por PRIVILÉGIO
--    PADRÃO (alter default privileges), não só via PUBLIC — então
--    o `revoke ... from public` da 0017 não tira o anon. Revoga
--    explicitamente. Em banco vanilla (CI/local) o anon não tem
--    grant explícito, então o revoke é no-op inofensivo.
-- 2) A view vw_recorrencia_medida (0015) nasce SECURITY DEFINER
--    (roda com privilégios do dono). Para um relatório global e
--    somente-leitura, SECURITY INVOKER é o correto — a RLS de quem
--    consulta passa a valer e o advisor 0010 fica limpo. Os dados
--    são globais (legíveis por authenticated), então nada quebra.
-- Aditiva e idempotente.
-- ============================================================

revoke execute on function public.resumo_escola() from anon;

alter view public.vw_recorrencia_medida set (security_invoker = true);
