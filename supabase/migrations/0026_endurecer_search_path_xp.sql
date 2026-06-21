-- ============================================================
-- 0026 — S1.10: fecha os 2 advisors WARN de search_path mutável
-- ------------------------------------------------------------
-- O linter de segurança do Supabase (0011_function_search_path_mutable)
-- apontava `app.xp_por_prioridade` e `app.xp_simulado` (criadas na
-- 0024) sem search_path fixo. São funções IMMUTABLE puras (não tocam
-- tabela), mas a doutrina da 0006 é: nenhuma função com search_path
-- mutável. Fixa em vazio — não há identificador não-qualificado no
-- corpo, então nada quebra. Aditiva e idempotente.
-- ============================================================
alter function app.xp_por_prioridade(text) set search_path = '';
alter function app.xp_simulado()           set search_path = '';
