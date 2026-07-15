-- ============================================================
-- 0041 — EST1-B1: ÍNDICE usuarios.email (cache de e-mail Auth)
-- ------------------------------------------------------------
-- A 0032 adicionou usuarios.email como cache do e-mail do Auth para o
-- backoffice, mas sem índice. A Edge Function backoffice-coordenador
-- passa (EST1-B1) a resolver o coordenador existente por ESSE cache em
-- vez de varrer a 1ª página de 1000 contas do Auth (achado EST0
-- SEGURANCA-01/A8: como todo aluno/responsável é auth.users, o projeto
-- passa de 1000 contas com 1–2 escolas e a busca falhava fora da
-- página 1, retornando um 500 enganoso). Sem este índice, a nova busca
-- seria um seq scan em usuarios a cada provisionamento.
--
-- Não-único de propósito: e-mail pode ser null (aluno/responsável usam
-- e-mail sintético; coordenação tem e-mail real). Aditiva, idempotente.
-- ============================================================

create index if not exists idx_usuarios_email
  on usuarios (email)
  where email is not null;

comment on index idx_usuarios_email is
  'EST1-B1 (0041): cache de e-mail Auth para resolver coordenador no '
  'backoffice sem varrer o Auth (achado EST0 SEGURANCA-01).';
