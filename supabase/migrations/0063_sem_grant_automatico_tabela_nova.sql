-- ============================================================
-- 0063 — tabela nova em public não nasce acessível a anon/authenticated
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono.
--
-- O PROBLEMA
--   No Supabase, o papel que roda as migrations (postgres) tem um
--   privilégio PADRÃO em public: toda tabela criada recebe ALL para
--   anon, authenticated e service_role. A 0018 já registrou o mesmo
--   efeito para funções. Com isso, a segurança de uma tabela nova
--   depende só de a RLS estar ligada (o event trigger da 0045 liga) e
--   de alguém lembrar que, sem policy, ninguém lê; com uma policy
--   frouxa, anon e authenticated já têm o GRANT pronto. Esquecer o
--   GRANT deveria falhar fechado, e hoje falha aberto.
--
-- A MUDANÇA
--   Revoga do PADRÃO (só para objetos futuros) o ALL em tabelas de
--   public para anon e authenticated. service_role continua recebendo.
--   Feito para o papel que aplica a migration e, se ele for membro, para
--   supabase_admin (o outro papel com padrão em public no Supabase).
--   A partir daqui, toda migration que cria tabela em public declara
--   o GRANT para o papel de cliente que precisa dela.
--
-- O QUE NÃO MUDA
--   Tabelas, views e sequências que já existem: ALTER DEFAULT
--   PRIVILEGES só vale para o que for criado depois. Sequências e
--   funções novas seguem o padrão atual (fora do escopo).
--   Provado em tests/e3-0063-sem-grant-automatico-db.test.mjs, que
--   simula o padrão do Supabase, aplica este arquivo e compara a ACL de
--   todas as relações de public antes e depois.
--
-- Em banco vanilla (CI/local) não há padrão nenhum: este arquivo é
-- no-op ali. Idempotente.
--
-- ROLLBACK (manual):
--   alter default privileges in schema public grant all on tables to anon, authenticated;
--   (e o mesmo "for role supabase_admin", se aplicado para ele)
-- ============================================================

alter default privileges in schema public revoke all on tables from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin')
     and current_user <> 'supabase_admin'
     and pg_has_role(current_user, 'supabase_admin', 'MEMBER') then
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated';
  end if;
end $$;
