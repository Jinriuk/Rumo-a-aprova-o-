-- ============================================================
-- 0006 — endurecimento: search_path fixo em toda função
-- (advisor 0011_function_search_path_mutable do Supabase). Os
-- corpos já são schema-qualificados; isto só remove a mutabilidade.
-- As funções com SECURITY DEFINER (0002/0003) já fixavam o seu.
-- ============================================================
alter function app.jwt()                       set search_path = '';
alter function app.usuario_id()                set search_path = '';
alter function app.tenant_id()                 set search_path = '';
alter function app.papel()                     set search_path = '';
alter function app.hoje_local()                set search_path = '';
alter function public.motor_gerar_meta(uuid)   set search_path = '';
alter function public.motor_virar_semana()     set search_path = '';
alter function public.lgpd_exportar(uuid)      set search_path = '';
alter function public.lgpd_excluir(uuid)       set search_path = '';
