-- ============================================================
-- DEMO (bdjkgrzfzoamchdpobbl) — limpeza F: escola e aluno de teste da trocar-senha e o
-- internal_admin temporário 2262d592. Um bloco só: se qualquer linha falhar,
-- nada é apagado. Rodar o select de contagem antes.
-- ============================================================
-- contagem do que será apagado (rodar antes)
select 'public.escolas' as tabela, count(*) as linhas from public.escolas
 where id = 'b54cc694-de1e-430e-b9a3-ef26bbea953a' and slug = 'teste-trocar-senha'
union all
select 'auth.users (aluno de teste)', count(*) from auth.users
 where id = '332ffd8a-703a-4600-bfec-4c9a6e78bf77' and email = 'tstsenha16a1@codigo.acesso.local'
union all
select 'public.internal_admins', count(*) from public.internal_admins
 where auth_user_id = '2262d592-562b-45ea-a519-8f9130471aab'
union all
select 'auth.users (operador)', count(*) from auth.users
 where id = '2262d592-562b-45ea-a519-8f9130471aab';

begin;
delete from public.escolas where id='b54cc694-de1e-430e-b9a3-ef26bbea953a' and slug='teste-trocar-senha';
delete from auth.users where id='332ffd8a-703a-4600-bfec-4c9a6e78bf77' and email='tstsenha16a1@codigo.acesso.local';
delete from public.internal_admins where auth_user_id='2262d592-562b-45ea-a519-8f9130471aab';
delete from auth.users where id='2262d592-562b-45ea-a519-8f9130471aab';
commit;
