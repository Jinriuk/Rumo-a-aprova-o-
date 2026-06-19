-- C1A: Diversificação e activação de dados demo
-- Aplicado manualmente em 2026-06-19 via execute_sql (Supabase MCP)
-- Escola: Matriz Educação RM (11111111-1111-4111-8111-111111111111)
-- Branch: claude/c1a-demo-credibilidade
--
-- PROBLEMA CORRIGIDO (C1A.1 / C1A.2):
--   Seed 13_vitrine_militar_demo.sql criava todos os alunos FORTE com
--   questoes=20, acertos=17 — e todos MEDIANO com q=15, acc=10 — e todos
--   RISCO com q=10, acc=4. O ranking e a ficha do aluno mostravam dados
--   identicos em blocos inteiros, sem variação credível.
--
-- SOLUÇÃO (diversificação):
--   UPDATE determinístico usando hashtext(re.id::text) como fonte de
--   pseudo-aleatoriedade por registro. Garante resultados estáveis entre
--   re-runs. Bandas:
--     FORTE   → q = 15-27, acerto = 75-92 %
--     MEDIANO → q = 10-20, acerto = 55-74 %
--     RISCO   → q =  5-14, acerto = 30-51 %
--   Identificação pelo padrão uniforme (n_regs + MIN=MAX questoes) —
--   não toca alunos existentes com dados já diversificados.

-- Reproduzir UPDATE de diversificação (idempotente: mesmos hashtext → mesmos valores):
WITH perfis AS (
  SELECT re2.aluno_id,
    CASE
      WHEN cnt.n = 12 AND cnt.q_min = 20 AND cnt.q_max = 20 THEN 'FORTE'
      WHEN cnt.n = 7  AND cnt.q_min = 15 AND cnt.q_max = 15 THEN 'MEDIANO'
      WHEN cnt.n <= 4 AND cnt.q_min = 10 AND cnt.q_max = 10 THEN 'RISCO'
    END AS perfil
  FROM (
    SELECT re.aluno_id,
      COUNT(*)         AS n,
      MIN(re.questoes) AS q_min,
      MAX(re.questoes) AS q_max
    FROM registros_estudo re
    JOIN alunos a ON re.aluno_id = a.id
    WHERE a.escola_id = '11111111-1111-4111-8111-111111111111'
    GROUP BY re.aluno_id
    HAVING (COUNT(*) = 12 AND MIN(re.questoes) = 20 AND MAX(re.questoes) = 20)
        OR (COUNT(*) = 7  AND MIN(re.questoes) = 15 AND MAX(re.questoes) = 15)
        OR (COUNT(*) <= 4 AND MIN(re.questoes) = 10 AND MAX(re.questoes) = 10)
  ) cnt
  JOIN registros_estudo re2 ON re2.aluno_id = cnt.aluno_id
),
novos AS (
  SELECT
    re.id,
    p.perfil,
    CASE p.perfil
      WHEN 'FORTE'   THEN 15 + (abs(hashtext(re.id::text))        % 13)
      WHEN 'MEDIANO' THEN 10 + (abs(hashtext(re.id::text))        % 11)
      WHEN 'RISCO'   THEN  5 + (abs(hashtext(re.id::text))        % 10)
    END AS novas_questoes,
    CASE p.perfil
      WHEN 'FORTE'   THEN abs(hashtext(re.id::text || 'a')) % 18
      WHEN 'MEDIANO' THEN abs(hashtext(re.id::text || 'a')) % 20
      WHEN 'RISCO'   THEN abs(hashtext(re.id::text || 'a')) % 22
    END AS fator_idx
  FROM registros_estudo re
  JOIN perfis p ON p.aluno_id = re.aluno_id
)
UPDATE registros_estudo re
SET
  questoes = n.novas_questoes,
  acertos  = LEAST(
    n.novas_questoes,
    ROUND(n.novas_questoes * (
      CASE n.perfil
        WHEN 'FORTE'   THEN 0.75 + n.fator_idx * 0.01
        WHEN 'MEDIANO' THEN 0.55 + n.fator_idx * 0.01
        WHEN 'RISCO'   THEN 0.30 + n.fator_idx * 0.01
      END
    ))::int
  )
FROM novos n
WHERE re.id = n.id;

-- C1A.4: Registros recentes (Jun 13-18) para 23 alunos sem atividade 7d
-- IDs determinísticos → ON CONFLICT DO NOTHING garante idempotência
-- Alunos ativados: 17 existentes (002-021 exceto 019/022) +
--                   4 RISCO em recuperação (027,038,055,057) +
--                   2 SEM → ativados (037,047)
-- Alunos mantidos inativos (12): 019,022,006,014 (existentes) +
--                                 4 RISCO defasados (029,039,045,059) +
--                                 4 SEM sem histórico (030,031,040,058)
INSERT INTO registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, questoes, acertos, minutos)
VALUES
(md5('c1a4act-000000000009-2026-06-14-ing')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000009','2026-06-14','ing',22,17,66),
(md5('c1a4act-000000000009-2026-06-17-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000009','2026-06-17','mat',24,19,72),
(md5('c1a4act-000000000017-2026-06-13-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000017','2026-06-13','fis',23,18,69),
(md5('c1a4act-000000000017-2026-06-17-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000017','2026-06-17','mat',25,20,75),
(md5('c1a4act-000000000011-2026-06-13-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000011','2026-06-13','mat',20,16,60),
(md5('c1a4act-000000000011-2026-06-18-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000011','2026-06-18','por',22,17,66),
(md5('c1a4act-000000000002-2026-06-14-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000002','2026-06-14','mat',21,16,63),
(md5('c1a4act-000000000002-2026-06-17-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000002','2026-06-17','por',20,15,60),
(md5('c1a4act-000000000010-2026-06-14-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000010','2026-06-14','por',19,15,57),
(md5('c1a4act-000000000010-2026-06-17-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000010','2026-06-17','mat',21,16,63),
(md5('c1a4act-000000000015-2026-06-14-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000015','2026-06-14','por',20,15,60),
(md5('c1a4act-000000000015-2026-06-17-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000015','2026-06-17','fis',18,14,54),
(md5('c1a4act-000000000013-2026-06-14-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000013','2026-06-14','fis',19,14,57),
(md5('c1a4act-000000000013-2026-06-17-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000013','2026-06-17','mat',20,15,60),
(md5('c1a4act-000000000016-2026-06-14-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000016','2026-06-14','mat',16,10,48),
(md5('c1a4act-000000000016-2026-06-18-ing')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000016','2026-06-18','ing',15,9,45),
(md5('c1a4act-000000000004-2026-06-15-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000004','2026-06-15','mat',15,10,45),
(md5('c1a4act-000000000004-2026-06-17-ing')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000004','2026-06-17','ing',14,9,42),
(md5('c1a4act-000000000005-2026-06-13-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000005','2026-06-13','mat',15,10,45),
(md5('c1a4act-000000000005-2026-06-17-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000005','2026-06-17','por',16,11,48),
(md5('c1a4act-000000000012-2026-06-15-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000012','2026-06-15','fis',14,9,42),
(md5('c1a4act-000000000012-2026-06-17-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000012','2026-06-17','por',15,10,45),
(md5('c1a4act-000000000018-2026-06-15-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000018','2026-06-15','por',13,8,39),
(md5('c1a4act-000000000020-2026-06-15-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000020','2026-06-15','mat',14,9,42),
(md5('c1a4act-000000000020-2026-06-17-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000020','2026-06-17','por',13,8,39),
(md5('c1a4act-000000000008-2026-06-14-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000008','2026-06-14','mat',13,8,39),
(md5('c1a4act-000000000021-2026-06-16-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000021','2026-06-16','mat',12,7,36),
(md5('c1a4act-000000000007-2026-06-15-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000007','2026-06-15','fis',11,6,33),
(md5('c1a4act-000000000003-2026-06-14-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000003','2026-06-14','mat',10,5,30),
(md5('c1a4act-000000000027-2026-06-15-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000027','2026-06-15','mat',8,3,24),
(md5('c1a4act-000000000038-2026-06-16-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000038','2026-06-16','por',7,2,21),
(md5('c1a4act-000000000055-2026-06-15-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000055','2026-06-15','fis',9,3,27),
(md5('c1a4act-000000000057-2026-06-16-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000057','2026-06-16','mat',8,4,24),
(md5('c1a4act-000000000037-2026-06-13-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000037','2026-06-13','mat',12,7,36),
(md5('c1a4act-000000000037-2026-06-16-por')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000037','2026-06-16','por',11,6,33),
(md5('c1a4act-000000000047-2026-06-14-fis')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000047','2026-06-14','fis',10,6,30),
(md5('c1a4act-000000000047-2026-06-17-mat')::uuid,'11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000047','2026-06-17','mat',12,7,36)
ON CONFLICT (id) DO NOTHING;

-- C1A.7: Restaurar cor_acento correta (lavanda → dourado padrão)
UPDATE escolas
SET cor_acento = '#CDA349'
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND cor_acento = '#e3d4f2';

-- Motor C0: re-processar eventos após alterações nos registros
SELECT app.backfill_progresso('11111111-1111-4111-8111-111111111111');
