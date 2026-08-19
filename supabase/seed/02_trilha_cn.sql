-- ============================================================
-- SEED — TRILHA DO COLÉGIO NAVAL (conteúdo global, versionado)
-- GERADO por scripts/gerar-seed-trilha.mjs a partir de
-- supabase/seed/trilha-cn-v1.json — NÃO editar à mão.
-- Idempotente: on conflict do nothing em tudo; as semanas, que são
-- as únicas linhas com data, fazem do update só das datas.
--
-- CALENDÁRIO ROLANTE: as datas NÃO são fixas. A semana 3
-- da trilha é sempre a semana corrente em America/Sao_Paulo (a mesma
-- regra de app.hoje_local()), e as outras oito guardam o encaixe
-- original — semana 1 começa no sábado, 2 a 8 são de segunda a
-- domingo, 9 termina no sábado da prova. Sem isso o seed de
-- demonstração vence sozinho: passada a última semana não há meta
-- ativa, e o painel da vitrine amanhece vazio.
-- ============================================================

insert into trilhas (id, nicho, nome, versao, publicada) values
  ('b1388388-c660-4b4b-811c-b58358689e92', 'colegio-naval', 'Colégio Naval — CPACN/2026 (9 semanas)', 1, true)
  on conflict (nicho, versao) do nothing;

insert into disciplinas (id, trilha_id, codigo, nome, abrev, cor, ordem) values
  ('0610d0df-7435-4505-8066-37831fee3266', 'b1388388-c660-4b4b-811c-b58358689e92', 'mat', 'Matemática', 'Mat', '#CDA349', 0),
  ('d1d2578c-6891-4b12-841f-e5291b695372', 'b1388388-c660-4b4b-811c-b58358689e92', 'ing', 'Inglês', 'Ing', '#49B6CF', 1),
  ('53e5e6cf-9e48-4cc1-8982-0b1ae3626ee9', 'b1388388-c660-4b4b-811c-b58358689e92', 'por', 'Português', 'Por', '#E0788E', 2),
  ('8841bd84-477f-447c-82e6-8fbfc0c4051a', 'b1388388-c660-4b4b-811c-b58358689e92', 'fis', 'Física', 'Fís', '#9A8CF0', 3),
  ('19a31434-ad7e-4687-88a5-7fd2e1e9b93d', 'b1388388-c660-4b4b-811c-b58358689e92', 'qui', 'Química', 'Quí', '#5FC089', 4),
  ('6433e0ae-3ea2-4cb8-8031-6272ba554e46', 'b1388388-c660-4b4b-811c-b58358689e92', 'soc', 'Est. Sociais', 'Soc', '#E0954A', 5),
  ('c0d1a236-7107-48fb-833a-38457fa67f69', 'b1388388-c660-4b4b-811c-b58358689e92', 'red', 'Redação', 'Red', '#46C6B0', 6),
  ('30fe7f2e-fb91-41cb-8428-e7b8cf75010b', 'b1388388-c660-4b4b-811c-b58358689e92', 'prov', 'Provas antigas', 'Prov', '#C77DFF', 7)
  on conflict (trilha_id, codigo) do nothing;

with ancora as (
  -- date_trunc('week') devolve a SEGUNDA-feira; app.hoje_local() é a
  -- data local do Brasil (0003), a mesma que a virada usa.
  select date_trunc('week', app.hoje_local())::date as segunda
)
insert into trilha_semanas (id, trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
select v.id::uuid, 'b1388388-c660-4b4b-811c-b58358689e92', v.numero, a.segunda + v.ini, a.segunda + v.fim, v.foco, v.simulado, 250
  from ancora a, (values
    ('a5e789d2-a0cd-4cef-8b4d-747fa7225b80', 1, -16, -8, 'Diagnóstico + base crítica (fração e potenciação)', null::text),
    ('86d15c73-5757-4b14-8487-4e71cb8cda4e', 2, -7, -1, 'Divisibilidade + fim da base', null::text),
    ('2f576da4-a778-45f4-8456-874c6cf9d01d', 3, 0, 6, 'Início da geometria + funções', 'Simulado 1'::text),
    ('f55d9b90-5c7a-493f-8f7d-4f03adaa63c5', 4, 7, 13, 'Geometria pesada + sistemas', 'Simulado 2'::text),
    ('0b698c14-333c-46f6-8b94-5274fa17e1d8', 5, 14, 20, 'Geometria avançada + simulado semanal', 'Simulado 3'::text),
    ('e89b4fc1-8c45-4767-89bc-969ff54e2da4', 6, 21, 27, 'Consolidação + redação entra', 'Simulado 4'::text),
    ('84340063-72e6-428f-8142-4c4eb28a30b7', 7, 28, 34, 'Simulados + redação semanal', 'Simulado 5'::text),
    ('24a9ded3-b8c5-44c1-82c8-93973aa5c647', 8, 35, 41, 'Reta final — refazer as 10 provas até dominar', 'Simulados 6 e 7'::text),
    ('c6c2e114-98ab-4e7e-8767-707e2cf48929', 9, 42, 47, 'Ajuste fino e descanso estratégico', 'Simulado 8 (leve)'::text)
  ) as v(id, numero, ini, fim, foco, simulado)
  on conflict (trilha_id, numero) do update
     set inicio = excluded.inicio, fim = excluded.fim;

insert into atividades_modelo (id, trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem) values
  ('7cb12bd2-ead5-4ba9-8020-24e336e0351d', 'b1388388-c660-4b4b-811c-b58358689e92', 1, 'mat', 'F', 'Aplicar 1 prova antiga COMPLETA cronometrada (diagnóstico)', 0),
  ('81787a17-6769-4a35-8b53-e04559b7ac22', 'b1388388-c660-4b4b-811c-b58358689e92', 1, 'mat', 'F', 'Frações: operações, simplificação, equações', 1),
  ('a55a535f-c0c1-42f5-82c4-fcb10f18f98f', 'b1388388-c660-4b4b-811c-b58358689e92', 1, 'mat', 'P', 'Potenciação e radiciação (só base)', 2),
  ('b2721295-d964-4154-8f68-fc8537cc53ab', 'b1388388-c660-4b4b-811c-b58358689e92', 1, 'ing', 'F', 'Murphy Units 1–14 (Simple / Continuous)', 3),
  ('fac2eb04-2c0e-4276-86b0-de5576dd771a', 'b1388388-c660-4b4b-811c-b58358689e92', 1, 'por', 'F', 'Faça e Passe: acentuação (Cap 1.3) + iniciar morfologia (Cap 2)', 4),
  ('30110914-4749-430b-8adb-ae156dc2781a', 'b1388388-c660-4b4b-811c-b58358689e92', 2, 'mat', 'F', 'Divisibilidade, MDC, MMC, congruência, módulo', 0),
  ('ac0cd585-7144-4a16-8762-088e6a5bc679', 'b1388388-c660-4b4b-811c-b58358689e92', 2, 'mat', 'F', 'Números racionais e frações: fechar de vez', 1),
  ('831105ee-80c7-4459-8165-a8a0de7e55ab', 'b1388388-c660-4b4b-811c-b58358689e92', 2, 'ing', 'F', 'Murphy Units 15–25 (Present Perfect, Future)', 2),
  ('39837ab3-cd60-4ffe-8a30-6b8abe67276e', 'b1388388-c660-4b4b-811c-b58358689e92', 2, 'por', 'F', 'Morfologia: substantivo, adjetivo, pronome, verbo (Cap 2.2)', 3),
  ('a715740b-b86a-49d9-8543-05a4d42bac66', 'b1388388-c660-4b4b-811c-b58358689e92', 3, 'mat', 'F', 'Geometria: triângulos, semelhança, ângulos', 0),
  ('a595c0d3-42de-4159-8785-77feeca3d1f6', 'b1388388-c660-4b4b-811c-b58358689e92', 3, 'mat', 'F', 'Funções 1º/2º grau, domínio, inequações', 1),
  ('9466de09-7b52-4dc3-8ab1-f93f81c3e43b', 'b1388388-c660-4b4b-811c-b58358689e92', 3, 'ing', 'F', 'Morfologia: countable/uncountable, pronomes (61–76)', 2),
  ('068a773b-8dba-4374-86fc-44341609ef19', 'b1388388-c660-4b4b-811c-b58358689e92', 3, 'por', 'F', 'Morfologia: verbo + advérbio/preposição/conjunção (2.2.6–2.2.7)', 3),
  ('05478d01-a9ca-4ad7-8582-63fe50a3e612', 'b1388388-c660-4b4b-811c-b58358689e92', 3, 'fis', 'F', 'Cinemática (Vol.1)', 4),
  ('07356a80-0705-44c7-8bb3-a92777c7ebaf', 'b1388388-c660-4b4b-811c-b58358689e92', 3, 'prov', 'F', 'Dissecar 1 prova antiga do CN: anotar cada pegadinha no caderno da banca', 5),
  ('9d8ddcd9-5c22-4dca-85a6-775d0383c17d', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'mat', 'F', 'Geometria: círculo, ângulo inscrito, áreas', 0),
  ('86b0caaf-7fb2-45b1-8915-830c3c636139', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'mat', 'F', 'Equações e sistemas lineares', 1),
  ('44739cfa-0235-4312-8673-ccc960143a0a', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'ing', 'F', 'Comparativos/superlativos; question formation', 2),
  ('883512f7-427c-4a43-8ca9-a349e92a849e', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'por', 'F', 'Sintaxe: termos da oração — sujeito, predicado, complementos (Cap 3.1)', 3),
  ('a903a123-491d-4723-89de-3420a06e5362', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'por', 'P', 'Interpretação: manter volume pelas provas antigas', 4),
  ('7c14f250-ce2b-4fec-8573-0b387d9f98f3', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'fis', 'F', 'Dinâmica: Newton, atrito, plano inclinado (Vol.1)', 5),
  ('cf22b933-5a52-4d9e-81f6-7e30b8971267', 'b1388388-c660-4b4b-811c-b58358689e92', 4, 'prov', 'F', 'Dissecar mais 1 prova; cruzar pegadinhas que se repetem', 6),
  ('1a785759-c2be-476c-8d00-8199b5dc92f6', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'mat', 'F', 'Geometria: polígonos regulares, áreas compostas', 0),
  ('ad62f8a4-59db-46da-859c-8ee5c7f0c30f', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'mat', 'P', 'Proporção, porcentagem, juros simples', 1),
  ('cb56b4d1-736b-49a6-8fd9-9cf276ec8dd1', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'ing', 'P', 'Modais; voz passiva', 2),
  ('7ea33674-af33-4b03-805c-446a9cc54c9b', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'por', 'F', 'Sintaxe: orações coordenadas e subordinadas (3.2); crase (4.1)', 3),
  ('325e20ce-fdbb-497c-8fec-db1ede3dc621', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'por', 'P', 'Interpretação: manter volume pelas provas', 4),
  ('484713b3-4b53-4e69-8378-e5cc8017350b', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'fis', 'F', 'Termologia (Vol.2)', 5),
  ('e0655c05-bbc6-403d-8019-08ff06c086e9', 'b1388388-c660-4b4b-811c-b58358689e92', 5, 'qui', 'P', 'Atomística e funções inorgânicas', 6),
  ('3740d50b-b64b-4ffc-8d0a-259b2c53f858', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'mat', 'P', 'Progressões (fórmulas), estatística básica', 0),
  ('90488414-4c9b-4104-86f3-b16d02a90d46', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'mat', 'F', 'Revisão geral de geometria', 1),
  ('dc3cc91e-5ade-4264-8d9c-0bdc008c5e35', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'ing', 'P', 'Relativos, preposições + revisão', 2),
  ('4bce4bda-ddc8-4417-8ce6-6f0bb4a3f05d', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'por', 'F', 'Concordância e regência verbal/nominal (Cap 3.3–3.4)', 3),
  ('58e0836b-4185-49a1-801a-ba50c7baf87d', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'red', 'F', '1 redação dissertativa', 4),
  ('b71a5896-3aaa-44bc-8a48-4529e0a3f6b5', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'fis', 'P', 'Circuitos e eletrostática (Vol.3)', 5),
  ('e034bc05-37a1-4417-8215-9d4cb640525c', 'b1388388-c660-4b4b-811c-b58358689e92', 6, 'soc', 'P', 'História colonial/império; geografia econômica', 6),
  ('f0ba073f-1553-4a98-8b76-ed22b0b67a5d', 'b1388388-c660-4b4b-811c-b58358689e92', 7, 'mat', 'F', 'Bateria por tópico FECHAR (focar erros do Simulado 2)', 0),
  ('f3da4f6c-2bb9-40e6-80c3-655ad38dd8ea', 'b1388388-c660-4b4b-811c-b58358689e92', 7, 'ing', 'F', 'Revisão ativa: tempos verbais e morfologia', 1),
  ('49d2e9cb-05e4-4d0b-8b79-3b3923e513b0', 'b1388388-c660-4b4b-811c-b58358689e92', 7, 'por', 'F', 'Revisar crase/pontuação + 1 redação; interpretação pelas provas', 2),
  ('3b7796a5-abba-4620-88df-6ec8856cedfc', 'b1388388-c660-4b4b-811c-b58358689e92', 7, 'red', 'F', '1 redação', 3),
  ('48e3919e-41dd-4860-8112-bb750f3fed18', 'b1388388-c660-4b4b-811c-b58358689e92', 7, 'fis', 'P', 'Ondas; Química: estequiometria/equilíbrio', 4),
  ('1d4f5746-549f-4fa8-8bc7-e277e0fcd6da', 'b1388388-c660-4b4b-811c-b58358689e92', 7, 'soc', 'P', '1ª República, Vargas; agropecuária, urbanização', 5),
  ('a168d5fc-a8a5-4b69-8bc3-845cd780e8e5', 'b1388388-c660-4b4b-811c-b58358689e92', 8, 'prov', 'F', 'Refazer as 10 provas do CN até dominar; fechar o caderno de pegadinhas da banca', 0),
  ('bbef23ad-ada1-4156-80a8-60bb8ee52b43', 'b1388388-c660-4b4b-811c-b58358689e92', 8, 'mat', 'F', 'Refazer toda geometria errada das provas até sair no automático', 1),
  ('d63ef604-821e-4587-8a75-364aa3626d31', 'b1388388-c660-4b4b-811c-b58358689e92', 8, 'por', 'F', '2 redações na semana + revisão de morfologia/sintaxe nos erros', 2),
  ('b79be559-d59d-4a8d-815a-1ef16fd5d555', 'b1388388-c660-4b4b-811c-b58358689e92', 8, 'ing', 'F', 'Fechar pontos fáceis: gramática recorrente e química perto de 100%', 3),
  ('31b12de3-f8ce-4b6a-8a36-ae6fe67f7f92', 'b1388388-c660-4b4b-811c-b58358689e92', 9, 'mat', 'P', '1 simulado leve no início; depois só revisão', 0),
  ('7ea8f071-849e-4f77-891d-041ba7a05325', 'b1388388-c660-4b4b-811c-b58358689e92', 9, 'por', 'P', 'Revisar morfologia, sintaxe, crase e acentuação (resumos)', 1),
  ('c3dd17aa-dad7-400a-895e-f4c648d9e897', 'b1388388-c660-4b4b-811c-b58358689e92', 9, 'ing', 'P', 'Revisão leve', 2),
  ('6ca90560-d63b-4897-89a1-8dc53653f694', 'b1388388-c660-4b4b-811c-b58358689e92', 9, 'prov', 'P', 'Reler o caderno de pegadinhas — não cair de novo no que já mapeou', 3)
  on conflict (id) do nothing;
