-- ============================================================
-- MASSA SINTÉTICA DE VOLUME — Fase B-min, B.7.
-- ------------------------------------------------------------
-- Simula uma escola com ~480 alunos (faixa do piloto real, 300–500)
-- para testar a Área da Escola sob volume: paginação, busca/filtro,
-- ranking, turmas, geração de metas. NENHUM dado pessoal real — só
-- nomes sintéticos ("Aluno Volume NNN") e ids determinísticos.
--
-- NÃO fica em supabase/seed/ de propósito: tests/reset-db.sh aplica
-- TODO arquivo `supabase/seed/[0-9][0-9]_*.sql` em todo `npm test`, e
-- isso inflaria e desaceleraria a suíte padrão. Este script é
-- separado, sob demanda — ver docs/operacao/massa-volume-coordenacao.md.
--
-- Pré-requisito: supabase/seed/01..12 já aplicados (precisa da
-- escola A, da trilha CN e do concurso CN já existirem).
--
-- Idempotente: ids determinísticos (sem gen_random_uuid/random()) +
-- on conflict do nothing em todo insert. Rodar duas vezes não
-- duplica nem muda o resultado.
-- ============================================================

do $$
declare
  v_escola    constant uuid := '11111111-1111-4111-8111-111111111111'; -- Colégio Vitrine Naval
  v_coord     constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001'; -- Coordenação Vitrine
  v_trilha    constant uuid := 'b1388388-c660-4b4b-811c-b58358689e92'; -- trilha CN v1
  v_concurso  constant uuid := 'c0c00000-0000-4000-8000-000000000001'; -- concurso CN
  n_alunos    constant int  := 480;
  n_turmas    constant int  := 6;
  disciplinas constant text[] := array['mat', 'ing', 'por', 'fis', 'qui', 'soc'];

  v_aluno_id    uuid;
  v_turma_id    uuid;
  v_usuario_id  uuid;
  v_nome        text;
  i             int;
  t             int;
  d             int;
begin
  -- 6 turmas sintéticas (80 alunos cada)
  for t in 1..n_turmas loop
    insert into turmas (id, escola_id, nome)
      values (('eeeeeeee-0000-4000-8000-' || lpad(t::text, 12, '0'))::uuid,
              v_escola, 'Turma Volume ' || lpad(t::text, 2, '0'))
      on conflict (escola_id, nome) do nothing;
  end loop;

  for i in 1..n_alunos loop
    v_aluno_id := ('dddddddd-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_turma_id := ('eeeeeeee-0000-4000-8000-' || lpad((((i - 1) % n_turmas) + 1)::text, 12, '0'))::uuid;
    v_nome     := 'Aluno Volume ' || lpad(i::text, 3, '0');

    insert into alunos (id, escola_id, nome, trilha_id, concurso_id)
      values (v_aluno_id, v_escola, v_nome, v_trilha, v_concurso)
      on conflict (id) do nothing;

    insert into alunos_turmas (escola_id, aluno_id, turma_id)
      values (v_escola, v_aluno_id, v_turma_id)
      on conflict do nothing;

    -- ~4 em 5 com credencial provisionada (1 em 5 "sem credencial")
    if i % 5 <> 0 then
      v_usuario_id := ('ffffffff-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
      insert into usuarios (id, escola_id, papel, nome)
        values (v_usuario_id, v_escola, 'aluno', v_nome)
        on conflict (id) do nothing;
      update alunos set usuario_id = v_usuario_id
        where id = v_aluno_id and usuario_id is distinct from v_usuario_id;
    end if;

    -- ~3 em 4 com consentimento registrado (1 em 4 "sem consentimento")
    if i % 4 <> 0 then
      insert into consentimentos (id, escola_id, aluno_id, responsavel_nome, termo_versao, registrado_por)
        values (('dddddddd-1111-4111-8111-' || lpad(i::text, 12, '0'))::uuid,
                v_escola, v_aluno_id, 'Responsável de ' || v_nome, 'v1', v_coord)
        on conflict (id) do nothing;
    end if;

    -- meta da semana corrente, pelo motor — igual à produção
    perform app.gerar_meta(v_aluno_id);

    -- ~5 em 6 com atividade nos últimos dias (1 em 6 "sem atividade 7d")
    if i % 6 <> 0 then
      for d in 0..8 loop
        if (i + d) % 3 = 0 then continue; end if; -- variação: nem todo dia tem registro
        insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
          values (
            ('dddddddd-3333-4333-8333-' || lpad((i * 100 + d)::text, 12, '0'))::uuid,
            v_escola, v_aluno_id, app.hoje_local() - d,
            disciplinas[((i + d) % 6) + 1], 'Sintético',
            10 + (i % 15),
            greatest(0, (10 + (i % 15)) - ((i + d) % 7)),
            20 + (i % 40)
          )
          on conflict (id) do nothing;
      end loop;
    end if;

    -- ~1 em 3 com simulado lançado
    if i % 3 = 0 then
      insert into simulados (id, escola_id, aluno_id, nome, data, acertos)
        values (('dddddddd-2222-4222-8222-' || lpad(i::text, 12, '0'))::uuid,
                v_escola, v_aluno_id, 'Simulado sintético', app.hoje_local() - 3,
                jsonb_build_object('mat', 8 + (i % 10), 'ing', 9 + (i % 8), 'por', 10 + (i % 9),
                                    'fis', 5 + (i % 6), 'qui', 5 + (i % 6), 'soc', 6 + (i % 7)))
        on conflict (id) do nothing;
    end if;
  end loop;

  -- marca parte das atividades da meta como concluída (para "meta
  -- atrasada" aparecer no filtro) — hash do id é determinístico
  -- (mesmo id sempre dá o mesmo hash), então fica idempotente.
  update meta_atividades ma
    set estado = 'concluida'
    from metas m
    where ma.meta_id = m.id
      and m.escola_id = v_escola
      and m.aluno_id between 'dddddddd-0000-4000-8000-000000000001'::uuid
                          and 'dddddddd-0000-4000-8000-000000000480'::uuid
      and ma.estado = 'pendente'
      and ('x' || substr(md5(ma.id::text), 1, 8))::bit(32)::int % 3 <> 0;
end $$;
