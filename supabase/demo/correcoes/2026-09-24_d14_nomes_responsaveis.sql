-- ============================================================
-- D14 (Bloco 4, 24/09/2026) — nomes dos responsáveis do Meridiano
-- ------------------------------------------------------------
-- SÓ projeto de demonstração, SÓ Instituto Meridiano. Correção
-- pontual pedida no documento de 23/09 — NÃO faz parte do mecanismo
-- semanal (por isso mora em correcoes/, fora dos arquivos do
-- mecanismo, que nunca tocam em consentimentos).
--
-- O que muda:
--   consentimentos.responsavel_nome  "Responsável de X" → nome fictício
--                                    com o sobrenome do aluno
--   consentimentos.aceito_em         os 7 tinham o MESMO instante
--                                    (23:03:09.712 de Brasília, carga em
--                                    lote); passam a ter horários
--                                    plausíveis e diferentes, no MESMO
--                                    dia local de antes
--   usuarios.nome do responsável     o do único vínculo (Helena), igual
--   vinculado à Helena               ao nome do consentimento dela
-- Não muda: termo, aluno, registrado_por, datas locais, auth.users
-- (o metadado de Auth não aparece em tela nenhuma; mexer em `auth` fica
-- fora do escopo).
--
-- registrado_em (N02): quando a 0053 for aprovada e aplicada, as linhas
-- existentes recebem o momento da migration — o registro real de que
-- estes consentimentos de demonstração foram gravados depois.
--
-- Idempotente: grava valores fixos por id; rodar de novo não muda nada.
-- Backup antes: demo.backup_20260924_consentimentos e _usuarios.
-- Rodar a V9 e a V9b (00_verificacoes.sql) antes e depois.
-- ============================================================

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'D14: Meridiano/plano demo ausente — abortado';
  end if;
  if to_regnamespace('demo') is null then
    raise exception 'D14: schema demo ausente (rode supabase/demo/01_schema.sql antes)';
  end if;
end $$;

create table if not exists demo.backup_20260924_consentimentos as
  select * from public.consentimentos where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260924_usuarios as
  select * from public.usuarios
   where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and papel = 'responsavel';
alter table demo.backup_20260924_consentimentos enable row level security;
alter table demo.backup_20260924_usuarios enable row level security;

with novo (aluno_id, responsavel_nome, aceito_local) as (values
  ('dddddddd-a000-4000-8000-000000000003'::uuid, 'Juliana Okamoto',      timestamp '2026-08-29 19:12:41'),
  ('dddddddd-a000-4000-8000-000000000007'::uuid, 'Diego Restrepo',       timestamp '2026-08-25 20:47:03'),
  ('dddddddd-a000-4000-8000-000000000006'::uuid, 'Márcia Peçanha',       timestamp '2026-08-26 08:31:57'),
  ('dddddddd-a000-4000-8000-000000000001'::uuid, 'Renata Vasconcelos',   timestamp '2026-08-31 21:05:22'),
  ('dddddddd-a000-4000-8000-000000000005'::uuid, 'Paulo Fontoura',       timestamp '2026-08-27 12:18:36'),
  ('dddddddd-a000-4000-8000-000000000002'::uuid, 'Adriana Munhoz',       timestamp '2026-08-30 10:44:09'),
  ('dddddddd-a000-4000-8000-000000000004'::uuid, 'Marcos Albuquerque',   timestamp '2026-08-28 18:26:14')
)
update public.consentimentos c
   set responsavel_nome = n.responsavel_nome,
       aceito_em        = n.aceito_local at time zone 'America/Sao_Paulo'
  from novo n
 where c.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   and c.aluno_id = n.aluno_id
   and c.termo_versao = 'v1';

update public.usuarios u
   set nome = 'Renata Vasconcelos'
  from public.vinculos_responsaveis v
 where v.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   and v.aluno_id = 'dddddddd-a000-4000-8000-000000000001'
   and u.id = v.responsavel_id
   and u.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   and u.papel = 'responsavel';

-- conferência: 7 nomes distintos, 7 horários distintos, dia local
-- igual ao do backup, e o vínculo da Helena com o mesmo nome
select a.nome as aluno, c.responsavel_nome,
       to_char(c.aceito_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS') as aceito_local,
       (c.aceito_em at time zone 'America/Sao_Paulo')::date
         = (b.aceito_em at time zone 'America/Sao_Paulo')::date as mesmo_dia
  from public.consentimentos c
  join public.alunos a on a.id = c.aluno_id
  join demo.backup_20260924_consentimentos b on b.id = c.id
 where c.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 order by a.nome;
