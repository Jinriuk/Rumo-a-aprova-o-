-- ============================================================
-- 0046 — Tarefa 2: aluno cadastrado sem meta vira pendente_configuracao
-- ------------------------------------------------------------
-- Achado: quando gerar-meta falhava (trilha sem semana pra hoje, RPC
-- fora do ar etc.), o erro só ia pro console.error do FRONT
-- (CadastroAlunos.jsx) — a coordenação via "aluno cadastrado" e o aluno
-- ficava com trilha atribuída e nenhuma meta, sem ninguém saber.
--
-- 1) coluna de estado em alunos, com o MESMO padrão de defesa em
--    profundidade da 0040 (meta_atividades): privilégio de UPDATE por
--    COLUNA. Sem isso, o grant em lote da 0001 deixaria a coordenação
--    (ou um client forjado) tirar o aluno de pendente_configuracao sem
--    a meta existir de verdade — destravando o gate por fora.
-- 2) RPC idempotente para o servidor (gerar-meta) invocar em vez do
--    motor_gerar_meta cru: reaproveita app.gerar_meta_protegida (0039),
--    que a virada de semana já usa e que NÃO duplica meta se ela já
--    existe pra semana corrente — é o "reprocessar" seguro do item 4.
-- ============================================================

alter table alunos
  add column if not exists status_provisionamento text not null default 'ok';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alunos_status_provisionamento_check' and conrelid = 'alunos'::regclass
  ) then
    alter table alunos
      add constraint alunos_status_provisionamento_check
      check (status_provisionamento in ('ok', 'pendente_configuracao'));
  end if;
end $$;

comment on column alunos.status_provisionamento is
  '0046: ''pendente_configuracao'' quando a geração da meta falhou no '
  'cadastro — bloqueia emissão de credencial de login (provisionar-aluno) '
  'até reprocessar (chamar gerar-meta de novo). Escrito só pelo '
  'service_role; ''ok'' é o default de todo cadastro novo.';

-- Privilégio de UPDATE por COLUNA (espelha a 0040): a coordenação
-- (authenticated) segue editando só o que as telas de fato escrevem hoje
-- — patchAluno (nome/trilha_id/concurso_id) e atualizarAlvoPedagogico
-- (concurso_secundario_id/data_prova_alvo/especialidade/ciclo/
-- turma_comercial_codigo). status_provisionamento fica de fora.
-- Idempotente: revoke/grant podem rodar de novo sem efeito colateral.
revoke update on alunos from authenticated;
grant update (
  nome, trilha_id, concurso_id, concurso_secundario_id,
  data_prova_alvo, especialidade, ciclo, turma_comercial_codigo
) on alunos to authenticated;

-- Wrapper idempotente: resolve trilha/hoje no servidor e delega pra
-- app.gerar_meta_protegida (0039) — 'gerada' | 'ja_tinha' | 'erro', nunca
-- lança. gerar-meta troca o antigo motor_gerar_meta(uuid) cru por este.
create or replace function public.motor_gerar_meta_segura(p_aluno uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  v_trilha    uuid;
  v_resultado text;
  v_erro      text;
begin
  select trilha_id into v_trilha from alunos where id = p_aluno;
  if v_trilha is null then
    return jsonb_build_object('resultado', 'erro', 'erro', 'aluno sem trilha atribuída');
  end if;

  select p.resultado, p.erro into v_resultado, v_erro
    from app.gerar_meta_protegida(p_aluno, v_trilha, app.hoje_local()) p;

  return jsonb_build_object('resultado', v_resultado, 'erro', v_erro);
end $$;

revoke all on function public.motor_gerar_meta_segura(uuid) from public, authenticated, anon;
grant execute on function public.motor_gerar_meta_segura(uuid) to service_role;

-- ------------------------------------------------------------
-- ROLLBACK (manual, se necessário):
--   drop function public.motor_gerar_meta_segura(uuid);
--   revoke update on alunos from authenticated;
--   grant update on alunos to authenticated;  -- volta ao grant em lote da 0001
--   alter table alunos drop constraint alunos_status_provisionamento_check;
--   alter table alunos drop column status_provisionamento;
-- ------------------------------------------------------------
