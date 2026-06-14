-- ============================================================
-- 0010 — NORMALIZA O exam_tag DA ESA: 'essa' → 'esa' (Fase 15.3, pré)
-- ------------------------------------------------------------
-- O código histórico da Escola de Sargentos das Armas era `essa`
-- (de "EsSA"), que colide visualmente com a palavra "essa" e diverge
-- do nome usado no documento pedagógico ("ESA"). Como `exam_tag` é a
-- base estável das próximas subfases, padronizamos para `esa` AGORA.
--
-- Em banco NOVO (CI/local) esta migration roda ANTES dos seeds, então
-- não há 'essa' e o bloco é no-op; os seeds já inserem 'esa'. Em banco
-- já populado (ex.: demo), o bloco migra a linha e TODOS os filhos por
-- exam_tag, além de `alunos.concurso_id`. Idempotente e seguro:
-- abordagem cria-nova-linha → repointa filhos → remove a antiga, sem
-- esbarrar nas FKs imediatas (que apontam para concursos.codigo).
-- ============================================================
do $$
declare
  v_id_velho uuid;
  v_id_novo  uuid;
begin
  if exists (select 1 from concursos where codigo = 'essa')
     and not exists (select 1 from concursos where codigo = 'esa') then

    select id into v_id_velho from concursos where codigo = 'essa';

    -- 1) cria a linha 'esa' copiando os campos (exam_tag é gerado de codigo)
    insert into concursos (codigo, nome, organizacao, nivel, mes_prova, dia_prova, observacao, ordem,
                           elimination_model, redacao_role, usa_especialidade, usa_ciclo, status_dado)
      select 'esa', nome, organizacao, nivel, mes_prova, dia_prova, observacao, ordem,
             elimination_model, redacao_role, usa_especialidade, usa_ciclo, status_dado
        from concursos where codigo = 'essa'
      returning id into v_id_novo;

    -- 2) repointa todos os filhos que referenciam concursos.codigo
    update turmas_comerciais_concursos set exam_tag = 'esa' where exam_tag = 'essa';
    update config_oficial               set exam_tag = 'esa' where exam_tag = 'essa';
    update config_escola                set exam_tag = 'esa' where exam_tag = 'essa';
    update provas                       set exam_tag = 'esa' where exam_tag = 'essa';
    update prova_dias                   set exam_tag = 'esa' where exam_tag = 'essa';
    update prova_materias               set exam_tag = 'esa' where exam_tag = 'essa';
    update assuntos                     set exam_tag = 'esa' where exam_tag = 'essa';

    -- 3) repointa os alunos que miravam a ESA (FK por id, não por codigo)
    update alunos set concurso_id = v_id_novo where concurso_id = v_id_velho;

    -- 4) remove a linha antiga (nada mais a referencia → cascade não apaga nada)
    delete from concursos where id = v_id_velho;
  end if;
end $$;
