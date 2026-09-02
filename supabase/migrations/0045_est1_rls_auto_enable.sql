-- ============================================================
-- 0045 — EST1: REGISTRA rls_auto_enable() + EVENT TRIGGER ensure_rls
-- ------------------------------------------------------------
-- Achado de auditoria (02/09/2026): a função `public.rls_auto_enable()`
-- e o event trigger `ensure_rls` já existem ATIVOS no projeto de teste
-- (bdjkgrzfzoamchdpobbl, evtenabled = 'O'), mas nunca tiveram migration
-- correspondente no repositório — foram criados fora do fluxo de
-- migrations, provavelmente direto no SQL editor do Supabase.
--
-- O que fazem: em todo `CREATE TABLE` (ou `CREATE TABLE AS` / `SELECT
-- INTO`) no schema `public`, o event trigger dispara a função, que roda
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` na tabela recém-criada.
-- É uma rede de segurança contra esquecer RLS numa tabela nova — não
-- substitui as policies (que continuam precisando ser escritas à mão),
-- só evita a janela em que a tabela existe sem RLS habilitada.
--
-- Esta migration apenas REGISTRA o que já roda em produção/teste, com
-- a definição extraída diretamente do Postgres (pg_get_functiondef +
-- pg_event_trigger) na mesma data. Nenhum comportamento novo.
--
-- Fora do escopo (deliberado): não mexe em `backoffice_*`,
-- `resumo_escola`, `salvar_onboarding_aluno` nem `sou_super_admin` —
-- já têm guarda interna própria (`eh_super_admin()`), confirmada nas
-- migrations 0019/0021/0025/0032.
--
-- Aditiva. Idempotente (create or replace function; drop event trigger
-- if exists antes do create). Não altera 0001–0044.
-- ============================================================

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();

-- ------------------------------------------------------------
-- ROLLBACK (manual):
--   drop event trigger if exists ensure_rls;
--   drop function if exists public.rls_auto_enable();
-- ------------------------------------------------------------
