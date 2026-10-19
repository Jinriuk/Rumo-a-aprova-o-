-- ============================================================
-- REVERSÃO DA PUBLICAÇÃO P0.6 — CFO PMERJ, trilha pré-edital
-- ------------------------------------------------------------
-- Desfaz o SQL de scripts/gerar-seed-trilha-pmerj-cfo.mjs (turma 1) e o
-- carimbo 'pre_edital' do seed 18. Tudo o que a publicação criou é
-- linha nova do PMERJ (nicho 'pmerj-cfo', exam_tag 'pmerj_cfo', matérias
-- dir_*); nada existente foi alterado. Em 04/10/2026 nenhum dos dois
-- bancos tinha matéria dir_* nem linha do PMERJ (contagens no registro
-- de aplicação), então apagar por escopo devolve o estado anterior.
--
-- O QUE ELA APAGA É SÓ O QUE A P0.6 CRIOU. Antes de apagar, a reversão
-- confere que o PMERJ do banco é exatamente o da publicação, e recusa
-- (a transação inteira volta, nada é apagado) se for outra coisa:
--   1. a trilha é só a turma 1 (nenhuma turma posterior);
--   2. as contagens são as da P0.6: 219 assuntos, 24 missões, 1 plano
--      com 24 vínculos (missões escritas depois, por exemplo as 48 das
--      semanas 5 a 12, não são desta publicação);
--   3. nenhuma outra tabela aponta para o concurso, para os assuntos,
--      para as missões ou para a trilha. A busca é pelo catálogo do
--      Postgres (as chaves estrangeiras), não por uma lista de tabelas:
--      aluno, progresso, registro de estudo, missão de escola, prova
--      ou recorrência cadastrada depois, simulado, meta. Sem isso, a
--      cascata (`on delete cascade`) apagaria em silêncio, ou o
--      `set null` zeraria a ligação.
--
-- Com uso real, a saída é despublicar
-- (`update trilhas set publicada = false where nicho = 'pmerj-cfo'`),
-- não apagar. Não mexe no ledger de migrations: a publicação não é
-- migration.
-- ============================================================

begin;

do $$
declare
  n bigint;
  alvo record;
  fk record;
begin
  -- 1) só a turma 1
  select count(*) into n from trilhas where nicho = 'pmerj-cfo' and versao <> 1;
  if n <> 0 then raise exception 'reversão recusada: % turma(s) do PMERJ além da turma 1', n; end if;

  -- 2) o PMERJ do banco tem o tamanho exato da P0.6
  select count(*) into n from assuntos where exam_tag = 'pmerj_cfo';
  if n <> 219 then raise exception 'reversão recusada: % assuntos do PMERJ, a P0.6 criou 219', n; end if;
  select count(*) into n from missoes where exam_tag = 'pmerj_cfo';
  if n <> 24 then raise exception 'reversão recusada: % missões do PMERJ, a P0.6 criou 24', n; end if;
  select count(*) into n from trilha_planos where exam_tag = 'pmerj_cfo';
  if n <> 1 then raise exception 'reversão recusada: % planos do PMERJ, a P0.6 criou 1', n; end if;
  select count(*) into n from trilha_plano_missoes p join missoes m on m.id = p.missao_id where m.exam_tag = 'pmerj_cfo';
  if n <> 24 then raise exception 'reversão recusada: % vínculos plano-missão do PMERJ, a P0.6 criou 24', n; end if;

  -- 3) nada de fora aponta para o que vai sair. `proprios` são as
  --    tabelas que a P0.6 mesma criou e que caem junto.
  for alvo in
    select * from (values
      ('concursos', 'id',     'codigo = ''pmerj_cfo''',   array[]::text[]),
      ('concursos', 'codigo', 'codigo = ''pmerj_cfo''',   array['assuntos', 'missoes', 'trilha_planos']),
      ('assuntos',  'id',     'exam_tag = ''pmerj_cfo''', array['missoes']),
      ('missoes',   'id',     'exam_tag = ''pmerj_cfo''', array['trilha_plano_missoes']),
      ('trilhas',   'id',     'nicho = ''pmerj-cfo''',    array['disciplinas', 'trilha_semanas', 'atividades_modelo'])
    ) as v(pai, chave, escopo, proprios)
  loop
    for fk in
      select c.conrelid::regclass::text as filha, a.attname as coluna
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        join pg_attribute f on f.attrelid = c.confrelid and f.attnum = c.confkey[1]
       where c.contype = 'f'
         and c.confrelid = ('public.' || alvo.pai)::regclass
         and array_length(c.conkey, 1) = 1
         and f.attname = alvo.chave
         and c.conrelid::regclass::text <> all (alvo.proprios)
    loop
      execute format('select count(*) from %s where %I in (select %I from public.%I where %s)',
                     fk.filha, fk.coluna, alvo.chave, alvo.pai, alvo.escopo) into n;
      if n <> 0 then
        raise exception 'reversão recusada: % linha(s) de % apontam para %.% do PMERJ', n, fk.filha, alvo.pai, fk.coluna;
      end if;
    end loop;
  end loop;
end $$;

-- a trilha leva junto disciplinas, semanas e atividades-modelo (cascata)
delete from trilhas where nicho = 'pmerj-cfo' and versao = 1;
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
