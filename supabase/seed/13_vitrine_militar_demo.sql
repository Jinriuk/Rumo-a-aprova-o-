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
-- SEÇÃO 1c (Onda 8) — AS TURMAS DA VITRINE
-- ------------------------------------------------------------
-- Nenhum seed criava estas turmas: elas existiam só no banco do demo,
-- feitas à mão, e os seeds 13 e 17 as referenciavam como se fossem
-- dadas. O seed nunca foi auto-contido — num ambiente novo (ou no CI,
-- agora que ele roda aqui) o insert quebrava na FK
-- `alunos_turmas_turma_id_fkey`. Mesmo vício do concurso do EsSA logo
-- abaixo: estado de ambiente tratado como estado de seed.
--
-- Os nomes são os que o demo já usa, para os dois ambientes baterem.
-- `on conflict do nothing` sem alvo cobre tanto a colisão de id quanto
-- a de (escola_id, nome), que é a unique de turmas.
insert into turmas (id, escola_id, nome) values
  ('aa000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'CN/EPCAR — Manhã'),
  ('aa000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'CN/EPCAR — Tarde'),
  ('aa000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'EsSA/EEAr 2026'),
  ('aa000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'EsPCEx 2026'),
  ('aa000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'Beta CN — Noite')
  on conflict do nothing;

-- ------------------------------------------------------------
-- SEÇÃO 1d (Onda 8) — OS 21 ALUNOS BASE DA VITRINE (002–022)
-- ------------------------------------------------------------
-- Terceira camada do mesmo vício das duas seções acima, e a mais
-- profunda: este seed tratava os alunos 002–022 como "existentes",
-- mas NENHUM seed os criava — eles nasceram à mão no banco do demo.
-- Ou seja, o 13 não era um construtor da vitrine: era um patch
-- incremental que só rodava sobre um banco que já se parecia com o
-- demo de junho/2026. Em ambiente novo quebrava na FK
-- `alunos_turmas_aluno_id_fkey`.
--
-- Com estes 21 aqui, o seed passa a montar a vitrine inteira do zero —
-- que é o que faz dele um seed, e o que permite ao CI exercitá-lo.
-- Os nomes e vínculos são os que o demo já tem, para os dois ambientes
-- convergirem. O concurso sai do `codigo` (ver nota do EsSA adiante),
-- nunca de um id de ambiente.
drop table if exists _vit_base;
create temp table _vit_base (
  num int primary key, nome text not null, examtag text not null, turma_id uuid not null
);
insert into _vit_base (num, nome, examtag, turma_id) values
  (2, 'Maria Eduarda Santana',                 'cn',    'aa000000-0000-4000-8000-000000000001'),
  (3, 'Joao Guilherme Vasconcelos',            'cn',    'aa000000-0000-4000-8000-000000000001'),
  (4, 'Ana Beatriz Figueiredo',                'epcar', 'aa000000-0000-4000-8000-000000000001'),
  (5, 'Lucas Gabriel Monteiro da Silva',       'cn',    'aa000000-0000-4000-8000-000000000001'),
  (6, 'Isabela Cristina Nogueira',             'epcar', 'aa000000-0000-4000-8000-000000000001'),
  (7, 'Matheus Oliveira Brandao',              'cn',    'aa000000-0000-4000-8000-000000000001'),
  (8, 'Sofia Almeida Castelo Branco',          'epcar', 'aa000000-0000-4000-8000-000000000001'),
  (9, 'Davi Luiz Carvalho Pinto',              'cn',    'aa000000-0000-4000-8000-000000000002'),
  (10,'Larissa Mendes Sarmento',               'cn',    'aa000000-0000-4000-8000-000000000002'),
  (11,'Gustavo Henrique de Souza Lima',        'epcar', 'aa000000-0000-4000-8000-000000000002'),
  (12,'Julia Apolinario dos Santos Oliveira',  'cn',    'aa000000-0000-4000-8000-000000000002'),
  (13,'Enzo Rafael Cavalcanti',                'epcar', 'aa000000-0000-4000-8000-000000000002'),
  (14,'Valentina Duarte Magalhaes',            'cn',    'aa000000-0000-4000-8000-000000000002'),
  (15,'Miguel Angelo Barros Correia',          'esa',   'aa000000-0000-4000-8000-000000000003'),
  (16,'Helena Vitoria Dantas',                 'eear',  'aa000000-0000-4000-8000-000000000003'),
  (17,'Arthur Felipe Rodrigues do Nascimento', 'esa',   'aa000000-0000-4000-8000-000000000003'),
  (18,'Laura Camargo Bittencourt',             'eear',  'aa000000-0000-4000-8000-000000000003'),
  (19,'Bernardo Luca Teixeira',                'esa',   'aa000000-0000-4000-8000-000000000003'),
  (20,'Alice Fernandes Quintanilha',           'espcex','aa000000-0000-4000-8000-000000000004'),
  (21,'Rafael Augusto Vilanova',               'espcex','aa000000-0000-4000-8000-000000000004'),
  (22,'Manuela Castro e Silva',                'espcex','aa000000-0000-4000-8000-000000000004');

insert into alunos (id, escola_id, nome, trilha_id, concurso_id)
select ('a0000000-0000-4000-8000-' || lpad(b.num::text, 12, '0'))::uuid,
       '11111111-1111-4111-8111-111111111111',
       b.nome,
       'b1388388-c660-4b4b-811c-b58358689e92',
       c.id
  from _vit_base b join concursos c on c.codigo = b.examtag
on conflict (id) do nothing;

insert into alunos_turmas (escola_id, aluno_id, turma_id)
select '11111111-1111-4111-8111-111111111111',
       ('a0000000-0000-4000-8000-' || lpad(b.num::text, 12, '0'))::uuid, b.turma_id
  from _vit_base b
on conflict do nothing;

-- A13 (Onda 8): `data_prova_alvo` estava nulo em TODOS os alunos — era
-- a causa raiz que a Onda 3 apontou para T27 e C9. Sem ela o app cai na
-- data ESTIMADA do concurso (média histórica), que é o certo como
-- fallback mas não como regra. Aqui a vitrine passa a ter data real,
-- derivada do mês/dia do concurso e sempre no FUTURO: se a data deste
-- ano já passou, vai para o ano que vem. Assim a contagem regressiva da
-- demonstração nunca nasce negativa nem zerada.
update alunos a
   set data_prova_alvo = case
         when make_date(extract(year from app.hoje_local())::int, c.mes_prova, c.dia_prova) >= app.hoje_local()
           then make_date(extract(year from app.hoje_local())::int,     c.mes_prova, c.dia_prova)
           else make_date(extract(year from app.hoje_local())::int + 1, c.mes_prova, c.dia_prova)
       end
  from concursos c
 where c.id = a.concurso_id
   and a.escola_id = '11111111-1111-4111-8111-111111111111'
   and c.mes_prova is not null and c.dia_prova is not null;

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

-- Onda 8: os `concurso_id` acima são apenas um valor inicial. O do EsSA
-- estava cravado como '822b1ccf-…', um id que só existia no banco do
-- demo — num ambiente novo (ou no CI, agora que este seed roda lá) o
-- insert quebrava na FK `alunos_concurso_id_fkey`. O seed carregava um
-- id de AMBIENTE, e isso nunca apareceu porque o arquivo não era
-- exercitado. O roster já tem o `examtag`, que é a chave estável: a
-- resolução passa a ser por ele, e qualquer id da lista vira irrelevante.
update _vit_novos n
   set concurso_id = c.id
  from concursos c
 where c.codigo = n.examtag;

-- ------------------------------------------------------------
-- SEÇÃO 2 — REGISTRO DE APP p/ TODOS os alunos da vitrine
-- (existentes 002–022 + novos 023–060). Lucas (001) já tem conta.
--
-- Onda 8: esta seção criava `usuarios` E `auth.users`/`auth.identities`
-- no mesmo laço. Como `auth.*` não existe no Postgres vanilla, o
-- reset-db.sh precisava PULAR este seed inteiro — e com ele sumia do CI
-- toda a base da vitrine: 60 alunos, registros, metas e simulados, sem
-- um único teste. Foi por isso que as datas cravadas em junho passaram
-- três meses congeladas sem ninguém notar.
--
-- A parte de Auth saiu para `21_vitrine_contas_auth.sql`, que é o único
-- pulado agora. Este arquivo passou a ser 100% schema público e roda no
-- CI junto com o resto.
-- Login por CÓDIGO: VITRINE0NN  →  vitrine0NN@codigo.acesso.local
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_escola uuid := '11111111-1111-4111-8111-111111111111';
  v_uid uuid; v_nome text;   -- Onda 8: e-mail/código foram com o Auth p/ o seed 21
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

    insert into usuarios (id, escola_id, papel, nome)
      values (v_uid, v_escola, 'aluno', v_nome)
      on conflict (id) do nothing;

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
  v_qtd int; v_acc int; v_min int; v_dat date; i int;
begin
  for r in select * from _vit_novos loop
    v_aluno := ('a0000000-0000-4000-8000-' || lpad(r.num::text, 12, '0'))::uuid;
    if r.perfil = 'SEM' then
      continue;   -- sem atividade: nenhum registro
    end if;

    for i in 1 .. (case r.perfil when 'FORTE' then 12 when 'MEDIANO' then 7 else 3 end) loop
      -- CALENDÁRIO ROLANTE (Onda 8): estas datas eram fixas em junho/2026,
      -- e por isso a vitrine envelheceu — em 17/09 havia 455 de 457
      -- registros com mais de 90 dias. Os deslocamentos abaixo preservam
      -- a intenção original medida a partir do dia em que o seed foi
      -- escrito (2026-06-19): RISCO defasado >10 dias, MEDIANO ontem-2,
      -- FORTE ontem. Agora andam com o calendário, como o seed 02 já faz.
      if r.perfil = 'RISCO' then
        v_dat := app.hoje_local() - 12 - (i * 2);       -- defasados (>10 dias)
        v_qtd := 10; v_acc := 4;                        -- baixo desempenho
      elsif r.perfil = 'MEDIANO' then
        v_dat := app.hoje_local() - 2 - (i * 2);
        v_qtd := 15; v_acc := 10;
      else  -- FORTE
        v_dat := app.hoje_local() - 1 - i;
        v_qtd := 20; v_acc := 17;
      end if;

      -- A6: os minutos eram `45 + (i%3)*15` INDEPENDENTE do número de
      -- questões — o aluno RISCO gastava os mesmos 45-75 min em 10
      -- questões que o FORTE em 20, dando até 7,5 min/questão. Agora o
      -- tempo é derivado do volume: 1,6 a 2,4 min por questão.
      v_min := round(v_qtd * (1.6 + (i % 3) * 0.4));

      -- Onda 8: sem guarda, cada reexecução DUPLICAVA o volume de estudo
      -- da vitrine (registros_estudo só tem PK, e o id vinha de
      -- gen_random_uuid()). O cabeçalho promete "reexecução não
      -- duplica"; era o quinto lugar onde isso não era verdade. O par
      -- (aluno, data, disciplina) identifica a linha gerada aqui.
      insert into registros_estudo (id, escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
      select gen_random_uuid(), v_esc, v_aluno, v_dat,
             v_disc[1 + (i % 4)], 'Revisão dirigida — bateria de questões',
             v_qtd, v_acc, v_min
       where not exists (
         select 1 from registros_estudo re
          where re.aluno_id = v_aluno and re.data = v_dat
            and re.disciplina_codigo = v_disc[1 + (i % 4)]);
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
  -- Onda 8: as semanas vinham cravadas ('2026-05-30' etc). Agora saem da
  -- trilha_semanas, que o seed 02 reancora na semana corrente a cada
  -- execução — uma fonte de verdade só, em vez de duas que divergem.
  w1_ini date; w1_fim date; w2_ini date; w2_fim date; w3_ini date; w3_fim date;
begin
  select inicio, fim into w1_ini, w1_fim from trilha_semanas where trilha_id = v_trilha and numero = 1;
  select inicio, fim into w2_ini, w2_fim from trilha_semanas where trilha_id = v_trilha and numero = 2;
  select inicio, fim into w3_ini, w3_fim from trilha_semanas where trilha_id = v_trilha and numero = 3;
  for r in select * from _vit_novos loop
    v_aluno := ('a0000000-0000-4000-8000-' || lpad(r.num::text, 12, '0'))::uuid;

    if r.perfil = 'FORTE' then
      -- S1 fechada — todas concluídas
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 1, w1_ini, w1_fim, 'fechada')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 1;
      v_ats := s1; v_nconcl := array_length(s1,1);
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end)
        on conflict (meta_id, atividade_modelo_id) do nothing;
      end loop;
      -- S2 fechada — todas concluídas
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 2, w2_ini, w2_fim, 'fechada')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 2;
      v_ats := s2; v_nconcl := array_length(s2,1);
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], 'concluida')
        on conflict (meta_id, atividade_modelo_id) do nothing;
      end loop;
      -- S3 ativa — 3 de 6 concluídas
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 3, w3_ini, w3_fim, 'ativa')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 3;
      v_ats := s3; v_nconcl := 3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end)
        on conflict (meta_id, atividade_modelo_id) do nothing;
      end loop;

    elsif r.perfil = 'MEDIANO' then
      -- S1 fechada — 3 concluídas de 5
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 1, w1_ini, w1_fim, 'fechada')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 1;
      v_ats := s1; v_nconcl := 3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end)
        on conflict (meta_id, atividade_modelo_id) do nothing;
      end loop;
      -- S2 fechada — 3 concluídas de 4
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 2, w2_ini, w2_fim, 'fechada')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 2;
      v_ats := s2; v_nconcl := 3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end)
        on conflict (meta_id, atividade_modelo_id) do nothing;
      end loop;

    elsif r.perfil = 'RISCO' then
      -- S2 fechada/atrasada — só 1 concluída, resto pendente (missão atrasada)
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 2, w2_ini, w2_fim, 'fechada')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 2;
      v_ats := s2; v_nconcl := 1;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], case when i <= v_nconcl then 'concluida' else 'pendente' end)
        on conflict (meta_id, atividade_modelo_id) do nothing;
      end loop;

    else  -- SEM: plano lançado na S3 ativa, tudo pendente
      insert into metas (id, escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
        values (gen_random_uuid(), v_esc, v_aluno, v_trilha, 3, w3_ini, w3_fim, 'ativa')
        on conflict (aluno_id, trilha_id, semana_numero) do nothing;
      select id into v_meta from metas
       where aluno_id = v_aluno and trilha_id = v_trilha and semana_numero = 3;
      v_ats := s3;
      for i in 1 .. array_length(v_ats,1) loop
        insert into meta_atividades (id, escola_id, meta_id, atividade_modelo_id, estado)
        values (gen_random_uuid(), v_esc, v_meta, v_ats[i], 'pendente')
        on conflict (meta_id, atividade_modelo_id) do nothing;
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
      v_dat := app.hoje_local() - 5 - (k-1) * 7;   -- Onda 8: era date '2026-06-14' fixo
      -- Onda 8: `simulados` só tem PK, e o id vinha de gen_random_uuid()
      -- — reexecutar duplicava. O cabeçalho deste seed sempre afirmou
      -- "reexecução não duplica"; nunca foi verdade, e ninguém viu
      -- porque quem roda o seed duas vezes é o CI, que o pulava.
      -- O guarda é pelo par (aluno, nome do simulado), que é o que
      -- identifica a linha na prática.
      insert into simulados (id, escola_id, aluno_id, nome, data, acertos, exam_tag, redacao_nota)
      select gen_random_uuid(), v_esc, v_aluno,
             'Simulado ' || r.examtag || ' #' || k, v_dat,
             jsonb_build_object('mat', 14 + k, 'por', 12 + k, 'ing', 10 + k),
             r.examtag, null
       where not exists (
         select 1 from simulados s
          where s.aluno_id = v_aluno and s.nome = 'Simulado ' || r.examtag || ' #' || k);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- SEÇÃO 8 — BACKFILL do motor C0 (idempotente). Garante que todo
-- evento derivável (registro/missão/simulado) esteja no ledger, mesmo
-- que algum gatilho não tenha coberto. Não duplica (idempotency_key).
-- ------------------------------------------------------------
select app.backfill_progresso('11111111-1111-4111-8111-111111111111') as eventos_novos_no_backfill;
