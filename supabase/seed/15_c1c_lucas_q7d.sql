-- C1C.1 — Corrigir registros irreais de "Lucas" (a0000000-0000-4000-8000-000000000001)
-- Dois registros tinham volumes absurdos (350 e 150 questões em uma sessão),
-- elevando q_7d para 595 — irreal para qualquer cadete em demo.
-- Reduzidos para valores plausíveis (35 e 40 questões), mantendo acerto ~80%.
-- Novo q_7d: 35+40+20+25+50 = 170 questões (topo do ranking, mas crível).
-- Aplicado em 2026-06-19 via Supabase MCP. Não afeta o aluno vitrine (uuid 005).

UPDATE registros_estudo
SET questoes = 35, acertos = 28
WHERE id = '629d7c67-937b-48aa-b020-249e29891b53';
-- era: questoes=350, acertos=275 (mat · Conjuntos · 2026-06-14)

UPDATE registros_estudo
SET questoes = 40, acertos = 32
WHERE id = '48c5b268-3d7e-4b17-a158-423dfb7cc871';
-- era: questoes=150, acertos=120 (mat · geometria · 2026-06-15)
