-- ============================================================
-- SEED 17 — QA1: PATCH DE DEMO E PEDAGOGIA (pós-QA0)
-- ------------------------------------------------------------
-- Patch curto, conservador e IDEMPOTENTE sobre a base de demo/vitrine.
-- NÃO mexe em arquitetura, RLS, infra (S1) nem em dados reais.
-- Roda DEPOIS de 02 (trilha) e 13 (vitrine). Cada bloco é seguro para
-- reexecução: UPDATE por id/condição estável e DELETE só do resíduo.
--
-- Cobre:
--   QA1.1 — bug pedagógico EsPCEx vendo "Colégio Naval" (scaffold
--           compartilhado): generaliza os 2 textos "do CN" do plano-base
--           para "do seu concurso" e neutraliza o NOME da trilha-base.
--           A metodologia (sequência de matérias) NÃO é reescrita — só
--           o token de concurso de 2 instruções genéricas de "dissecar
--           prova antiga" e o rótulo do scaffold, que é compartilhado
--           por TODOS os concursos da demo. O conteúdo POR EDITAL continua
--           vindo de missoes/trilha_planos por exam_tag (TrilhaConcurso).
--   QA1.2 — distribuição realista no painel: completa a missão da semana
--           (S3 ativa) do perfil FORTE → cohort "em dia" visível.
--   QA1.3 — suaviza o Lucas no ranking (corrige 50/50 e apara volume).
--   QA1.4 — trata a "Turma CN 2026" residual (2 alunos) realocando-os
--           para "CN/EPCAR — Manhã" e removendo a turma vazia (só vitrine).
--
-- ESCOPO DE ESCOLA: vitrine 11111111-1111-4111-8111-111111111111.
-- A trilha-base (b1388388) é conteúdo GLOBAL compartilhado; a
-- generalização de 2 textos + nome é higiene de conteúdo, não dado de
-- escola. Nenhuma outra escola tem seus dados alterados.
-- ============================================================

-- ------------------------------------------------------------
-- QA1.1 — NEUTRALIZAR o scaffold compartilhado (sem reescrever a
-- metodologia: só o token de concurso de instruções genéricas).
-- Idempotente: as condições WHERE só atingem o texto AINDA com "do CN".
-- ------------------------------------------------------------
update trilhas
   set nome = 'Trilha base de preparação militar — 9 semanas'
 where id = 'b1388388-c660-4b4b-811c-b58358689e92'
   and nome = 'Colégio Naval — CPACN/2026 (9 semanas)';

update atividades_modelo
   set texto = 'Dissecar 1 prova antiga do seu concurso: anotar cada pegadinha no caderno da banca'
 where id = '07356a80-0705-44c7-8bb3-a92777c7ebaf'
   and texto = 'Dissecar 1 prova antiga do CN: anotar cada pegadinha no caderno da banca';

update atividades_modelo
   set texto = 'Refazer provas antigas do seu concurso até dominar; fechar o caderno de pegadinhas da banca'
 where id = 'a168d5fc-a8a5-4b69-8bc3-845cd780e8e5'
   and texto = 'Refazer as 10 provas do CN até dominar; fechar o caderno de pegadinhas da banca';

-- ------------------------------------------------------------
-- QA1.4 — Resíduo "Turma CN 2026" (vitrine) com 2 alunos:
-- realoca para "CN/EPCAR — Manhã" e remove a turma vazia.
-- Idempotente: após a 1ª execução a turma some; reexecuções são no-op.
-- ------------------------------------------------------------
do $$
declare
  v_esc   uuid := '11111111-1111-4111-8111-111111111111';
  v_resid uuid := 'a0000000-0000-4000-8000-000000000011';  -- Turma CN 2026 (vitrine)
  v_manha uuid := 'aa000000-0000-4000-8000-000000000001';  -- CN/EPCAR — Manhã
begin
  -- só age se a turma residual ainda existir e a turma-destino existir
  if exists (select 1 from turmas where id = v_resid and escola_id = v_esc)
     and exists (select 1 from turmas where id = v_manha and escola_id = v_esc) then

    insert into alunos_turmas (escola_id, aluno_id, turma_id)
    select v_esc, at.aluno_id, v_manha
      from alunos_turmas at
     where at.turma_id = v_resid and at.escola_id = v_esc
    on conflict do nothing;

    delete from alunos_turmas where turma_id = v_resid and escola_id = v_esc;

    -- remove a turma residual SÓ se ficou sem aluno (segurança anti-órfão)
    delete from turmas
     where id = v_resid and escola_id = v_esc
       and not exists (select 1 from alunos_turmas where turma_id = v_resid);
  end if;
end $$;

-- ------------------------------------------------------------
-- QA1.3 — Suavizar o Lucas (a0000000-…-001) no ranking: era outlier
-- (q_7d ~135 vs ~73 do 2º), com um registro 50/50 (100%) irreal.
-- Ajuste para "forte, mas plausível": ~95 q_7d, acerto ~80%. XP/patente
-- do Lucas vêm do ledger C0 (missões/simulados), NÃO destes registros —
-- preservados. Idempotente: UPDATE por id para valor fixo.
-- ------------------------------------------------------------
update registros_estudo set questoes = 20, acertos = 16
 where id = '06b2aac3-166f-4c1e-8263-419d765bb7bd';   -- ing 2026-06-16 (era 50/50 = 100%)
update registros_estudo set questoes = 30, acertos = 24
 where id = '48c5b268-3d7e-4b17-a158-423dfb7cc871';   -- mat 2026-06-15 (era 40/32)

-- ------------------------------------------------------------
-- QA1.2 — Cohort "em dia": completa a missão da semana ATIVA (S3) do
-- perfil FORTE (assinatura 3 concluídas de 6 consideradas) → 6/6.
-- O painel deixa de parecer "98% atrasado": passa a ter alunos em dia,
-- com pendência (semana em curso) e sem atividade. O gatilho de XP é
-- idempotente (idempotency_key), então reexecutar não dobra XP, e a
-- query não reencontra mais a assinatura 3/6 depois de completar.
-- ------------------------------------------------------------
update meta_atividades ma
   set estado = 'concluida', atualizado_em = now()
 where ma.estado = 'pendente'
   and ma.meta_id in (
     select m.id
       from metas m
      where m.status = 'ativa'
        and m.escola_id = '11111111-1111-4111-8111-111111111111'
        and (select count(*) from meta_atividades x where x.meta_id = m.id and x.estado <> 'ignorada') = 6
        and (select count(*) from meta_atividades x where x.meta_id = m.id and x.estado = 'concluida') = 3
   );
