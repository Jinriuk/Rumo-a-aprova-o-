-- ============================================================
-- CATÁLOGO DE MISSÕES DO DEMO IGUAL AO DA PRODUÇÃO · passo 1 de 4
-- ------------------------------------------------------------
-- SÓ projeto de demonstração. PROPOSTA, NÃO APLICADA: o dono autoriza
-- antes. Divergência medida, ordem e efeitos na vitrine em
-- docs/operacao/demo-catalogo-missoes.md.
--
--   1. este arquivo: travas, backup e o critério estruturado da seed 09 §5
--   2. supabase/seed/19_espcex_ped2_r3.sql   assuntos oficiais da EsPCEx
--      (a seed 20 liga cada missão ao assunto PELO NOME: sem os 80
--      assuntos, ela pula 21 das 24 missões e a checagem final aborta)
--   3. supabase/seed/20_trilha_espcex.sql    24 missões, 4 planos, calendário
--   4. supabase/seed/18_maturidade_concursos.sql  carimbo da EsPCEx
--   depois: 2026-10-02_catalogo_missoes_conferir.sql (só leitura).
--
-- Travas: aborta fora do demo (Instituto Meridiano com plano demo) e
-- sem a 0061. Sem a 0061 o motor antigo soma o histórico inteiro do
-- aluno em cada missão: dar meta às missões faria a vitrine fechar três
-- de uma vez e pagar o XP três vezes, o defeito que a 0061 corrige.
-- Idempotente: o backup nasce na primeira execução e não é
-- sobrescrito; o update só preenche meta nula.
-- ============================================================

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'catálogo de missões: Meridiano/plano demo ausente — só roda no projeto de demonstração';
  end if;
  if to_regclass('app.missao_registros') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'aluno_missoes'
                       and column_name = 'regra') then
    raise exception 'catálogo de missões: a 0061 (missões em sequência) não está aplicada — aplique-a antes';
  end if;
  if to_regnamespace('demo') is null then
    raise exception 'catálogo de missões: schema demo ausente (rode supabase/demo/01_schema.sql antes)';
  end if;
end $$;

-- Backup do que os passos 1 a 4 alteram (as seeds 19 e 20 também
-- INSEREM conteúdo global novo: assuntos, cadernos, questões tagueadas,
-- recorrência, trilha e calendário da EsPCEx; isso fica, ver o desfazer).
create table if not exists demo.backup_20261002_missoes as
  select * from public.missoes;
create table if not exists demo.backup_20261002_trilha_planos as
  select * from public.trilha_planos;
create table if not exists demo.backup_20261002_trilha_plano_missoes as
  select * from public.trilha_plano_missoes;
create table if not exists demo.backup_20261002_assuntos as
  select * from public.assuntos where exam_tag = 'espcex';
create table if not exists demo.backup_20261002_subassuntos as
  select s.* from public.subassuntos s
    join public.assuntos a on a.id = s.assunto_id
   where a.exam_tag = 'espcex';
create table if not exists demo.backup_20261002_concursos as
  select id, codigo, maturidade, conteudo_versao from public.concursos;
alter table demo.backup_20261002_missoes enable row level security;
alter table demo.backup_20261002_trilha_planos enable row level security;
alter table demo.backup_20261002_trilha_plano_missoes enable row level security;
alter table demo.backup_20261002_assuntos enable row level security;
alter table demo.backup_20261002_subassuntos enable row level security;
alter table demo.backup_20261002_concursos enable row level security;

-- Seed 09 §5, o mesmo texto que a produção recebeu: o motor fecha a
-- missão por número (volume + acurácia). Sem quantidade sugerida
-- (redação), a missão continua manual, com a coordenação.
update public.missoes
   set meta_questoes = coalesce(meta_questoes, qtd_questoes_sugerida),
       meta_acuracia = coalesce(meta_acuracia, 70)
 where qtd_questoes_sugerida is not null and meta_questoes is null;

insert into demo.execucoes (acao, hoje, detalhe)
values ('catalogo_missoes_preparar', (now() at time zone 'America/Sao_Paulo')::date,
        jsonb_build_object('missoes_com_meta', (select count(*) from public.missoes where meta_questoes > 0),
                           'proximo', 'seeds 19, 20 e 18; depois o conferir'));
