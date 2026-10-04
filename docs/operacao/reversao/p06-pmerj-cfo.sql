-- ============================================================
-- REVERSÃO DA PUBLICAÇÃO P0.6 — CFO PMERJ, trilha pré-edital
-- ------------------------------------------------------------
-- Desfaz o SQL de scripts/gerar-seed-trilha-pmerj-cfo.mjs e o carimbo
-- 'pre_edital' do seed 18. Tudo o que a publicação criou é linha nova
-- do PMERJ (nicho 'pmerj-cfo', exam_tag 'pmerj_cfo', matérias dir_*);
-- nada existente foi alterado. Em 04/10/2026 nenhum dos dois bancos
-- tinha matéria dir_* nem linha do PMERJ (contagens no registro de
-- aplicação), então apagar por escopo devolve o estado anterior.
--
-- SÓ SERVE ENQUANTO NENHUM ALUNO USAR A TRILHA. As guardas abaixo
-- recusam a reversão (e a transação inteira volta) se aluno, progresso,
-- registro de estudo ou missão de escola apontar para o que sairia:
-- sem elas, `alunos.trilha_id` e `registros_estudo.missao_id` virariam
-- null em silêncio, e `aluno_missoes` e `missoes_escola` cairiam em
-- cascata. Com uso real, a saída é despublicar
-- (`update trilhas set publicada = false where nicho = 'pmerj-cfo'`),
-- não apagar.
--
-- Não mexe no ledger de migrations: a publicação não é migration.
-- ============================================================

begin;

do $$
declare n bigint;
begin
  select count(*) into n from alunos
   where trilha_id in (select id from trilhas where nicho = 'pmerj-cfo')
      or concurso_id in (select id from concursos where codigo = 'pmerj_cfo')
      or concurso_secundario_id in (select id from concursos where codigo = 'pmerj_cfo');
  if n <> 0 then raise exception 'reversão recusada: % aluno(s) usam a trilha ou o concurso PMERJ', n; end if;

  select count(*) into n from aluno_missoes
   where exam_tag = 'pmerj_cfo'
      or missao_id in (select id from missoes where exam_tag = 'pmerj_cfo');
  if n <> 0 then raise exception 'reversão recusada: % progresso(s) de aluno em missão PMERJ', n; end if;

  select count(*) into n from registros_estudo
   where missao_id in (select id from missoes where exam_tag = 'pmerj_cfo')
      or assunto_id in (select id from assuntos where exam_tag = 'pmerj_cfo');
  if n <> 0 then raise exception 'reversão recusada: % registro(s) de estudo ligados a missão ou assunto PMERJ', n; end if;

  select count(*) into n from missoes_escola
   where missao_id in (select id from missoes where exam_tag = 'pmerj_cfo');
  if n <> 0 then raise exception 'reversão recusada: % missão(ões) PMERJ ajustada(s) por escola', n; end if;
end $$;

-- a trilha leva junto disciplinas, semanas e atividades-modelo (cascata)
delete from trilhas where nicho = 'pmerj-cfo';
-- o concurso leva junto assuntos, missões, plano e plano_missoes (cascata)
delete from concursos where codigo = 'pmerj_cfo';
delete from materias
 where codigo in ('dir_adm', 'dir_const', 'dir_pen', 'dir_proc_pen', 'dir_pen_mil', 'dir_hum');

-- conferência: nada do PMERJ sobra
do $$
declare n bigint;
begin
  select (select count(*) from concursos where codigo = 'pmerj_cfo')
       + (select count(*) from assuntos where exam_tag = 'pmerj_cfo')
       + (select count(*) from missoes where exam_tag = 'pmerj_cfo')
       + (select count(*) from trilha_planos where exam_tag = 'pmerj_cfo')
       + (select count(*) from trilhas where nicho = 'pmerj-cfo')
       + (select count(*) from materias where codigo like 'dir\_%')
    into n;
  if n <> 0 then raise exception 'reversão incompleta: % linha(s) do PMERJ sobraram', n; end if;
end $$;

commit;
