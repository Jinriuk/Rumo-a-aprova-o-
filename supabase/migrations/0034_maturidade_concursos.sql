-- ============================================================
-- 0024 — MATURIDADE DE CONTEÚDO POR CONCURSO (PED2)
-- ------------------------------------------------------------
-- Fecha a lacuna de honestidade de conteúdo: hoje o banco não sabe
-- dizer se um concurso tem trilha pronta ou é só esqueleto. A UI,
-- por isso, mostrava trilha incompleta como se estivesse pronta.
--
-- Esta migration é ADITIVA e IDEMPOTENTE:
--   1) adiciona `concursos.maturidade` (enum por CHECK) e
--      `concursos.conteudo_versao` (versão do conteúdo do concurso);
--   2) cria a view auditável `vw_concurso_qualidade`, que cruza a
--      maturidade DECLARADA com a densidade REAL de conteúdo
--      (prova, matérias, assuntos, missões, planos) — para que um
--      auditor flagre na hora um concurso marcado 'beta'/'completa'
--      sem assunto nenhum.
--
-- FONTE ÚNICA da matriz: app/src/modules/conteudo/maturidade.js.
-- O valor de cada concurso é gravado pelo seed 18_maturidade_concursos.sql
-- (gerado por scripts/gerar-seed-maturidade.mjs a partir daquele arquivo).
-- O default é 'indisponivel' de propósito: concurso novo nasce honesto
-- (sem conteúdo) até o seed/operador promovê-lo.
--
-- RISCO: baixo. Coluna nova com default não trava escrita; a view é
--   só leitura. Não toca RLS de `concursos` (a policy de select
--   existente cobre a coluna nova). Não altera dado de aluno/escola.
-- TESTE: ver tests/conteudo-maturidade.test.mjs (invariantes da matriz)
--   e scripts/validar-conteudo.mjs (cruza matriz × conteúdo real).
-- ROLLBACK (seguro, sem perda de dado de domínio):
--   drop view if exists public.vw_concurso_qualidade;
--   alter table concursos drop column if exists maturidade;
--   alter table concursos drop column if exists conteudo_versao;
-- ============================================================

-- 1) Colunas de maturidade/versão (aditivas, idempotentes).
alter table concursos
  add column if not exists maturidade text not null default 'indisponivel';

alter table concursos
  add column if not exists conteudo_versao int not null default 0;

-- CHECK em passo separado e idempotente (não falha se já existe).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'concursos_maturidade_check'
  ) then
    alter table concursos
      add constraint concursos_maturidade_check
      check (maturidade in ('completa', 'beta', 'esqueleto', 'indisponivel'));
  end if;
end $$;

comment on column concursos.maturidade is
  'Maturidade do conteúdo: completa | beta | esqueleto | indisponivel. Fonte única: app/src/modules/conteudo/maturidade.js; gravado pelo seed 18. UI nunca exibe não-completa como pronta.';
comment on column concursos.conteudo_versao is
  'Versão do conteúdo do concurso (sobe a cada revisão relevante da trilha/assuntos).';

-- 2) View auditável: maturidade declarada × densidade real de conteúdo.
--    security_invoker → respeita a RLS de quem consulta (conteúdo
--    global é legível por qualquer autenticado).
create or replace view vw_concurso_qualidade as
  select
    c.codigo,
    c.nome,
    c.maturidade,
    c.conteudo_versao,
    (select count(*) from provas         p  where p.exam_tag = c.codigo) > 0      as tem_prova,
    (select count(*) from prova_materias pm where pm.exam_tag = c.codigo)::int    as n_materias,
    (select count(*) from assuntos       a  where a.exam_tag = c.codigo)::int     as n_assuntos,
    (select count(*) from missoes        m  where m.exam_tag = c.codigo)::int     as n_missoes,
    (select count(*) from trilha_planos  tp where tp.exam_tag = c.codigo)::int    as n_planos,
    -- incoerência flagrada: declarado pronto/beta sem assunto catalogado
    (c.maturidade in ('completa', 'beta')
       and (select count(*) from assuntos a where a.exam_tag = c.codigo) = 0)     as suspeita_incoerencia
  from concursos c;

alter view public.vw_concurso_qualidade set (security_invoker = true);

revoke all on public.vw_concurso_qualidade from anon;
grant select on public.vw_concurso_qualidade to authenticated, service_role;
