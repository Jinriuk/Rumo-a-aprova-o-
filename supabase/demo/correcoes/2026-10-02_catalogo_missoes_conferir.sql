-- ============================================================
-- CATÁLOGO DE MISSÕES DO DEMO · conferência (SÓ LEITURA)
-- ------------------------------------------------------------
-- Roda antes e depois de 2026-10-02_catalogo_missoes_1_preparar.sql e
-- das seeds 19, 20 e 18. Uma linha; ao lado, o valor da produção (lido
-- pelo gestor em 01/10 e igual ao banco de teste montado pelas seeds).
-- Demo em 02/10, antes de tudo: 0 · 2 · 0 · 0 · 5 · (sem Física) · 2 ·
-- beta v1 · 0 · false (0061 ainda não aplicada) · false.
-- ============================================================
select
  (select count(*) from public.missoes where meta_questoes > 0)::int                 as missoes_com_meta,     -- 26
  (select count(*) from public.missoes where exam_tag = 'espcex')::int               as espcex_missoes,       -- 24
  (select count(*) from public.missoes
    where exam_tag = 'espcex' and meta_questoes > 0)::int                            as espcex_com_meta,      -- 21 (3 de redação são manuais)
  (select count(*) from public.missoes
    where exam_tag = 'espcex' and assunto_id is null)::int                           as espcex_sem_assunto,   -- 0
  (select count(*) from public.assuntos where exam_tag = 'espcex')::int              as espcex_assuntos,      -- 80
  (select string_agg(nome, ' → ' order by ordem) from public.missoes
    where exam_tag = 'espcex' and materia_codigo = 'fis')                            as fisica_espcex,        -- Eletricidade fechada → Termologia sem surpresa → Mecânica sob tempo
  (select count(*) from public.trilha_planos where exam_tag = 'espcex')::int         as espcex_planos,        -- 4
  (select maturidade || ' v' || conteudo_versao from public.concursos
    where codigo = 'espcex')                                                         as espcex_maturidade,    -- completa v3
  (select count(*) from public.aluno_missoes)::int                                   as aluno_missoes,        -- produção 0; demo 0 em 02/10
  (to_regclass('app.missao_registros') is not null)                                  as motor_0061,           -- true antes do passo 1
  (to_regclass('demo.backup_20261002_missoes') is not null)                          as backup_ativo;
