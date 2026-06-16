-- ============================================================
-- 0023 — ÍNDICES DE ESCALA PARA A COORDENAÇÃO (Fase B-min, B.5).
-- ------------------------------------------------------------
-- `registros_estudo`, `metas`, `simulados` e `consentimentos` têm
-- índice em aluno_id, mas NUNCA tiveram índice em escola_id — e é por
-- escola_id que a RLS (e a função resumo_escola(), migration 0016)
-- filtra essas 4 tabelas a cada abertura da Área da Escola:
--   • registros_estudo r where r.escola_id = app.tenant_id()   (0016, CTE reg)
--   • metas m            where m.escola_id = app.tenant_id() and m.status = 'ativa' (0016, CTE meta)
--   • simulados_select                      using (escola_id = app.tenant_id() ...) (0002_rls)
--   • consentimentos_coordenacao            using (escola_id = app.tenant_id() ...) (0002_rls)
-- Sem índice em escola_id, cada uma dessas consultas faz sequential
-- scan da tabela MULTI-TENANT INTEIRA (todas as escolas do sistema,
-- não só a que está sendo consultada) — um problema que cresce com o
-- sistema todo, não só com os 300–500 alunos de uma escola. Com 300+
-- alunos lançando registros diariamente isso já é visível no piloto.
-- Aditiva, não toca em política de RLS nem em dado existente.
-- ============================================================

create index if not exists idx_registros_escola     on registros_estudo (escola_id);
create index if not exists idx_metas_escola_status   on metas (escola_id, status);
create index if not exists idx_simulados_escola      on simulados (escola_id);
create index if not exists idx_consentimentos_escola on consentimentos (escola_id);
