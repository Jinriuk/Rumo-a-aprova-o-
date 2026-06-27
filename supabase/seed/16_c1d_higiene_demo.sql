-- ============================================================
-- C1D — Higiene da base demo/vitrine (LGPD)
-- ------------------------------------------------------------
-- Fecha os pontos #20 e #21 da auditoria original:
--   #20 — timestamps de consentimento (aceito_em) todos iguais
--   #21 — nomes de responsáveis genéricos ("Responsável de <Aluno>")
--
-- ESCOPO: SOMENTE a escola de vitrine
--   (11111111-1111-4111-8111-111111111111).
-- Nenhuma outra escola é tocada.
--
-- IDEMPOTENTE: o UPDATE só atinge linhas que AINDA tenham o nome
-- genérico ("Responsável d%"). Rodar de novo não re-sorteia nada.
--
-- Nomes fictícios plausíveis (não correspondem a pessoas reais);
-- escolha determinística por hash do aluno_id → estável entre runs.
-- Vínculo responsável-aluno preservado (só o texto do nome muda).
-- RLS preservada (DML comum, sem service_role no front).
-- ============================================================

do $$
declare
  v_escola uuid := '11111111-1111-4111-8111-111111111111';
  -- 30 prenomes fictícios (mix), 20 sobrenomes → ~600 combinações
  nomes text[] := array[
    'Ana Paula','Maria Helena','Patrícia','Fernanda','Cláudia','Sandra',
    'Luciana','Adriana','Vanessa','Renata','Simone','Tatiana','Juliana',
    'Carla','Beatriz','Marcelo','Roberto','Paulo César','Anderson',
    'Rodrigo','Fábio','Sérgio','Eduardo','Gustavo','Marcos','Leonardo',
    'André','Ricardo','Cristiano','Vinícius'];
  sobrenomes text[] := array[
    'Monteiro','Albuquerque','Tavares','Siqueira','Rezende','Fontes',
    'Camargo','Bittencourt','Nogueira','Vasconcelos','Peixoto','Macedo',
    'Andrade','Queiroz','Bastos','Carvalho','Moraes','Teixeira',
    'Pacheco','Drummond'];
begin
  update consentimentos c
     set responsavel_nome =
           nomes[1 + (abs(hashtext(c.aluno_id::text || 'n')) % array_length(nomes, 1))]
           || ' ' ||
           sobrenomes[1 + (abs(hashtext(c.aluno_id::text || 's')) % array_length(sobrenomes, 1))],
         -- distribui aceito_em ao longo de ~24 dias (22/05 a 14/06),
         -- em horário comercial (08:00–18:00), determinístico por aluno.
         aceito_em =
           (date '2026-05-22' + (abs(hashtext(c.aluno_id::text || 'd')) % 24))
           + (((abs(hashtext(c.aluno_id::text || 'm')) % 600) + 480) * interval '1 minute')
   where c.escola_id = v_escola
     and c.responsavel_nome ilike 'Responsável d%';
end $$;
