-- ============================================================
-- MASSA SINTÉTICA 10k — Fase PERF1 (Camada 4.8, teste de carga).
-- ------------------------------------------------------------
-- Cria UMA escola dedicada e descartável ("Escola Carga 10k") com
-- 10.000 alunos sintéticos, 50 turmas e registros de estudo, para
-- medir a Área da Escola e a RPC resumo_escola() sob o pior caso do
-- piloto (uma escola muito grande). NENHUM dado pessoal real — só
-- nomes sintéticos ("Aluno Carga NNNNN") e ids determinísticos.
--
-- ⚠️  AMBIENTE: rodar SOMENTE em local (tests/reset-db.sh) ou em
--     STAGING isolado. NUNCA no banco demo/produção compartilhado
--     (regra dura da PERF1 e do plano de carga). É escola isolada,
--     então não contamina as escolas reais/demo, mas o VOLUME de
--     escrita (≈10k metas + dezenas de milhares de registros) não
--     deve cair num banco compartilhado.
--
-- NÃO fica em supabase/seed/ de propósito: tests/reset-db.sh aplica
-- todo supabase/seed/[0-9][0-9]_*.sql em todo `npm test`. Este é sob
-- demanda — ver docs/auditoria/perf1/plano-carga-300-500-10000.md.
--
-- Idempotente: ids determinísticos (sem gen_random_uuid/random()) +
-- on conflict do nothing. Rodar duas vezes não duplica.
--
-- Pré-requisito: migrations aplicadas + uma trilha e um concurso já
-- existentes (seed 02 e 05). O bloco resolve os ids por consulta,
-- então funciona mesmo que os ids da trilha/concurso variem.
-- ============================================================

do $$
declare
  v_escola   constant uuid := '10000000-0000-4000-8000-000000000010';
  v_coord    constant uuid := '10000000-0000-4000-8000-000000000011';
  n_alunos   constant int  := 10000;   -- ajuste para 300/500/3000 conforme o cenário do plano
  n_turmas   constant int  := 50;      -- ~200 alunos por turma
  dias_reg   constant int  := 6;       -- janela de registros por aluno (0..dias_reg)
  disciplinas constant text[] := array['mat', 'ing', 'por', 'fis', 'qui', 'soc'];

  v_trilha   uuid;
  v_concurso uuid;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_nome     text;
  i          int;
  t          int;
  d          int;
begin
  -- trilha e concurso quaisquer já semeados (não inventa conteúdo).
  select id into v_trilha   from trilhas   order by versao desc nulls last limit 1;
  select id into v_concurso from concursos order by ordem  nulls last limit 1;
  if v_trilha is null then
    raise exception 'massa_10k: nenhuma trilha encontrada — aplique o seed 02 antes.';
  end if;

  insert into escolas (id, nome, slug, status)
    values (v_escola, 'Escola Carga 10k', 'carga-10k', 'ativa')
    on conflict (id) do nothing;
  insert into usuarios (id, escola_id, papel, nome)
    values (v_coord, v_escola, 'coordenacao', 'Coordenação Carga 10k')
    on conflict (id) do nothing;

  -- turmas sintéticas
  for t in 1..n_turmas loop
    insert into turmas (id, escola_id, nome)
      values (('10000000-0000-4000-8001-' || lpad(t::text, 12, '0'))::uuid,
              v_escola, 'Turma Carga ' || lpad(t::text, 2, '0'))
      on conflict (escola_id, nome) do nothing;
  end loop;

  for i in 1..n_alunos loop
    v_aluno_id := ('10000000-0000-4000-8002-' || lpad(i::text, 12, '0'))::uuid;
    v_turma_id := ('10000000-0000-4000-8001-' || lpad((((i - 1) % n_turmas) + 1)::text, 12, '0'))::uuid;
    v_nome     := 'Aluno Carga ' || lpad(i::text, 5, '0');

    insert into alunos (id, escola_id, nome, trilha_id, concurso_id)
      values (v_aluno_id, v_escola, v_nome, v_trilha, v_concurso)
      on conflict (id) do nothing;

    insert into alunos_turmas (escola_id, aluno_id, turma_id)
      values (v_escola, v_aluno_id, v_turma_id)
      on conflict do nothing;

    -- ~4 em 5 com credencial (1 em 5 fica "sem credencial")
    if i % 5 <> 0 then
      insert into usuarios (id, escola_id, papel, nome)
        values (('10000000-0000-4000-8003-' || lpad(i::text, 12, '0'))::uuid, v_escola, 'aluno', v_nome)
        on conflict (id) do nothing;
      update alunos set usuario_id = ('10000000-0000-4000-8003-' || lpad(i::text, 12, '0'))::uuid
        where id = v_aluno_id and usuario_id is null;
    end if;

    -- meta da semana pelo motor real (mesmo caminho da produção)
    perform app.gerar_meta(v_aluno_id);

    -- ~5 em 6 com atividade na janela (1 em 6 fica "sem atividade")
    if i % 6 <> 0 then
      for d in 0..dias_reg loop
        if (i + d) % 3 = 0 then continue; end if; -- nem todo dia tem registro
        insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
          values (
            ('10000000-0000-4000-8004-' || lpad((i * 10 + d)::text, 12, '0'))::uuid,
            v_escola, v_aluno_id, app.hoje_local() - d,
            disciplinas[((i + d) % 6) + 1], 'Sintético',
            10 + (i % 15),
            greatest(0, (10 + (i % 15)) - ((i + d) % 7)),
            20 + (i % 40)
          )
          on conflict (id) do nothing;
      end loop;
    end if;
  end loop;

  raise notice 'massa_10k: % alunos / % turmas na escola %', n_alunos, n_turmas, v_escola;
end $$;

-- ------------------------------------------------------------
-- LIMPEZA (uma escola descartável — cascateia tudo):
--   delete from escolas where id = '10000000-0000-4000-8000-000000000010';
-- ------------------------------------------------------------
