-- ============================================================
-- 0062 — concurso sem data de prova e prontidão "pré-edital"
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono.
-- ORIGEM: item P0.2 de docs/conteudo/pmerj-cfo/
--   PMERJ_CFO_Desenho_da_Trilha_e_Auditoria_do_Banco.md (seções 4.2 e 4.3).
--
-- O PROBLEMA
--   `concursos.mes_prova` e `dia_prova` são NOT NULL desde a 0007. Um
--   concurso pré-edital (o CFO PMERJ, sem data publicada) só entraria no
--   catálogo com uma data inventada, e `proximaProva` (concursos.js)
--   transformaria essa data numa contagem regressiva anual falsa.
--   E a matriz de maturidade só conhece completa | beta | esqueleto |
--   indisponivel: não há como dizer "calendário pronto, programa ainda
--   histórico" sem marcar o próximo edital como oficial.
--
-- A MUDANÇA
--   1. mes_prova e dia_prova aceitam NULL, mas só os DOIS juntos:
--      ou a data média inteira, ou nenhuma. Os CHECKs de faixa da 0007
--      continuam valendo quando há valor.
--   2. `concursos.maturidade` aceita 'pre_edital'. A regra de produto
--      vive em app/src/modules/conteudo/maturidade.js (fonte única).
--   3. vw_concurso_qualidade passa a flagrar 'pre_edital' sem assunto
--      catalogado, como já fazia com 'completa' e 'beta'.
--
-- Aditiva. Idempotente. Não altera dado: nenhum concurso existente muda
-- de data nem de maturidade. Nenhuma função lê mes_prova/dia_prova no
-- banco; quem lê é o front, que trata o vazio no PR de front irmão.
--
-- ROLLBACK (manual; só se nenhum concurso tiver data vazia nem
-- maturidade 'pre_edital', senão o NOT NULL/CHECK recusa):
--   alter table concursos drop constraint if exists concursos_data_prova_par;
--   alter table concursos alter column mes_prova set not null;
--   alter table concursos alter column dia_prova set not null;
--   alter table concursos drop constraint concursos_maturidade_check;
--   alter table concursos add constraint concursos_maturidade_check
--     check (maturidade in ('completa', 'beta', 'esqueleto', 'indisponivel'));
--   e reaplicar a view da 0034.
-- ============================================================

-- 1) Data da prova opcional, sempre em par.
alter table concursos alter column mes_prova drop not null;
alter table concursos alter column dia_prova drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'concursos_data_prova_par'
  ) then
    alter table concursos
      add constraint concursos_data_prova_par
      check ((mes_prova is null) = (dia_prova is null));
  end if;
end $$;

comment on column concursos.mes_prova is
  'Mês da data MÉDIA da prova (1–12). NULL junto com dia_prova = data não confirmada (pré-edital): a UI mostra "Data da prova aguardando edital" e não conta dias.';
comment on column concursos.dia_prova is
  'Dia da data MÉDIA da prova (1–31). NULL junto com mes_prova = data não confirmada (pré-edital).';

-- 2) Maturidade 'pre_edital'. Recria o CHECK da 0034 com o valor novo.
alter table concursos drop constraint if exists concursos_maturidade_check;
alter table concursos
  add constraint concursos_maturidade_check
  check (maturidade in ('completa', 'pre_edital', 'beta', 'esqueleto', 'indisponivel'));

comment on column concursos.maturidade is
  'Maturidade do conteúdo: completa | pre_edital | beta | esqueleto | indisponivel. Fonte única: app/src/modules/conteudo/maturidade.js; gravado pelo seed 18. pre_edital = calendário liberado sobre programa histórico, com aviso. UI nunca exibe não-completa como pronta.';

-- 3) A view de auditoria cobre o nível novo. Mesmas colunas, na mesma
--    ordem, da 0034: só muda a expressão de suspeita_incoerencia.
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
    (c.maturidade in ('completa', 'pre_edital', 'beta')
       and (select count(*) from assuntos a where a.exam_tag = c.codigo) = 0)     as suspeita_incoerencia
  from concursos c;

alter view public.vw_concurso_qualidade set (security_invoker = true);
