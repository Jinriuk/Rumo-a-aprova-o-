-- ============================================================
-- SEED DE DESENVOLVIMENTO — escolas de vitrine e de contraste
-- ------------------------------------------------------------
-- SÓ para ambiente de desenvolvimento/demo. NÃO rodar em
-- produção real (Doc 6, seção 7). Idempotente: on conflict.
--
-- Escola A = vitrine fictícia (Doc 6, 1.4). Escola B existe para
-- UMA coisa: provar que A não enxerga B nem B enxerga A (Bloco 0).
--
-- IDs fixos para os testes e para o seed de usuários no Auth
-- (scripts/seed-auth-usuarios.mjs usa os mesmos).
-- ============================================================

insert into escolas (id, nome, slug, logo_url, cor_acento) values
  ('11111111-1111-4111-8111-111111111111', 'Colégio Vitrine Naval', 'vitrine',  null, '#CDA349'),
  ('22222222-2222-4222-8222-222222222222', 'Curso Beta Preparatório', 'beta',    null, '#49B6CF')
  on conflict (slug) do nothing;

-- usuários (mesmos ids que as contas do Auth recebem no seed real)
insert into usuarios (id, escola_id, papel, nome) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'coordenacao', 'Coordenação Vitrine'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aluno',       'Lucas'),
  ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'responsavel', 'Responsável do Lucas'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'coordenacao', 'Coordenação Beta'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'aluno',       'Bruno'),
  ('bbbbbbbb-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'responsavel', 'Responsável do Bruno')
  on conflict (id) do nothing;

insert into turmas (id, escola_id, nome) values
  ('a0000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'Turma CN 2026'),
  ('b0000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222', 'Turma CN 2026')
  on conflict (escola_id, nome) do nothing;

-- Lucas: o primeiro aluno da escola de vitrine (migração — Doc 6, seção 6).
-- Bruno: o aluno da escola B, dado de contraste do teste de isolamento.
insert into alunos (id, escola_id, nome, usuario_id, trilha_id) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Lucas',
   'aaaaaaaa-0000-4000-8000-000000000002', 'b1388388-c660-4b4b-811c-b58358689e92'),
  ('b0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Bruno',
   'bbbbbbbb-0000-4000-8000-000000000002', 'b1388388-c660-4b4b-811c-b58358689e92')
  on conflict (id) do nothing;

insert into alunos_turmas (escola_id, aluno_id, turma_id) values
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011'),
  ('22222222-2222-4222-8222-222222222222', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000011')
  on conflict do nothing;

insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values
  ('a0000000-0000-4000-8000-000000000021', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000021', '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001')
  on conflict (responsavel_id, aluno_id) do nothing;

-- consentimento existe como registro desde o MVP (Doc 4, seção 8)
insert into consentimentos (id, escola_id, aluno_id, responsavel_nome, termo_versao, registrado_por) values
  ('a0000000-0000-4000-8000-000000000031', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', 'Responsável do Lucas', 'v1', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000031', '22222222-2222-4222-8222-222222222222',
   'b0000000-0000-4000-8000-000000000001', 'Responsável do Bruno', 'v1', 'bbbbbbbb-0000-4000-8000-000000000001')
  on conflict (id) do nothing;
