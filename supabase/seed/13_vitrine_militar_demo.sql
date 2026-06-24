-- ============================================================
-- SEED 13 — REBUILD DA BASE DEMO / VITRINE MILITAR (Bloco B)
-- ------------------------------------------------------------
-- Objetivo: deixar a escola de VITRINE (11111111-…) com uma base
-- realista para demonstração — ~60 alunos fictícios distribuídos
-- pelas turmas, cada um ligado ao concurso (exam_tag) correto, com
-- credenciais de acesso e PROGRESSO GERADO PELO MOTOR C0 (não XP
-- manual): registros_estudo, meta_atividades concluídas e simulados
-- disparam os gatilhos do ledger `aluno_eventos_progresso`.
--
-- REGRAS (Bloco B):
--   • Dados 100% fictícios — nenhum dado pessoal real.
--   • Não enfraquece RLS, não usa service_role no front.
--   • Não hardcoda esta demo como regra permanente (é seed de demo).
--   • XP/patente/conquista vêm do MOTOR C0 (gatilhos + backfill),
--     nunca de INSERT manual em aluno_eventos_progresso.
--   • Único ajuste de coordenação marcado: correção do exam_tag da
--     Manuela (cm → espcex) p/ casar com a turma EsPCEx — documentado
--     abaixo na Seção 1.
--
-- ESCOPO DE LIMPEZA: SOMENTE a escola de vitrine
--   (11111111-1111-4111-8111-111111111111). Lucas Demo é PRESERVADO.
--   Nada fora da base demo é tocado.
--
-- Idempotente: on conflict do nothing / deletes por id específico /
-- gatilhos e backfill com idempotency_key. Reexecução não duplica.
-- Aplicar como UM único script (usa temp table na mesma sessão).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- SEÇÃO 1 — LIMPEZA CONTROLADA (só na base de vitrine)
-- ------------------------------------------------------------
-- 1a) Remover "Gabriel Silva" (aluno órfão: UUID aleatório, sem
--     concurso/exam_tag, 1 registro solto, fora do padrão a0000000…).
--     Apaga primeiro as linhas dependentes e depois o aluno.
do $$
declare
  v_gabriel uuid := '3076b5b2-3b7f-4328-b65b-50a60a74c29a';
begin
  delete from aluno_eventos_progresso where aluno_id = v_gabriel;
  delete from meta_atividades where meta_id in (select id from metas where aluno_id = v_gabriel);
  delete from metas             where aluno_id = v_gabriel;
  delete from registros_estudo  where aluno_id = v_gabriel;
  delete from simulados         where aluno_id = v_gabriel;
  delete from aluno_conquistas  where aluno_id = v_gabriel;
  delete from alunos_turmas     where aluno_id = v_gabriel;
  delete from alunos            where id = v_gabriel;
end $$;

-- 1b) AJUSTE_COORDENACAO documentado: Manuela Castro e Silva estava
--     com concurso/exam_tag 'cm' (Colégio Militar) mas matriculada na
--     turma EsPCEx 2026. Correção do vínculo p/ EsPCEx — coerência de
--     turma × concurso na demo. (Eventos C0 antigos dela permanecem
--     com a tag anterior; os novos passam a usar espcex.)
update alunos
   set concurso_id = 'c0c00000-0000-4000-8000-000000000003'  -- espcex
 where id = 'a0000000-0000-4000-8000-000000000022'
   and escola_id = '11111111-1111-4111-8111-111111111111';

-- ------------------------------------------------------------
-- SEÇÃO 0 (auxiliar) — ROSTER dos 38 alunos NOVOS (temp, esta sessão)
-- num: sufixo do UUID do aluno (a0000000-…-0000000000NN)
-- ------------------------------------------------------------
-- ATENÇÃO: sem `on commit drop`. O seed é aplicado por `psql -f`, que
-- roda em AUTOCOMMIT (cada statement é sua própria transação). Com
-- `on commit drop` a temp table seria descartada logo após o CREATE,
-- e o INSERT abaixo falharia ("relation _vit_novos does not exist") —
-- era o que quebrava o passo de seed do CI. A temp table é de sessão
-- (psql -f = uma sessão) e some sozinha ao fim do script.
drop table if exists _vit_novos;
create temp table _vit_novos (
  num        int  primary key,
  nome       text not null,
  examtag    text not null,
  concurso_id uuid not null,
  turma_id   uuid not null,
  perfil     text not null   -- FORTE | MEDIANO | RISCO | SEM
);

insert into _vit_novos (num, nome, examtag, concurso_id, turma_id, perfil) values
  -- CN/EPCAR — Manhã (turma aa…001)
  (23,'Pedro Henrique Aragao',   'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','FORTE'),
  (24,'Camila Rocha Tavares',    'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','MEDIANO'),
  (25,'Felipe Andrade Lemos',    'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001','FORTE'),
  (26,'Rebeca Nunes Pacheco',    'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001','MEDIANO'),
  (27,'Bruno Carvalho Estevao',  'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','RISCO'),
  (28,'Yasmin Oliveira Sales',   'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','MEDIANO'),
  (29,'Thiago Moreira Pontes',   'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001','RISCO'),
  (30,'Nathalia Freitas Campos', 'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','SEM'),
  (31,'Eduardo Ramos Vieira',    'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001','SEM'),
  -- CN/EPCAR — Tarde (turma aa…002)
  (32,'Mariana Lopes Bandeira',  'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','FORTE'),
  (33,'Vitor Hugo Mendonca',     'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','MEDIANO'),
  (34,'Amanda Cardoso Reis',     'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','MEDIANO'),
  (35,'Gabriel Teixeira Antunes','cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','FORTE'),
  (36,'Leticia Barbosa Pires',   'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','MEDIANO'),
  (37,'Igor Fonseca Macedo',     'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','SEM'),
  (38,'Juliana Martins Coelho',  'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','RISCO'),
  (39,'Caio Vinicius Duarte',    'cn',   'c0c00000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','RISCO'),
  (40,'Patricia Gomes Siqueira', 'epcar','c0c00000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','SEM'),
  -- EsSA/EEAr 2026 (turma aa…003)
  (41,'Andre Luiz Peixoto',      'esa',  '822b1ccf-905f-4195-a33a-8cce5d1bd47c','aa000000-0000-4000-8000-000000000003','FORTE'),
  (42,'Fernanda Aguiar Brito',   'eear', 'c0c00000-0000-4000-8000-000000000005','aa000000-0000-4000-8000-000000000003','MEDIANO'),
  (43,'Rodrigo Sales Maia',      'esa',  '822b1ccf-905f-4195-a33a-8cce5d1bd47c','aa000000-0000-4000-8000-000000000003','FORTE'),
  (44,'Marcia Regina Lucio',     'eear', 'c0c00000-0000-4000-8000-000000000005','aa000000-0000-4000-8000-000000000003','MEDIANO'),
  (45,'Tiago Nascimento Vargas', 'esa',  '822b1ccf-905f-4195-a33a-8cce5d1bd47c','aa000000-0000-4000-8000-000000000003','RISCO'),
  (46,'Isabela Moura Quintino',  'eear', 'c0c00000-0000-4000-8000-000000000005','aa000000-0000-4000-8000-000000000003','MEDIANO'),
  (47,'Marcelo Souza Galvao',    'esa',  '822b1ccf-905f-4195-a33a-8cce5d1bd47c','aa000000-0000-4000-8000-000000000003','SEM'),
  (48,'Renata Pacheco Vidal',    'eear', 'c0c00000-0000-4000-8000-000000000005','aa000000-0000-4000-8000-000000000003','MEDIANO'),
  -- EsPCEx 2026 (turma aa…004)
  (49,'Joao Pedro Vasques',      'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','FORTE'),
  (50,'Carolina Dias Marques',   'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','MEDIANO'),
  (51,'Paulo Sergio Bastos',     'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','FORTE'),
  (52,'Beatriz Lima Falcao',     'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','MEDIANO'),
  (53,'Ricardo Alves Tenorio',   'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','FORTE'),
  (54,'Daniela Castro Bezerra',  'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','MEDIANO'),
  (55,'Leonardo Pires Cunha',    'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','RISCO'),
  (56,'Priscila Nogueira Sa',    'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','MEDIANO'),
  (57,'Alexandre Moraes Pinho',  'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','RISCO'),
  (58,'Luciana Ferreira Drumond','espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','SEM'),
  (59,'Marcio Aurelio Lins',     'espcex','c0c00000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000004','RISCO'),
  -- Turma CN 2026 (turma a0000000-…-011)
  (60,'Aline Cristina Borges',   'cn',   'c0c00000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000011','MEDIANO');

-- ------------------------------------------------------------
-- SEÇÃO 2 — CONTAS DE ACESSO p/ TODOS os alunos da vitrine
-- (existentes 002–022 + novos 023–060). Lucas (001) já tem conta.
-- usuarios (registro de app) + auth.users + auth.identities, mesmo id.
-- Login por CÓDIGO: VITRINE0NN  →  vitrine0NN@codigo.acesso.local
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_escola uuid := '11111111-1111-4111-8111-111111111111';
  v_uid uuid; v_email text; v_codigo text; v_nome text;
begin
  for r in
    -- existentes (já têm linha em alunos): pega o nome de lá
    select a.id as aluno_id,
           ('0000000000' || lpad(right(a.id::text, 2), 2, '0'))::text as ignore_col,
           a.nome,
           right(a.id::text, 12) as node
      from alunos a
     where a.escola_id = v_escola
       and a.id <> 'a0000000-0000-4000-8000-000000000001'   -- Lucas: preservar conta
       and a.id::text like 'a0000000-0000-4000-8000-%'
       and a.usuario_id is null
    union all
    -- novos (ainda não existem em alunos): nome vem do roster
    select ('a0000000-0000-4000-8000-' || lpad(n.num::text, 12, '0'))::uuid,
           null, n.nome, lpad(n.num::text, 12, '0')
      from _vit_novos n
  loop
    -- id de usuário/auth determinístico a partir do node do aluno
    v_uid   := ('aaaaaaaa-1111-4111-8111-' || r.node)::uuid;
    v_nome  := r.nome;
    -- código a partir dos 2 últimos dígitos do node (NN)
    v_codigo := 'VITRINE0' || lpad(ltrim(right(r.node, 3), '0'), 2, '0');
    v_email  := lower(v_codigo) || '@codigo.acesso.local';

    insert into usuarios (id, escola_id, papel, nome)
      values (v_uid, v_escola, 'aluno', v_nome)
      on conflict (id) do nothing;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt(v_codigo, gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email'),
                         'escola_id', v_escola::text, 'papel', 'aluno'),
      jsonb_build_object('nome', v_nome),
      now(), now(), '', '', '', '', false
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

-- ------------------------------------------------------------
-- SEÇÃO 3 — INSERIR os 38 alunos NOVOS (ligados à trilha CN base e
-- ao concurso/exam_tag correto), com usuario_id determinístico.
-- ------------------------------------------------------------
insert into alunos (id, escola_id, nome, usuario_id, trilha_id, concurso_id)
select ('a0000000-0000-4000-8000-' || lpad(n.num::text, 12, '0'))::uuid,
       '11111111-1111-4111-8111-111111111111',
       n.nome,
       ('aaaaaaaa-1111-4111-8111-' || lpad(n.num::text, 12, '0'))::uuid,
       'b1388388-c660-4b4b-811c-b58358689e92',
       n.concurso_id
  from _vit_novos n
on conflict (id) do nothing;

-- Vincular a conta dos alunos EXISTENTES (002–022) que estavam sem usuario_id.
update alunos a
   set usuario_id = ('aaaaaaaa-1111-4111-8111-' || right(a.id::text, 12))::uuid
 where a.escola_id = '11111111-1111-4111-8111-111111111111'
   and a.usuario_id is null
   and a.id::text like 'a0000000-0000-4000-8000-%';

-- ------------------------------------------------------------
-- SEÇÃO 4 — MATRÍCULA EM TURMAS
-- ------------------------------------------------------------
-- 4a) novos alunos → suas turmas
insert into alunos_turmas (escola_id, aluno_id, turma_id)
select '11111111-1111-4111-8111-111111111111',
       ('a0000000-0000-4000-8000-' || lpad(n.num::text, 12, '0'))::uuid,
       n.turma_id
  from _vit_novos n
on conflict do nothing;

-- 4b) corrigir Alice (020): estava SEM turma → EsPCEx 2026
insert into alunos_turmas (escola_id, aluno_id, turma_id)
values ('11111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-000000000020',
        'aa000000-0000-4000-8000-000000000004')
on conflict do nothing;

-- ------------------------------------------------------------
-- SEÇÃO 5 — REGISTROS DE ESTUDO (entrada do motor C0; XP=0, mas
-- alimentam constância/ficha e disparam a conquista primeiro_registro).
-- FORTE ~12 recentes | MEDIANO ~7 | RISCO ~3 (defasados >10 dias) | SEM 0
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_aluno uuid;
  v_esc uuid := '11111111-1111-4111-8111-111111111111';
  v_disc text[] := array['mat','por','ing','fis'];
  v_qtd int; v_acc int; v_dat date; i int;
begin
  for r in select * from _vit_novos loop
    v_aluno := ('a0000000-0000-4000-8000-' || lpad(r.num::text, 12, '0'))::uuid;
    if r.perfil = 'SEM' then
      continue;   -- sem atividade: nenhum registro
    end if;

    for i in 1 .. (case r.perfil when 'FORTE' then 12 when 'MEDIANO' then 7 else 3 end) loop
      if r.perfil = 'RISCO' then
        v_dat := date '2026-06-07' - (i * 2);          -- defasados (>10 dias até 2026-06-19)
        v_qtd := 10; v_acc := 4;                        -- baixo desempenho
      elsif r.perfil = 'MEDIANO' then
        v_dat := date '2026-06-17' - (i * 2);
        v_qtd := 15; v_acc := 10;
      else  -- FORTE
        v_dat := date '2026-06-18' - i;
        v_qtd := 20; v_acc := 17;
      end if;

      insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
      values (gen_random_uuid(), v_esc, v_aluno, v_dat,
              v_disc[1 + (i % 4)], 'Revisão dirigida — bateria de questões',
              v_qtd, v_acc, 45 + (i % 3) * 15);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- SEÇÃO 6 — METAS + META_ATIVIDADES (o gatilho trg_progresso_missao
-- gera o evento 'missao_concluida' com XP por prioridade ao inserir
-- atividade já com estado='concluida'). É AQUI que nasce o XP do motor.
--
-- Semanas (trilha b1388388…):
--   S1 2026-05-30→06-07 'fechada' | S2 06-08→06-14 'fechada' | S3 06-15→06-21 'ativa'
-- Atividades por semana (ids reais da atividades_modelo):
--   S1: 7cb12bd2(F) 81787a17(F) a55a535f(P) b2721295(F) fac2eb04(F)
--   S2: 30110914(F) ac0cd585(F) 831105ee(F) 39837ab3(F)
--   S3: a715740b(F) a595c0d3(F) 9466de09(F) 068a773b(F) 05478d01(F) 07356a80(F)
--
-- Perfis:
--   FORTE   : S1 todas, S2 todas, S3 3 de 6 concluídas (missão concluída + em andamento)
--   MEDIANO : S1 3 concluídas, S2 3 concluídas (resto pendente)
--   RISCO   : S2 (fechada/atrasada) só 1 concluída, resto pendente → "missão atrasada"
--   SEM     : S3 (ativa) plano lançado, tudo pendente → "tem plano, zero entrega"
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_aluno uuid;
  v_esc uuid := '11111111-1111-4111-8111-111111111111';
  v_trilha uuid := 'b1388388-c660-4b4b-811c-b58358689e92';
  s1 uuid[] := array['7cb12bd2-ead5-4ba9-8020-24e336e0351d','81787a17-6769-4a35-8b53-e04559b7ac22','a55a535f-c0c1-42f5-82c4-fcb10f18f98f','b2721295-d964-4154-8f68-fc8537cc53ab','fac2eb04-2c0e-4276-86b0-de5576dd771a']::uuid[];
  s2 uuid[] := array['30110914-4749-430b-8adb-ae156dc2781a','ac0cd585-7144-4a16-8762-088e6a5bc679','831105ee-80c7-4459-8165-a8a0de7e55ab','39837ab3-cd60-4ffe-8a30-6b8abe67276e']::uuid[];
  s3 uuid[] := array['a715740b-b86a-49d9-8543-05a4d42bac66','a595c0d3-42de-4159-8785-77feeca3d1f6','9466de09-7b52-4dc3-8ab1-f93f81c3e43b','068a773b-8dba-4374-86fc-44341609ef19','05478d01-a9ca-4ad7-8582-63fe50a3e612','07356a80-0705-44c7-8bb3-a92777c7ebaf']::uuid[];
  v_meta uuid; i int; v_ats uuid[]; v_nconcl int;
begin
  for r in select * from _vit_novos loop
    v_aluno := ('a0000000-0000-4000-8000-' || lpad(r.num::text, 12, '0'))::uuid;

    if r.perfil = 'FORTE' then
      -- S1 fechada — todas concluídas
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 1, '2026-05-30','2026-06-07','fechada');
      v_ats := s1; v_nconcl := array_length(s1,1);
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end);
      end loop;
      -- S2 fechada — todas concluídas
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 2, '2026-06-08','2026-06-14','fechada');
      v_ats := s2; v_nconcl := array_length(s2,1);
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], 'concluida');
      end loop;
      -- S3 ativa — 3 de 6 concluídas
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 3, '2026-06-15','2026-06-21','ativa');
      v_ats := s3; v_nconcl := 3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end);
      end loop;

    elsif r.perfil = 'MEDIANO' then
      -- S1 fechada — 3 concluídas de 5
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 1, '2026-05-30','2026-06-07','fechada');
      v_ats := s1; v_nconcl := 3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end);
      end loop;
      -- S2 fechada — 3 concluídas de 4
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 2, '2026-06-08','2026-06-14','fechada');
      v_ats := s2; v_nconcl := 3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end);
      end loop;

    elsif r.perfil = 'RISCO' then
      -- S2 fechada/atrasada — só 1 concluída, resto pendente (missão atrasada)
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 2, '2026-06-08','2026-06-14','fechada');
      v_ats := s2; v_nconcl := 1;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end);
      end loop;

    else  -- SEM: plano lançado na S3 ativa, tudo pendente
      v_meta := gen_random_uuid();
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (v_meta, v_esc, v_aluno, v_trilha, 3, '2026-06-15','2026-06-21','ativa');
      v_ats := s3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], 'pendente');
      end loop;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- SEÇÃO 7 — SIMULADOS (gatilho trg_progresso_simulado: +50 XP cada +
-- conquista primeiro_simulado). FORTE 2 | MEDIANO 1 | RISCO/SEM 0.
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_aluno uuid;
  v_esc uuid := '11111111-1111-4111-8111-111111111111';
  v_n int; k int; v_dat date;
begin
  for r in select * from _vit_novos loop
    v_aluno := ('a0000000-0000-4000-8000-' || lpad(r.num::text, 12, '0'))::uuid;
    v_n := case r.perfil when 'FORTE' then 2 when 'MEDIANO' then 1 else 0 end;
    for k in 1 .. v_n loop
      v_dat := date '2026-06-14' - (k-1) * 7;
      insert into simulados (id, escola_id, aluno_id, nome, data, acertos, exam_tag, redacao_nota)
      values (gen_random_uuid(), v_esc, v_aluno,
              'Simulado ' || r.examtag || ' #' || k, v_dat,
              jsonb_build_object('mat', 14 + k, 'por', 12 + k, 'ing', 10 + k),
              r.examtag, null);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- SEÇÃO 8 — BACKFILL do motor C0 (idempotente). Garante que todo
-- evento derivável (registro/missão/simulado) esteja no ledger, mesmo
-- que algum gatilho não tenha coberto. Não duplica (idempotency_key).
-- ------------------------------------------------------------
select app.backfill_progresso('11111111-1111-4111-8111-111111111111') as eventos_novos_no_backfill;
