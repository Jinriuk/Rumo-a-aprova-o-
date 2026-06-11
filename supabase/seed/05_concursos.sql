-- ============================================================
-- SEED — CONCURSOS DO NICHO (conteúdo global, datas MÉDIAS)
-- ------------------------------------------------------------
-- Datas médias levantadas das últimas edições (2023–2026):
--   CN/CPACN:  10-11/ago/24, 26-27/jul/25, 1-2/ago/26  → ~01/08
--   EsSA/ESA:  08/out/23, 15/set/24                    → ~01/10
--   EPCAR:     02/jul/23, 23/jun/24                    → ~28/06
--   EsPCEx:    16-17/set/24 (hist. fim set/início out) → ~28/09
--   EEAr CFS:  19/nov/23 (2 edições/ano: ~jun e ~nov)  → ~16/11
--   CM:        20/out/24 (CMB), 29/out/23 (CMSM)       → ~25/10
-- São médias por definição: o operador ajusta quando o edital sai.
-- Idempotente.
-- ============================================================

insert into concursos (id, codigo, nome, organizacao, nivel, mes_prova, dia_prova, observacao, ordem) values
  ('c0c00000-0000-4000-8000-000000000001', 'cn',     'Colégio Naval (CPACN)',            'Marinha do Brasil',     'fundamental',
   8, 1,   'Prova em 2 dias, historicamente entre fim de julho e meados de agosto.', 0),
  ('c0c00000-0000-4000-8000-000000000002', 'epcar',  'EPCAR — Cadetes do Ar (CPCAR)',    'Força Aérea Brasileira','fundamental',
   6, 28,  'Prova historicamente entre fim de junho e início de julho.', 1),
  ('c0c00000-0000-4000-8000-000000000003', 'espcex', 'EsPCEx — Cadetes do Exército',     'Exército Brasileiro',   'medio',
   9, 28,  'Prova historicamente entre meados de setembro e início de outubro.', 2),
  ('c0c00000-0000-4000-8000-000000000004', 'essa',   'EsSA/ESA — Sargentos das Armas',   'Exército Brasileiro',   'medio',
   10, 1,  'Prova historicamente entre meados de setembro e meados de outubro.', 3),
  ('c0c00000-0000-4000-8000-000000000005', 'eear',   'EEAr — Sargentos da Aeronáutica (CFS)', 'Força Aérea Brasileira', 'medio',
   11, 16, 'Costuma ter DUAS edições por ano (≈junho e ≈novembro); data média da edição do 2º semestre.', 4),
  ('c0c00000-0000-4000-8000-000000000006', 'cm',     'Colégio Militar (CMs do Exército)','Exército Brasileiro',   'fundamental',
   10, 25, 'Cada CM tem edital próprio; provas concentradas em outubro.', 5)
  on conflict (codigo) do nothing;

-- alunos semeados entram no concurso do Colégio Naval
update alunos set concurso_id = 'c0c00000-0000-4000-8000-000000000001'
  where id in ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001')
    and concurso_id is null;
