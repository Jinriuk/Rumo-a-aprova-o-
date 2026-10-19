-- ============================================================
-- DEMO (bdjkgrzfzoamchdpobbl) — limpeza do E2E da 0066 (16/10/2026).
-- Apaga o aluno e a escola de teste (as 2 entregas saem em cascata), as
-- respostas do pg_net com os tokens, o secret anon_key e a tabela
-- temporária. As questões guardadas na Quest ficam (servem aos alunos).
-- ============================================================
-- contagem antes
select 'escola teste-e2e-fgv' as alvo, count(*) from public.escolas where slug = 'teste-e2e-fgv'
union all select 'auth.users e2efgv*', count(*) from auth.users where email like 'e2efgv%@codigo.acesso.local'
union all select 'net._http_response 1-10', count(*) from net._http_response where id between 1 and 10
union all select 'vault anon_key', count(*) from vault.secrets where name = 'anon_key';

begin;
delete from public.escolas where slug = 'teste-e2e-fgv';
delete from auth.users where email like 'e2efgv%@codigo.acesso.local';
delete from net._http_response where id between 1 and 10;
delete from vault.secrets where name = 'anon_key';
drop table if exists app._e2e_fgv;
commit;

-- conferência: tudo 0 / false
select to_regclass('app._e2e_fgv') is not null as tabela_e2e,
       (select count(*) from public.escolas where slug = 'teste-e2e-fgv') as escola,
       (select count(*) from auth.users where email like 'e2efgv%@codigo.acesso.local') as usuarios,
       (select count(*) from net._http_response where id between 1 and 10) as respostas_pgnet,
       (select count(*) from vault.secrets where name = 'anon_key') as anon_key;
