-- ============================================================
-- CALENDÁRIO E MISSÕES — ESPCEX 2026 (conteúdo global)
-- GERADO por scripts/gerar-seed-trilha-espcex.mjs a partir de
-- supabase/seed/trilha-espcex-v1.json; programa em supabase/seed/espcex-ped2-r3-v1.json. NÃO editar à mão.
-- Desenho pedagógico = inferência; datas/programa = edital vigente.
-- ============================================================

insert into trilhas (id, nicho, nome, versao, publicada)
values ('f6098026-b2ac-4563-80f1-36900900d3b3', 'espcex', 'EsPCEx — CA 2026/27 (9 semanas)', 1, true)
on conflict (nicho, versao) do update set
  nome = excluded.nome,
  publicada = excluded.publicada;

insert into disciplinas (id, trilha_id, codigo, nome, abrev, cor, ordem)
select d.id::uuid, (select id from trilhas where nicho = 'espcex' and versao = 1), d.codigo, d.nome, d.abrev, d.cor, d.ordem
  from (values
  ('388c75ee-6843-4f3f-87bf-dea6c346e709', 'por', 'Português', 'Por', '#E0788E', 0),
  ('13a331d3-736d-4c97-8a75-ff4e69f1caef', 'red', 'Redação', 'Red', '#46C6B0', 1),
  ('580b97c2-0b3d-4775-8eab-32244d6450a4', 'fis', 'Física', 'Fís', '#9A8CF0', 2),
  ('a9deda88-2503-456b-871b-ecda8ee01709', 'qui', 'Química', 'Quí', '#5FC089', 3),
  ('0f5c80c2-d990-4611-83d3-2b8d54521655', 'mat', 'Matemática', 'Mat', '#CDA349', 4),
  ('30124dfd-d2cd-4de8-8674-b620684d5c7a', 'geo', 'Geografia', 'Geo', '#E0954A', 5),
  ('f689f780-6950-4573-826c-727d420d825c', 'his', 'História', 'His', '#D17C57', 6),
  ('fbe95777-804f-403a-8d4b-bf4ec6e3fdd7', 'ing', 'Inglês', 'Ing', '#49B6CF', 7),
  ('fb95fb98-05a8-4601-8c2c-8c850b016f34', 'prov', 'Provas antigas', 'Prov', '#C77DFF', 8)
  ) as d(id, codigo, nome, abrev, cor, ordem)
on conflict (trilha_id, codigo) do update set
  nome = excluded.nome,
  abrev = excluded.abrev,
  cor = excluded.cor,
  ordem = excluded.ordem;

insert into trilha_semanas (id, trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
select s.id::uuid, (select id from trilhas where nicho = 'espcex' and versao = 1), s.numero, s.inicio::date, s.fim::date, s.foco, s.simulado, s.meta_questoes
  from (values
  ('d31c71e1-6adc-4c72-8c37-e6c0c81544b9', 1, '2026-07-13', '2026-07-19', 'Diagnóstico e fundação nas frentes de maior peso', 'Diagnóstico 2024 — Dia 1', 300),
  ('ee90bf36-a7f2-44f7-82b5-dbb788464fb3', 2, '2026-07-20', '2026-07-26', 'Fundação completa e primeira redação corrigida', 'Diagnóstico 2024 — Dia 2', 320),
  ('ac40cb45-be7f-4209-8c70-ad9984eb5ab0', 3, '2026-07-27', '2026-08-02', 'Consolidação multidisciplinar e correção de lacunas', null, 320),
  ('577961ea-5df1-4d37-8061-03a6576aef54', 4, '2026-08-03', '2026-08-09', 'Aprofundamento nas incidências medidas', 'Simulado parcial — Dia 1', 340),
  ('326cfd34-8af0-4db4-83b3-5671a25c121c', 5, '2026-08-10', '2026-08-16', 'Aprofundamento nas matérias do segundo dia', 'Simulado parcial — Dia 2', 340),
  ('b96b92de-0ed4-4a95-8bff-16abb0080503', 6, '2026-08-17', '2026-08-23', 'Fechamento do programa e revisão espaçada', 'Simulado completo 2025 — Dia 1', 360),
  ('1a18cb17-0ec7-4afa-8596-55691a296596', 7, '2026-08-24', '2026-08-30', 'Fechamento do programa e prova sob tempo', 'Simulado completo 2025 — Dia 2', 360),
  ('99439fbd-75be-41a3-8a1c-16be2170e01c', 8, '2026-08-31', '2026-09-06', 'Reta final nos dois formatos oficiais', 'Simulado integral em dois dias', 280),
  ('0a178771-7284-4bee-8d6e-62bec7142d29', 9, '2026-09-07', '2026-09-13', 'Revisão leve, descanso e execução da prova', 'CA EsPCEx — 12 e 13 de setembro', 160)
  ) as s(id, numero, inicio, fim, foco, simulado, meta_questoes)
on conflict (trilha_id, numero) do update set
  inicio = excluded.inicio,
  fim = excluded.fim,
  foco = excluded.foco,
  simulado = excluded.simulado,
  meta_questoes = excluded.meta_questoes;

delete from atividades_modelo where trilha_id = (select id from trilhas where nicho = 'espcex' and versao = 1);

insert into atividades_modelo (id, trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
select a.id::uuid, (select id from trilhas where nicho = 'espcex' and versao = 1), a.semana_numero, a.disciplina_codigo, a.prioridade, a.texto, a.ordem
  from (values
  ('0317edd9-ae59-40c0-8987-f9f5f4d0da54', 1, 'por', 'F', 'Estudar Leitura, interpretação e análise de textos: teoria, revisão ativa e questões 2024–2025', 0),
  ('7b87fa39-4289-4d70-8d2c-1b08c4e20cd8', 1, 'geo', 'F', 'Estudar Geografia do Brasil — O Espaço Econômico: teoria, revisão ativa e questões 2024–2025', 1),
  ('6ec55584-ce1f-4418-826b-83c62fc4d399', 1, 'his', 'F', 'Estudar O Mundo na Guerra Fria: teoria, revisão ativa e questões 2024–2025', 2),
  ('bf33ab2a-a990-4a83-8aa6-c7fd1e2f8475', 1, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 3),
  ('9ba48ccf-7ce5-484a-8d05-fa942f6702d8', 1, 'ing', 'F', 'Estudar Compreensão de textos: teoria, revisão ativa e questões 2024–2025', 4),
  ('6dc0c7bc-3868-44eb-855e-b762b040aa36', 1, 'prov', 'F', 'Executar o caderno indicado sob tempo e transformar erros em revisão ativa', 5),
  ('4caaf41d-93b5-4f5b-8aec-2457fcaa36d0', 1, 'qui', 'P', 'Estudar Cinética: teoria, revisão ativa e questões 2024–2025', 6),
  ('57cec2db-d91d-499a-8c41-445f888b3d67', 1, 'mat', 'P', 'Estudar Função Modular: teoria, revisão ativa e questões 2024–2025', 7),
  ('257316a1-f128-42a3-8daa-0febdeefcab5', 1, 'mat', 'P', 'Estudar Sequências Numéricas e Progressões: teoria, revisão ativa e questões 2024–2025', 8),
  ('fd78eec1-112b-419a-8a52-07d6775337ad', 1, 'his', 'P', 'Estudar As Revoluções Inglesas e a Revolução Industrial: teoria, revisão ativa e questões 2024–2025', 9),
  ('1ad0169b-0d26-4c17-83f5-5fc0eab0390c', 1, 'por', 'X', 'Estudar Acordo Ortográfico da Língua Portuguesa: teoria, revisão ativa e questões 2024–2025', 10),
  ('d82bcf95-37a4-4fdc-89cf-67ecaf41df38', 1, 'qui', 'X', 'Estudar Características dos Compostos Iônicos e Moleculares: teoria, revisão ativa e questões 2024–2025', 11),
  ('82d51cf7-962c-4570-87ab-d86fa98fd59e', 1, 'his', 'X', 'Estudar O Renascimento Comercial e Urbano: teoria, revisão ativa e questões 2024–2025', 12),
  ('5193426e-3179-43c8-85ac-b98f9fa901dc', 2, 'por', 'F', 'Estudar Literatura Brasileira: teoria, revisão ativa e questões 2024–2025', 13),
  ('4275c03d-6733-437b-8627-df236e39a5fc', 2, 'red', 'F', 'Estudar Dissertação: técnica, produção e correção conforme o edital vigente', 14),
  ('79a6cc39-32d4-41c6-8a5c-103ed777bb53', 2, 'red', 'F', 'Produzir e corrigir 1 dissertação completa conforme o edital vigente', 15),
  ('9957a1fe-ccbf-49b8-8549-5de73b29c822', 2, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 16),
  ('0cb21516-0951-4962-8652-e075a2d51646', 2, 'ing', 'F', 'Estudar Estruturas gramaticais: teoria, revisão ativa e questões 2024–2025', 17),
  ('4ca60aa9-2d57-4c8b-854d-6fcb36912d39', 2, 'prov', 'F', 'Executar o caderno indicado sob tempo e transformar erros em revisão ativa', 18),
  ('9c6009fe-612c-495c-81e5-a039ce8cf613', 2, 'por', 'P', 'Estudar Fonética: teoria, revisão ativa e questões 2024–2025', 19),
  ('ee490472-33d3-4bb9-81cb-65b97b0bd08b', 2, 'qui', 'P', 'Estudar Funções Inorgânicas: teoria, revisão ativa e questões 2024–2025', 20),
  ('e8a4c87a-fbdf-4887-8a4e-44a73acb7bc2', 2, 'mat', 'P', 'Estudar Função Exponencial: teoria, revisão ativa e questões 2024–2025', 21),
  ('4eb08e25-4031-4f6a-8c26-098b49b7ad38', 2, 'mat', 'P', 'Estudar Geometria Espacial de Posição: teoria, revisão ativa e questões 2024–2025', 22),
  ('e160a1ee-72f1-4daa-8648-f756d87dc2b3', 2, 'his', 'P', 'Estudar A Independência dos Estados Unidos da América: teoria, revisão ativa e questões 2024–2025', 23),
  ('24367a4c-9b49-4749-8152-4355edb9c4df', 2, 'his', 'P', 'Estudar O Mundo no Final do Século XX e Início do Século XXI: teoria, revisão ativa e questões 2024–2025', 24),
  ('5226aaf7-052c-4927-88a6-3890c5334d44', 2, 'his', 'P', 'Estudar Os Estados Nacionais Europeus da Idade Moderna, o Absolutismo e o Mercantilismo: teoria, revisão ativa e questões 2024–2025', 25),
  ('defc21fb-5b76-4c94-845d-571a3e3b6c2c', 2, 'qui', 'X', 'Estudar Soluções: teoria, revisão ativa e questões 2024–2025', 26),
  ('bb4d7358-5809-4a61-871e-7ab204df9fe6', 2, 'geo', 'X', 'Estudar Geografia do Brasil — O Espaço Político: teoria, revisão ativa e questões 2024–2025', 27),
  ('a3b984ef-40e4-4b1a-8c96-2c624794ac7d', 3, 'por', 'F', 'Estudar Morfologia: teoria, revisão ativa e questões 2024–2025', 28),
  ('43b4ee66-44f5-419d-8209-cc9d80944225', 3, 'red', 'F', 'Estudar Gramática: técnica, produção e correção conforme o edital vigente', 29),
  ('ce45d838-55d3-4929-8e5d-685384857799', 3, 'red', 'F', 'Produzir e corrigir 1 dissertação completa conforme o edital vigente', 30),
  ('fd028945-0cb9-447a-8ffe-bd0e048724c8', 3, 'fis', 'F', 'Estudar Mecânica: teoria, revisão ativa e questões 2024–2025', 31),
  ('969f4074-c466-45d5-87c0-163206ff3555', 3, 'mat', 'F', 'Estudar Função Logarítmica: teoria, revisão ativa e questões 2024–2025', 32),
  ('7da57a18-02c4-4132-846f-7fede9ee6acb', 3, 'geo', 'F', 'Estudar Geografia Geral — Localizando-se no Espaço: teoria, revisão ativa e questões 2024–2025', 33),
  ('9089cca2-4a0d-46a5-801d-13c89a975362', 3, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 34),
  ('e54fbd5d-e4e8-45a6-8534-63bf7be9407f', 3, 'qui', 'P', 'Estudar Equilíbrio Químico: teoria, revisão ativa e questões 2024–2025', 35),
  ('727a5bfe-f16b-4c88-8969-24486c6e201d', 3, 'qui', 'P', 'Estudar Reações Químicas: teoria, revisão ativa e questões 2024–2025', 36),
  ('fa758aba-4185-41d9-8621-0add70ae0663', 3, 'mat', 'P', 'Estudar Geometria Espacial Métrica: teoria, revisão ativa e questões 2024–2025', 37),
  ('f0fd4c81-ecb0-4474-8c24-b43f20ea87b2', 3, 'geo', 'P', 'Estudar Geografia do Brasil — O Espaço Humano: teoria, revisão ativa e questões 2024–2025', 38),
  ('3874dcce-aded-4810-82d4-d5aefe98c6d1', 3, 'his', 'P', 'Estudar A Expansão Marítima Europeia: teoria, revisão ativa e questões 2024–2025', 39),
  ('177ebf9b-e178-4bad-8f81-4a048bc747ea', 3, 'his', 'P', 'Estudar A Revolução Francesa e a Restauração: teoria, revisão ativa e questões 2024–2025', 40),
  ('0ffea629-c26b-45ce-81db-a11fcf5f4772', 4, 'red', 'F', 'Estudar Linguagem: técnica, produção e correção conforme o edital vigente', 41),
  ('7edfa5b1-692f-46a2-8794-6a556fc045a7', 4, 'red', 'F', 'Produzir e corrigir 1 dissertação completa conforme o edital vigente', 42),
  ('b66e5422-fe91-4e47-8405-702d1c8b8c28', 4, 'fis', 'F', 'Estudar Termologia: teoria, revisão ativa e questões 2024–2025', 43),
  ('f344c36c-f8c8-46a0-8fb8-c4de3bda4892', 4, 'mat', 'F', 'Estudar Geometria Analítica: teoria, revisão ativa e questões 2024–2025', 44),
  ('fb44971b-6590-4647-8568-d8356e6254e2', 4, 'geo', 'F', 'Estudar Geografia Geral — O Espaço Natural: teoria, revisão ativa e questões 2024–2025', 45),
  ('ddbb18f2-657d-4adb-8c65-8fb8ae62f6ee', 4, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 46),
  ('8fb41198-59d3-4def-86b0-ad727cc5794c', 4, 'prov', 'F', 'Executar o caderno indicado sob tempo e transformar erros em revisão ativa', 47),
  ('7a62fb1f-8e94-441d-8484-8d5ef2d8913a', 4, 'por', 'P', 'Estudar Semântica: teoria, revisão ativa e questões 2024–2025', 48),
  ('252b764c-fad6-41ab-822c-c93c089fb404', 4, 'qui', 'P', 'Estudar Eletroquímica/Eletrólise: teoria, revisão ativa e questões 2024–2025', 49),
  ('8f12b21c-3ceb-45ef-88cc-679f13064381', 4, 'qui', 'P', 'Estudar Grandezas Químicas: teoria, revisão ativa e questões 2024–2025', 50),
  ('6ab3ddab-5b4d-4d4c-8f01-ffb4a26adad0', 4, 'mat', 'P', 'Estudar Trigonometria: teoria, revisão ativa e questões 2024–2025', 51),
  ('b4934a46-3e45-48f2-848a-2e7dc4315002', 4, 'his', 'P', 'Estudar O Brasil Imperial: teoria, revisão ativa e questões 2024–2025', 52),
  ('ae38d74d-aadf-42ca-85e4-53e1c514b8f1', 4, 'his', 'P', 'Estudar O Renascimento Cultural, o Humanismo e as Reformas Religiosas: teoria, revisão ativa e questões 2024–2025', 53),
  ('048fe800-7bdf-45c9-827b-38ec22dee2bb', 4, 'qui', 'X', 'Estudar Matéria e Substância: teoria, revisão ativa e questões 2024–2025', 54),
  ('5df211fb-2e1c-49d4-86cd-4d6bf057c286', 5, 'por', 'F', 'Estudar Sintaxe: teoria, revisão ativa e questões 2024–2025', 55),
  ('49922fa8-de9f-4b54-875e-8eb1e4450b88', 5, 'red', 'F', 'Estudar Apresentação: técnica, produção e correção conforme o edital vigente', 56),
  ('f326ca6f-aa41-48cc-8796-e64e1e9908a0', 5, 'red', 'F', 'Produzir e corrigir 1 dissertação completa conforme o edital vigente', 57),
  ('7df73045-c99c-41ba-8e2c-907bc21c6b46', 5, 'mat', 'F', 'Estudar Geometria Plana: teoria, revisão ativa e questões 2024–2025', 58),
  ('6fdc3128-a9af-4cd3-8350-89289b24ef25', 5, 'mat', 'F', 'Estudar Teoria dos Conjuntos e Conjuntos Numéricos: teoria, revisão ativa e questões 2024–2025', 59),
  ('82d3756d-f013-4239-8a0a-f24d6cbd2347', 5, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 60),
  ('2cb6cced-6c34-4a85-84ff-53c8656f2881', 5, 'prov', 'F', 'Executar o caderno indicado sob tempo e transformar erros em revisão ativa', 61),
  ('f4bc663b-7df9-4aff-8bf6-fe061e848ed2', 5, 'fis', 'P', 'Estudar Óptica: teoria, revisão ativa e questões 2024–2025', 62),
  ('a3a4fd97-41d3-48c8-878d-8df463e95563', 5, 'qui', 'P', 'Estudar Estequiometria: teoria, revisão ativa e questões 2024–2025', 63),
  ('1b6bddf0-5851-46fd-82e6-58d87990e316', 5, 'qui', 'P', 'Estudar Estrutura Atômica Moderna: teoria, revisão ativa e questões 2024–2025', 64),
  ('f15464da-3ff8-49be-80e9-3e18ae4d22d8', 5, 'qui', 'P', 'Estudar Radioatividade: teoria, revisão ativa e questões 2024–2025', 65),
  ('bb6ae862-0028-4d4a-8535-212cd7f2e1ea', 5, 'mat', 'P', 'Estudar Contagem e Análise Combinatória: teoria, revisão ativa e questões 2024–2025', 66),
  ('75e84564-b54f-4f45-8ffc-3c001da6d686', 5, 'geo', 'P', 'Estudar Geografia Geral — O Espaço Político e Econômico: teoria, revisão ativa e questões 2024–2025', 67),
  ('5d0871e8-259a-4ff8-8337-5d0a4d08aacd', 5, 'his', 'P', 'Estudar A Montagem da Colonização Europeia na América: teoria, revisão ativa e questões 2024–2025', 68),
  ('8126ebde-7a43-483a-833c-c51b40a8b450', 5, 'his', 'P', 'Estudar O Pensamento e a Ideologia no Século XIX: teoria, revisão ativa e questões 2024–2025', 69),
  ('2dd18fb9-97b1-449a-8a9f-121449f613da', 6, 'red', 'F', 'Produzir e corrigir 1 dissertação completa conforme o edital vigente', 70),
  ('9d9b27a1-da75-4404-8d8c-d3154eb3c472', 6, 'mat', 'F', 'Estudar Polinômios: teoria, revisão ativa e questões 2024–2025', 71),
  ('1dad483f-98e9-4e93-8c4d-0c17cec3f50d', 6, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 72),
  ('c2ac7efd-8fa9-4dcc-86aa-323c4b1f2ffb', 6, 'prov', 'F', 'Executar o caderno indicado sob tempo e transformar erros em revisão ativa', 73),
  ('9d0f91e2-dc93-4b63-8247-537716b9d7b6', 6, 'por', 'P', 'Estudar Teoria da Linguagem: teoria, revisão ativa e questões 2024–2025', 74),
  ('0e43e3d2-4514-4e8b-81c3-d3035e0a8f6d', 6, 'fis', 'P', 'Estudar Ondas: teoria, revisão ativa e questões 2024–2025', 75),
  ('d88cc881-2de2-4605-8dca-919124b89f33', 6, 'qui', 'P', 'Estudar Classificações Periódicas: teoria, revisão ativa e questões 2024–2025', 76),
  ('d8ce4c72-a015-44a9-89f0-e748bf20455f', 6, 'qui', 'P', 'Estudar Gases: teoria, revisão ativa e questões 2024–2025', 77),
  ('32ed3062-6828-431f-832d-434cd44383cb', 6, 'qui', 'P', 'Estudar Propriedades coligativas: teoria, revisão ativa e questões 2024–2025', 78),
  ('247171f1-a4e1-4c8b-88cf-0b1bff689d4a', 6, 'mat', 'P', 'Estudar Funções: teoria, revisão ativa e questões 2024–2025', 79),
  ('0aa9bea6-e4a6-47c5-8469-5e6f410505d8', 6, 'mat', 'P', 'Estudar Probabilidade: teoria, revisão ativa e questões 2024–2025', 80),
  ('a67951e8-549c-47e8-845a-64cf6e847b66', 6, 'geo', 'P', 'Estudar Geografia Geral — O Espaço Humano: teoria, revisão ativa e questões 2024–2025', 81),
  ('42d8420b-b636-403f-8db0-696f9f252165', 6, 'his', 'P', 'Estudar O Mundo na Época da Primeira Guerra Mundial: teoria, revisão ativa e questões 2024–2025', 82),
  ('03e2e250-8327-48f3-8a1e-5856385889ca', 6, 'his', 'P', 'Estudar O Sistema Colonial Português na América: teoria, revisão ativa e questões 2024–2025', 83),
  ('b832dc79-a074-43e3-8f52-731d4aa4c92c', 7, 'red', 'F', 'Produzir e corrigir 1 dissertação completa conforme o edital vigente', 84),
  ('2abce69b-3a5d-4098-8533-86b341f31645', 7, 'fis', 'F', 'Estudar Eletricidade: teoria, revisão ativa e questões 2024–2025', 85),
  ('ce711e66-cc96-4797-8392-d343bda7bfd0', 7, 'qui', 'F', 'Estudar Princípios da química orgânica: teoria, revisão ativa e questões 2024–2025', 86),
  ('78e7b51a-9c9d-4c4b-883e-8305f067298e', 7, 'mat', 'F', 'Estudar Equações Polinomiais: teoria, revisão ativa e questões 2024–2025', 87),
  ('6b21b2bf-19df-4b85-8bd2-0204ced58984', 7, 'mat', 'F', 'Estudar Matrizes, Determinantes e Sistemas Lineares: teoria, revisão ativa e questões 2024–2025', 88),
  ('330a141d-5655-4ee8-8ed4-7f68becf2d00', 7, 'ing', 'F', 'Bloco cronometrado de compreensão de texto e estruturas gramaticais', 89),
  ('111d8c6b-a0a7-4778-836e-a671f5f2bfec', 7, 'prov', 'F', 'Executar o caderno indicado sob tempo e transformar erros em revisão ativa', 90),
  ('64dc0ea1-a4fe-447d-87c3-7687187911d1', 7, 'por', 'P', 'Estudar Estilística: teoria, revisão ativa e questões 2024–2025', 91),
  ('efcf6569-b120-4977-800a-45dad98b04bb', 7, 'qui', 'P', 'Estudar Termoquímica: teoria, revisão ativa e questões 2024–2025', 92),
  ('f59078ea-044e-44bb-88a2-f0979be43f17', 7, 'mat', 'P', 'Estudar Função Linear, Função Afim e Função Quadrática: teoria, revisão ativa e questões 2024–2025', 93),
  ('1e5adbc1-5167-445d-8784-7c27545d6715', 7, 'geo', 'P', 'Estudar Geografia do Brasil — O Espaço Natural: teoria, revisão ativa e questões 2024–2025', 94),
  ('9c9cedf1-d272-4497-8593-2c401aa46e42', 7, 'his', 'P', 'Estudar A Sociedade Feudal: teoria, revisão ativa e questões 2024–2025', 95),
  ('df964a3c-cf44-454e-8c1a-aad350c09607', 7, 'his', 'P', 'Estudar O Iluminismo e o Despotismo Esclarecido: teoria, revisão ativa e questões 2024–2025', 96),
  ('d85948f6-81d7-4354-85b7-70dd4bb68789', 7, 'his', 'P', 'Estudar O Mundo na Época da Segunda Guerra Mundial: teoria, revisão ativa e questões 2024–2025', 97),
  ('d465effe-5035-4fba-80a6-db9c8d2ecb56', 7, 'qui', 'X', 'Estudar Ligações Químicas: teoria, revisão ativa e questões 2024–2025', 98),
  ('66227ed2-c76e-4c6b-8f8f-74faa9e3c5ab', 8, 'por', 'F', 'Refazer erros recorrentes de Português e Literatura', 99),
  ('6517be90-66c2-4c93-8fdb-aa7c7729ce99', 8, 'red', 'F', 'Produzir 2 redações completas; corrigir conteúdo, linguagem e apresentação', 100),
  ('fb13c055-764b-429a-821f-4a3d074be700', 8, 'mat', 'F', 'Refazer erros recorrentes de Matemática e fechar fórmulas de alto uso', 101),
  ('760880bf-28fd-4637-85bb-f9a4d5c670ff', 8, 'prov', 'F', 'Simular os dois dias oficiais, 13h30–18h00, com intervalo real de 24 horas', 102),
  ('1900b2bb-fac3-49f2-86c9-52c7a71aa8a7', 8, 'fis', 'P', 'Revisar erros de Física dos quatro cadernos tagueados', 103),
  ('5afb9ed5-c348-42f3-8b55-3011f373880f', 9, 'prov', 'F', 'Executar o Dia 1 em 12/09 e o Dia 2 em 13/09; priorizar sono e logística', 104),
  ('39817a46-d29a-48a9-859b-be1b5b42d705', 9, 'por', 'P', 'Revisão leve de interpretação, sintaxe e escolas literárias', 105),
  ('d6de7b97-e95f-4378-860e-434e91004bea', 9, 'red', 'P', 'Revisar estrutura, conectivos e checklist de apresentação da redação', 106),
  ('44c7dac6-fa2e-4909-84fd-bfa603136ca1', 9, 'mat', 'P', 'Revisão leve de fórmulas e questões já dominadas', 107),
  ('b9d5dd38-a1d8-4902-80b3-28fdedddd304', 9, 'prov', 'P', 'Reler o caderno de erros; nenhuma prova completa após quarta-feira', 108)
  ) as a(id, semana_numero, disciplina_codigo, prioridade, texto, ordem);

insert into trilha_planos (exam_tag, tipo, nome, descricao, status_dado, ordem)
values
  ('espcex', 'anual', 'EsPCEx — Trilha Anual', 'Programa completo com ciclos de fundação, consolidação e prova.', 'inferencia', 0),
  ('espcex', 'semestral', 'EsPCEx — Trilha Semestral', 'Programa completo comprimido, com revisão espaçada e redação semanal.', 'inferencia', 1),
  ('espcex', 'intensiva', 'EsPCEx — Trilha Intensiva', 'Nove semanas orientadas pelo edital vigente e pela recorrência 2024–2025.', 'inferencia', 2),
  ('espcex', 'reta_final', 'EsPCEx — Reta Final', 'Dois dias simulados, revisão de erros e blindagem da redação.', 'inferencia', 3)
on conflict (exam_tag, tipo) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  status_dado = excluded.status_dado,
  ordem = excluded.ordem;

with dados (id, materia_codigo, assunto_nome, nivel, nome, objetivo, prioridade,
            qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao,
            criterio_excelencia, xp_sugerido, origem, status_dado, ordem,
            meta_questoes, meta_acuracia) as (
  values
  ('b6444479-8550-4af1-842a-e36596e462d5', 'por', 'Leitura, interpretação e análise de textos', 'intermediario', 'Leitura sem perda', 'Sustentar interpretação precisa sob tempo.', 'alta', 60, 120, '≥60 questões e ≥80% de acurácia no recorte.', '≥90% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 0, 60, 80),
  ('504ea57f-815d-4bed-81e2-03da0fc8efae', 'por', 'Sintaxe', 'intermediario', 'Sintaxe aplicada', 'Fechar análise, regência, concordância e pontuação.', 'alta', 50, 110, '≥50 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 1, 50, 78),
  ('a1000000-0000-4000-8000-000000000004', 'por', 'Literatura Brasileira', 'intermediario', 'Literatura que cai', 'Cobrir escolas literárias e leitura de época.', 'media', 40, 90, '≥40 questões e ≥75% de acurácia no recorte.', '≥85% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 2, 40, 75),
  ('676feb08-f982-4e71-8c58-75551daaead0', 'red', 'Dissertação', 'intermediario', 'Tese e progressão', 'Construir dissertação com tese, argumentos e conclusão coerentes.', 'alta', null, 120, 'Acompanhamento manual: entregar produções corrigidas até cumprir o objetivo.', 'Duas produções consecutivas aptas, sem desvio eliminatório.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 3, null, null),
  ('7a631472-c3bf-423b-838c-7d269afdbf71', 'red', 'Gramática', 'intermediario', 'Redação sem desvio', 'Reduzir desvios gramaticais nas produções completas.', 'alta', null, 90, 'Acompanhamento manual: entregar produções corrigidas até cumprir o objetivo.', 'Duas produções consecutivas aptas, sem desvio eliminatório.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 4, null, null),
  ('4338cfec-c72c-4810-89f9-1e1fdbea7cb6', 'red', 'Apresentação', 'reta_final', 'Entrega apta', 'Cumprir legibilidade, margens, linhas e apresentação exigidas.', 'alta', null, 60, 'Acompanhamento manual: entregar produções corrigidas até cumprir o objetivo.', 'Duas produções consecutivas aptas, sem desvio eliminatório.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 5, null, null),
  ('e79d814f-897a-498f-8fe4-a1ac8442307c', 'fis', 'Mecânica', 'avancado', 'Mecânica sob tempo', 'Integrar cinemática, dinâmica, energia e hidrostática.', 'alta', 60, 140, '≥60 questões e ≥80% de acurácia no recorte.', '≥90% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 6, 60, 80),
  ('f5d04e14-2524-4445-87a1-ec9d1da20876', 'fis', 'Eletricidade', 'intermediario', 'Eletricidade fechada', 'Dominar eletrostática, circuitos e eletromagnetismo.', 'alta', 45, 110, '≥45 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 7, 45, 78),
  ('13569d25-7007-40d3-8772-c485089abd2c', 'fis', 'Termologia', 'intermediario', 'Termologia sem surpresa', 'Resolver calorimetria, gases e termodinâmica.', 'media', 40, 100, '≥40 questões e ≥75% de acurácia no recorte.', '≥85% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 8, 40, 75),
  ('831fc291-d17b-4648-8c4d-5e42996a6988', 'qui', 'Princípios da química orgânica', 'intermediario', 'Orgânica reconhecível', 'Identificar funções, nomenclatura, isomeria e reações.', 'alta', 55, 130, '≥55 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 9, 55, 78),
  ('4d99951e-a3f9-4ef6-8b3b-c124201be6fa', 'qui', 'Equilíbrio Químico', 'avancado', 'Equilíbrio dominado', 'Resolver equilíbrio, pH e deslocamentos com segurança.', 'alta', 50, 120, '≥50 questões e ≥80% de acurácia no recorte.', '≥90% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 10, 50, 80),
  ('35afa3b4-b3bb-4e59-8c72-3ef5c1041ac2', 'qui', 'Eletroquímica/Eletrólise', 'avancado', 'Eletroquímica real', 'Fechar pilhas e eletrólise sem confusão de OCR.', 'media', 40, 100, '≥40 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 11, 40, 78),
  ('3bda20ce-b8d2-4df6-8e90-e0c2a194a9b5', 'mat', 'Funções', 'avancado', 'Funções integradas', 'Ler domínio, imagem, gráficos e composições rapidamente.', 'alta', 70, 150, '≥70 questões e ≥82% de acurácia no recorte.', '≥92% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 12, 70, 82),
  ('a1000000-0000-4000-8000-000000000005', 'mat', 'Geometria Analítica', 'avancado', 'Geometria Analítica', 'Dominar retas, circunferência e cônicas.', 'alta', 60, 140, '≥60 questões e ≥82% de acurácia no recorte.', '≥92% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 13, 60, 82),
  ('a1babc76-39ce-4c11-862c-bd63791f92e4', 'mat', 'Geometria Plana', 'avancado', 'Geometria Plana fechada', 'Automatizar semelhança, relações métricas, áreas e círculos.', 'alta', 70, 150, '≥70 questões e ≥82% de acurácia no recorte.', '≥92% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 14, 70, 82),
  ('a989ca0b-db35-4e85-8134-351ef99c2ce1', 'ing', 'Compreensão de textos', 'intermediario', 'Reading sob relógio', 'Localizar ideia central, inferência e referência lexical.', 'alta', 60, 100, '≥60 questões e ≥82% de acurácia no recorte.', '≥92% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 15, 60, 82),
  ('1a42b030-8b87-4bf4-8997-c8a7e793cf59', 'ing', 'Estruturas gramaticais', 'intermediario', 'Grammar de alto retorno', 'Fechar estruturas gramaticais cobradas diretamente.', 'alta', 50, 90, '≥50 questões e ≥82% de acurácia no recorte.', '≥92% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 16, 50, 82),
  ('413b75f5-a955-48d4-8f59-ec34c8779219', 'ing', 'Estruturas gramaticais', 'reta_final', 'Word formation', 'Reconhecer prefixos, sufixos e formação de palavras do programa vigente.', 'media', 30, 60, '≥30 questões e ≥80% de acurácia no recorte.', '≥90% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 17, 30, 80),
  ('8780a718-6d50-4117-8580-167e7a0b0d4f', 'his', 'O Mundo na Guerra Fria', 'intermediario', 'Guerra Fria e Brasil', 'Conectar bipolaridade, conflitos e República até 1991.', 'alta', 50, 110, '≥50 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 18, 50, 78),
  ('df2ae4c8-6570-4fcd-850e-905a88d1e385', 'his', 'O Brasil Imperial', 'intermediario', 'Brasil Imperial em sequência', 'Dominar Joanino, Reinado, Regências e crise monárquica.', 'media', 45, 100, '≥45 questões e ≥76% de acurácia no recorte.', '≥86% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 19, 45, 76),
  ('5eb83e72-d158-4f3f-85de-21dc306559b8', 'his', 'O Mundo na Época da Primeira Guerra Mundial', 'intermediario', 'Primeira Guerra e República', 'Integrar guerra, República da Espada e República Velha.', 'media', 45, 100, '≥45 questões e ≥76% de acurácia no recorte.', '≥86% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 20, 45, 76),
  ('04d58518-5fb4-419f-8c01-80e131c07975', 'geo', 'Geografia Geral — O Espaço Natural', 'intermediario', 'Espaço natural', 'Resolver clima, relevo, solos, biomas e água.', 'alta', 55, 120, '≥55 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 21, 55, 78),
  ('8a05d13a-4eef-4248-8be5-b533dfdb3fab', 'geo', 'Geografia Geral — O Espaço Político e Econômico', 'intermediario', 'Geopolítica aplicada', 'Interpretar poder global, blocos, conflitos e fluxos econômicos.', 'alta', 50, 110, '≥50 questões e ≥78% de acurácia no recorte.', '≥88% nas últimas 20 questões.', 90, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 22, 50, 78),
  ('97dd9c3d-e490-4c1a-8883-ccaa03e9d5e1', 'geo', 'Geografia do Brasil — O Espaço Humano', 'intermediario', 'Brasil humano', 'Fechar população, urbanização e problemas urbanos brasileiros.', 'media', 45, 100, '≥45 questões e ≥76% de acurácia no recorte.', '≥86% nas últimas 20 questões.', 65, 'Edital nº 2 S Conc Adms, de 22 de abril de 2026 — Anexo C; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025', 'inferencia', 23, 45, 76)
)
insert into missoes
  (id, exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, prioridade,
   qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao,
   criterio_excelencia, xp_sugerido, origem, status_dado, ordem,
   meta_questoes, meta_acuracia)
select d.id::uuid, 'espcex', d.materia_codigo, a.id, d.nivel, d.nome, d.objetivo,
       d.prioridade, d.qtd_questoes_sugerida, d.tempo_estimado_min,
       d.criterio_conclusao, d.criterio_excelencia, d.xp_sugerido, d.origem,
       d.status_dado, d.ordem, d.meta_questoes, d.meta_acuracia
  from dados d
  join assuntos a
    on a.exam_tag = 'espcex'
   and a.materia_codigo = d.materia_codigo
   and a.nome = d.assunto_nome
on conflict (id) do update set
  materia_codigo = excluded.materia_codigo,
  assunto_id = excluded.assunto_id,
  nivel = excluded.nivel,
  nome = excluded.nome,
  objetivo = excluded.objetivo,
  prioridade = excluded.prioridade,
  qtd_questoes_sugerida = excluded.qtd_questoes_sugerida,
  tempo_estimado_min = excluded.tempo_estimado_min,
  criterio_conclusao = excluded.criterio_conclusao,
  criterio_excelencia = excluded.criterio_excelencia,
  xp_sugerido = excluded.xp_sugerido,
  origem = excluded.origem,
  status_dado = excluded.status_dado,
  ordem = excluded.ordem,
  meta_questoes = excluded.meta_questoes,
  meta_acuracia = excluded.meta_acuracia;

with missao_fonte (id, ordem) as (
  values
  ('b6444479-8550-4af1-842a-e36596e462d5', 0),
  ('504ea57f-815d-4bed-81e2-03da0fc8efae', 1),
  ('a1000000-0000-4000-8000-000000000004', 2),
  ('676feb08-f982-4e71-8c58-75551daaead0', 3),
  ('7a631472-c3bf-423b-838c-7d269afdbf71', 4),
  ('4338cfec-c72c-4810-89f9-1e1fdbea7cb6', 5),
  ('e79d814f-897a-498f-8fe4-a1ac8442307c', 6),
  ('f5d04e14-2524-4445-87a1-ec9d1da20876', 7),
  ('13569d25-7007-40d3-8772-c485089abd2c', 8),
  ('831fc291-d17b-4648-8c4d-5e42996a6988', 9),
  ('4d99951e-a3f9-4ef6-8b3b-c124201be6fa', 10),
  ('35afa3b4-b3bb-4e59-8c72-3ef5c1041ac2', 11),
  ('3bda20ce-b8d2-4df6-8e90-e0c2a194a9b5', 12),
  ('a1000000-0000-4000-8000-000000000005', 13),
  ('a1babc76-39ce-4c11-862c-bd63791f92e4', 14),
  ('a989ca0b-db35-4e85-8134-351ef99c2ce1', 15),
  ('1a42b030-8b87-4bf4-8997-c8a7e793cf59', 16),
  ('413b75f5-a955-48d4-8f59-ec34c8779219', 17),
  ('8780a718-6d50-4117-8580-167e7a0b0d4f', 18),
  ('df2ae4c8-6570-4fcd-850e-905a88d1e385', 19),
  ('5eb83e72-d158-4f3f-85de-21dc306559b8', 20),
  ('04d58518-5fb4-419f-8c01-80e131c07975', 21),
  ('8a05d13a-4eef-4248-8be5-b533dfdb3fab', 22),
  ('97dd9c3d-e490-4c1a-8883-ccaa03e9d5e1', 23)
), planos_fonte as (
  select id, tipo from trilha_planos where exam_tag = 'espcex'
)
insert into trilha_plano_missoes (plano_id, missao_id, fase, semana_sugerida, ordem)
select p.id, m.id::uuid,
       case p.tipo
         when 'anual' then 'Consolidação'
         when 'semestral' then 'Consolidação'
         when 'intensiva' then 'Ciclo de 9 semanas'
         else 'Reta Final'
       end,
       case when p.tipo = 'reta_final' then 8 else 1 + (m.ordem % 9) end,
       m.ordem
  from planos_fonte p cross join missao_fonte m
on conflict (plano_id, missao_id) do update set
  fase = excluded.fase,
  semana_sugerida = excluded.semana_sugerida,
  ordem = excluded.ordem;

do $$
declare
  n_semanas int;
  n_atividades int;
  n_missoes int;
  n_materias int;
  n_planos int;
begin
  select count(*)::int into n_semanas from trilha_semanas where trilha_id = (select id from trilhas where nicho = 'espcex' and versao = 1);
  select count(*)::int into n_atividades from atividades_modelo where trilha_id = (select id from trilhas where nicho = 'espcex' and versao = 1);
  select count(*)::int, count(distinct materia_codigo)::int into n_missoes, n_materias
    from missoes where exam_tag = 'espcex';
  select count(*)::int into n_planos from trilha_planos where exam_tag = 'espcex';
  if n_semanas <> 9 or n_atividades <> 109 then
    raise exception 'Trilha EsPCEx incompleta: semanas %, atividades %', n_semanas, n_atividades;
  end if;
  if n_missoes < 24 or n_materias <> 8 or n_planos <> 4 then
    raise exception 'Missões EsPCEx incompletas: missões %, matérias %, planos %', n_missoes, n_materias, n_planos;
  end if;
end $$;
