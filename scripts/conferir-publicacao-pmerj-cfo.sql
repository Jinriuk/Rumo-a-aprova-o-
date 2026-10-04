-- ============================================================
-- CONFERÊNCIA DA PUBLICAÇÃO P0.6 — CFO PMERJ (somente leitura)
-- ------------------------------------------------------------
-- Uma linha por tabela do escopo: quantas linhas do PMERJ existem e o
-- md5 do conteúdo delas (sem colunas que variam por banco: ids gerados
-- no servidor de disciplinas e semanas, datas de criação). A linha
-- TOTAL resume tudo. Roda igual em qualquer banco; depois de aplicar o
-- SQL do gerador e o carimbo 'pre_edital', demo, produção e o Postgres
-- local têm de dar o mesmo TOTAL. Antes de aplicar, todas as contagens
-- são 0 e o hash é o do vazio.
-- Registro e valores esperados: docs/operacao/aplicacao-pmerj-cfo-p06.md
-- ============================================================
with f(tabela, n, h) as (
  select 'concursos', count(*), md5(coalesce(string_agg(row(codigo, nome, organizacao, nivel, mes_prova, dia_prova, observacao, ordem, status_dado, maturidade, conteudo_versao)::text, '|' order by codigo), ''))
    from concursos where codigo = 'pmerj_cfo'
  union all select 'materias', count(*), md5(coalesce(string_agg(row(codigo, nome, abrev, ordem)::text, '|' order by codigo), ''))
    from materias where codigo like 'dir\_%'
  union all select 'assuntos', count(*), md5(coalesce(string_agg(row(id, exam_tag, materia_codigo, nome, prioridade, status_dado, observacao, ordem)::text, '|' order by id), ''))
    from assuntos where exam_tag = 'pmerj_cfo'
  union all select 'missoes', count(*), md5(coalesce(string_agg(row(id, exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, prioridade, qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao, criterio_excelencia, xp_sugerido, origem, status_dado, ordem, meta_questoes, meta_acuracia)::text, '|' order by id), ''))
    from missoes where exam_tag = 'pmerj_cfo'
  union all select 'trilha_planos', count(*), md5(coalesce(string_agg(row(exam_tag, tipo, nome, descricao, status_dado, ordem)::text, '|' order by tipo), ''))
    from trilha_planos where exam_tag = 'pmerj_cfo'
  union all select 'trilha_plano_missoes', count(*), md5(coalesce(string_agg(row(p.missao_id, p.fase, p.semana_sugerida, p.ordem)::text, '|' order by p.missao_id), ''))
    from trilha_plano_missoes p join missoes m on m.id = p.missao_id where m.exam_tag = 'pmerj_cfo'
  union all select 'trilhas', count(*), md5(coalesce(string_agg(row(id, nicho, nome, versao, publicada)::text, '|' order by versao), ''))
    from trilhas where nicho = 'pmerj-cfo'
  union all select 'disciplinas', count(*), md5(coalesce(string_agg(row(d.codigo, d.nome, d.abrev, d.cor, d.ordem)::text, '|' order by d.codigo), ''))
    from disciplinas d join trilhas t on t.id = d.trilha_id where t.nicho = 'pmerj-cfo'
  union all select 'trilha_semanas', count(*), md5(coalesce(string_agg(row(s.numero, s.inicio, s.fim, s.foco, s.simulado, s.meta_questoes)::text, '|' order by s.numero), ''))
    from trilha_semanas s join trilhas t on t.id = s.trilha_id where t.nicho = 'pmerj-cfo'
  union all select 'atividades_modelo', count(*), md5(coalesce(string_agg(row(a.id, a.semana_numero, a.disciplina_codigo, a.prioridade, a.texto, a.ordem)::text, '|' order by a.id), ''))
    from atividades_modelo a join trilhas t on t.id = a.trilha_id where t.nicho = 'pmerj-cfo'
)
select tabela, n, h from f
union all select 'TOTAL', sum(n), md5(string_agg(tabela || ':' || n || ':' || h, '|' order by tabela)) from f
order by 1;
