-- ============================================================
-- 0054 — D09: o próximo ciclo nasce com semanas de segunda a domingo
-- ------------------------------------------------------------
-- APROVAÇÃO: dada em 24/09/2026 (demonstração e produção).
-- NUMERAÇÃO: escrita como 0053 no PR do Bloco 4; virou 0054 porque a
-- 0053 do Bloco 2 (consentimento_registrado_em) entrou antes. Nenhum
-- ambiente tinha aplicado esta com o nome antigo, então não há drift.
-- DEPENDÊNCIA: reescreve app.abrir_proximo_ciclo, que nasce na 0051.
-- Onde a 0051 não foi aplicada (produção, em 24/09), esta também não
-- se aplica: a ordem é 0051 → 0052 → 0054.
--
-- O achado (auditoria de 22/09/2026, D09): a trilha do Instituto
-- Meridiano tinha a semana 1 de 9 dias (sábado a domingo) e a 9 de 6
-- dias (segunda a sábado). A forma vinha da trilha-fonte do CN
-- (trilha-cn-v1.json: "semana 1 começa no sábado, 9 termina no sábado
-- da prova"), e `abrir_proximo_ciclo` (0051) a PRESERVAVA: deslocava
-- todas as semanas por (âncora − fim atual), um número qualquer de
-- dias. Resultado: toda edição nova herdava as semanas tortas e, pior,
-- começava a semana no dia da semana em que caísse a prova — a virada
-- do motor é diária, mas metas, "semana corrente" e o resumo semanal
-- supõem segunda a domingo.
--
-- O QUE MUDA
--   As semanas da edição nova são REFEITAS, não deslocadas: N semanas
--   de segunda a domingo, contíguas, e a última é a semana da âncora
--   (termina no domingo da semana da prova; se a prova é num domingo,
--   nele mesmo). Foco, simulado, meta de questões e atividades de cada
--   semana continuam os da origem, na mesma ordem.
--   A idempotência passa a olhar esse domingo: duas âncoras na mesma
--   semana devolvem a mesma edição.
--
-- O QUE NÃO MUDA
--   A âncora continua precisando ser posterior ao fim do ciclo atual;
--   a porta da coordenação (public.abrir_proximo_ciclo) é a mesma; o
--   histórico continua preso à edição anterior. Nenhum dado existente
--   é alterado — só edições criadas daqui em diante saem normalizadas.
--
-- ROLLBACK: reaplicar o corpo de app.abrir_proximo_ciclo da 0051.
-- ============================================================

create or replace function app.abrir_proximo_ciclo(p_trilha uuid, p_ancora date)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_origem    trilhas;
  v_fim_atual date;
  v_n         int;
  v_domingo   date;
  v_nova      uuid;
begin
  select * into v_origem from trilhas where id = p_trilha;
  if not found then
    raise exception 'trilha % não existe', p_trilha;
  end if;

  select max(fim), count(*) into v_fim_atual, v_n from trilha_semanas where trilha_id = p_trilha;
  if v_fim_atual is null then
    raise exception 'trilha % não tem semanas — nada a deslocar', p_trilha;
  end if;

  -- validação ANTES da busca por edição existente (motivo na 0051)
  if p_ancora <= v_fim_atual then
    raise exception 'a âncora % não é posterior ao fim do ciclo atual (%)', p_ancora, v_fim_atual;
  end if;

  -- o domingo da semana da âncora (isodow: 1 = segunda … 7 = domingo)
  v_domingo := p_ancora + (7 - extract(isodow from p_ancora)::int);

  select t.id into v_nova
    from trilhas t
   where t.nicho = v_origem.nicho
     and t.id <> p_trilha
     and (select max(fim) from trilha_semanas s where s.trilha_id = t.id) = v_domingo
   limit 1;
  if v_nova is not null then
    return v_nova;
  end if;

  insert into trilhas (nicho, nome, versao, publicada)
  select v_origem.nicho,
         v_origem.nome || ' — ciclo ' || extract(year from p_ancora)::text,
         coalesce((select max(versao) from trilhas where nicho = v_origem.nicho), 0) + 1,
         true
  returning id into v_nova;

  insert into disciplinas (trilha_id, codigo, nome, abrev, cor, ordem)
  select v_nova, codigo, nome, abrev, cor, ordem
    from disciplinas where trilha_id = p_trilha;

  -- semana k (1..N, pela ordem de `numero`) termina N−k semanas antes
  -- do domingo da âncora e começa 6 dias antes disso: sempre seg–dom
  insert into trilha_semanas (trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
  select v_nova, s.numero,
         v_domingo - 7 * (v_n - s.k) - 6,
         v_domingo - 7 * (v_n - s.k),
         s.foco, s.simulado, s.meta_questoes
    from (select ts.*, row_number() over (order by ts.numero)::int as k
            from trilha_semanas ts where ts.trilha_id = p_trilha) s;

  insert into atividades_modelo (trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
  select v_nova, semana_numero, disciplina_codigo, prioridade, texto, ordem
    from atividades_modelo where trilha_id = p_trilha;

  return v_nova;
end $$;

revoke all on function app.abrir_proximo_ciclo(uuid, date) from public, authenticated, anon;
grant execute on function app.abrir_proximo_ciclo(uuid, date) to service_role;

comment on function app.abrir_proximo_ciclo(uuid, date) is
  '0054 (D09): clona uma trilha numa EDIÇÃO nova com N semanas de segunda a '
  'domingo, a última sendo a semana da âncora (próxima prova). Foco, '
  'simulado, meta e atividades de cada semana vêm da origem. O histórico '
  'fica na edição anterior. Idempotente pelo domingo da semana da âncora.';
