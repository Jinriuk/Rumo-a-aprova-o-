-- ============================================================
-- 0058 — escolas: a coordenação só escreve a marca, e ninguém com token
--         de usuário lê as colunas do backoffice (URGENTE)
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono, pedida em prompt próprio (Etapa 2,
-- trava 3). Escrita e ensaiada só em Postgres local descartável.
-- NUMERAÇÃO: depende da 0055, 0056 e 0057 só pela numeração contígua
-- exigida por teste; não reescreve nada delas.
--
-- O ACHADO (Etapa 2, fatia 7, 24/09/2026)
--   A policy `escolas_update` (0002, refeita na 0027) confere só a
--   linha: `id = tenant`, papel coordenação e escola operacional. O
--   grant de UPDATE é da tabela inteira. Com isso a coordenação, pela
--   API, altera QUALQUER coluna da própria escola, inclusive as que só o
--   backoffice deveria mexer (backoffice_editar_escola e
--   backoffice_definir_status são exclusivas do super_admin):
--     status, plano, limite_alunos, slug, observacao,
--     email_institucional, telefone_contato, contato_nome,
--     contato_observacao.
--   Exemplos provados em Postgres local: a coordenação marca a própria
--   escola como 'cancelada' (e fica trancada fora, porque a policy exige
--   escola operacional), troca o plano e o limite de alunos, reescreve a
--   observação interna do operador.
--   E a `escolas_select` deixa QUALQUER usuário da escola (aluno e
--   responsável inclusive) ler a linha inteira: a observação interna do
--   operador, o nome e o telefone da pessoa de contato, o plano e o
--   limite.
--   Não cruza escola. Impacto hoje: produção tem uma escola, sem nenhuma
--   dessas colunas preenchidas; o demo tem uma observação, um telefone e
--   um contato preenchidos. `limite_alunos` e `plano` não são aplicados
--   em lugar nenhum além da tela do backoffice (medido por busca no
--   código), então a troca é de rótulo, não de cota.
--
-- A CORREÇÃO: privilégio por coluna, no lugar do privilégio de tabela.
--   UPDATE: só nome, logo_url e cor_acento, que são as três colunas que
--   a tela de marca grava (`modules/escola/Marca.jsx`, `atualizarMarca`).
--   SELECT: as colunas que o app lê fora do backoffice (o embed de
--   `meuPerfil` lê id, nome, slug, logo_url, cor_acento, status e plano)
--   mais cidade, uf e as datas. As internas saem.
--   O backoffice não muda: lê e escreve pelas RPCs SECURITY DEFINER, que
--   rodam como o dono da tabela. Nenhuma policy, view ou função de
--   invocador lê `escolas` (medido: só funções SECURITY DEFINER a leem).
--
-- EFEITO COLATERAL DECLARADO
--   Um `select=*` em `escolas` feito com token de usuário passa a dar
--   42501. O app não faz isso (o teste e2-escolas-colunas-db confere a
--   fonte). Quem precisar de coluna nova na leitura tem de concedê-la
--   aqui, de propósito.
--
-- HOSPEDADOS: `authenticated` tem hoje SELECT, INSERT, UPDATE e DELETE
--   de tabela em `escolas` (grant padrão do Supabase). Os revokes abaixo
--   tiram o SELECT e o UPDATE de tabela; INSERT e DELETE ficam como
--   estão, sem policy, e a RLS continua negando. `anon` não muda (sem
--   policy nenhuma).
--
-- Idempotente: revoke e grant repetidos são no-op.
-- ============================================================

revoke update on escolas from authenticated;
grant update (nome, logo_url, cor_acento) on escolas to authenticated;

revoke select on escolas from authenticated;
grant select (id, nome, slug, logo_url, cor_acento, status, plano, cidade, uf, criada_em, atualizada_em)
  on escolas to authenticated;

-- ------------------------------------------------------------
-- ROLLBACK (manual, se necessário): volta ao privilégio de tabela.
--   revoke update (nome, logo_url, cor_acento) on escolas from authenticated;
--   revoke select (id, nome, slug, logo_url, cor_acento, status, plano, cidade, uf, criada_em, atualizada_em)
--     on escolas from authenticated;
--   grant select, update on escolas to authenticated;
-- ------------------------------------------------------------
