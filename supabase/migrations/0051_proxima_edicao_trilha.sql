-- ============================================================
-- 0051 — PRÓXIMA EDIÇÃO DA TRILHA (o ciclo que se renova)
-- ------------------------------------------------------------
-- O PROBLEMA
--
-- A DATA DA PROVA já se renova sozinha desde a Onda 3: `proximaProva`
-- (concursos.js) lê mes_prova/dia_prova do concurso e rola para o ano
-- seguinte quando a data passa. O aluno vê "≈ N dias" para sempre.
--
-- O PLANO DE ESTUDO não acompanha. `trilha_semanas` tem datas absolutas,
-- e quando a última semana vence o aluno entra em `estado_ciclo =
-- 'encerrado'` (0049) e FICA LÁ. Não existia caminho de saída — a tela
-- do responsável já promete um ("a coordenação abre o próximo ciclo
-- quando ele estiver pronto", ResumoResponsavel.jsx) que não existia.
--
-- POR QUE NÃO BASTA EMPURRAR AS DATAS DA MESMA TRILHA
--
-- `metas` tem unique (aluno_id, trilha_id, semana_numero). Um aluno só
-- pode ter UMA meta por semana de uma trilha — ou seja, o schema proíbe
-- repetir a mesma trilha. Se as datas da trilha andassem para o ano
-- seguinte, o aluno chegaria na "semana 3" já tendo a meta 3 do ano
-- passado (fechada); `gerar_meta_protegida` responderia 'ja_tinha' e ele
-- travaria — e só destravaria apagando o histórico, que é justamente o
-- que não pode acontecer.
--
-- A SOLUÇÃO: EDIÇÃO NOVA
--
-- `trilhas` já tem unique (nicho, versao). Uma edição nova é uma trilha
-- nova, com as mesmas semanas deslocadas e as mesmas atividades
-- clonadas. O aluno migra para ela; as metas antigas continuam presas à
-- edição anterior.
--
-- O HISTÓRICO SOBREVIVE POR CONSTRUÇÃO, e isso não é promessa — é
-- consequência de onde cada coisa está guardada:
--   • metas/meta_atividades → presas à trilha ANTIGA, intactas;
--   • registros_estudo, simulados → presos ao ALUNO, nunca à trilha;
--   • aluno_eventos_progresso (XP, patente, conquistas) → ao ALUNO;
--   • calcularMetricas soma `totDone`, acerto, streak e desempenho por
--     matéria sobre TODOS os registros, sem filtro de trilha. Só as
--     métricas "desta semana" olham a semana corrente, que é o certo.
-- Trocar de edição zera o ciclo, não a vida do aluno.
--
-- POR QUE NÃO É AUTOMÁTICO
--
-- Ao fim de um ciclo a turma se divide: quem passou sai, quem não passou
-- repete, quem desistiu some. O motor não tem como saber quem é quem, e
-- renovar todo mundo em silêncio fabricaria aluno ativo — corrompendo
-- exatamente os alertas de "sem atividade" que as Ondas 5 e 7 acabaram
-- de consertar. Por isso a abertura é ATO DA COORDENAÇÃO, que é o que a
-- tela do responsável já promete. O motor faz a parte mecânica; a
-- escola decide quem entra.
--
-- Idempotente: reabrir com a mesma âncora devolve a edição existente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) O clone. Desloca as semanas de forma que a ÚLTIMA termine na
--    âncora (a data da próxima prova), preservando a forma do plano:
--    todas as semanas andam o mesmo número de dias.
-- ------------------------------------------------------------
create or replace function app.abrir_proximo_ciclo(p_trilha uuid, p_ancora date)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_origem   trilhas;
  v_fim_atual date;
  v_delta    int;
  v_nova     uuid;
begin
  select * into v_origem from trilhas where id = p_trilha;
  if not found then
    raise exception 'trilha % não existe', p_trilha;
  end if;

  select max(fim) into v_fim_atual from trilha_semanas where trilha_id = p_trilha;
  if v_fim_atual is null then
    raise exception 'trilha % não tem semanas — nada a deslocar', p_trilha;
  end if;

  -- A ordem aqui importa. A validação da âncora vem ANTES da busca por
  -- edição existente: com as duas invertidas, pedir a data de fim do
  -- ciclo ATUAL devolvia a própria trilha de origem em silêncio (ela
  -- "já termina na âncora"), e a coordenação moveria alunos para a
  -- mesma trilha achando que abriu a seguinte. O contrato é explícito:
  -- só se abre ciclo que termina DEPOIS do atual.
  v_delta := p_ancora - v_fim_atual;
  if v_delta <= 0 then
    raise exception 'a âncora % não é posterior ao fim do ciclo atual (%)', p_ancora, v_fim_atual;
  end if;

  -- Idempotência: já existe OUTRA edição deste nicho terminando na
  -- âncora? Então é ela — reabrir não cria uma segunda.
  select t.id into v_nova
    from trilhas t
   where t.nicho = v_origem.nicho
     and t.id <> p_trilha
     and (select max(fim) from trilha_semanas s where s.trilha_id = t.id) = p_ancora
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

  insert into trilha_semanas (trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
  select v_nova, numero, inicio + v_delta, fim + v_delta, foco, simulado, meta_questoes
    from trilha_semanas where trilha_id = p_trilha;

  insert into atividades_modelo (trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
  select v_nova, semana_numero, disciplina_codigo, prioridade, texto, ordem
    from atividades_modelo where trilha_id = p_trilha;

  return v_nova;
end $$;

revoke all on function app.abrir_proximo_ciclo(uuid, date) from public, authenticated, anon;
grant execute on function app.abrir_proximo_ciclo(uuid, date) to service_role;

comment on function app.abrir_proximo_ciclo(uuid, date) is
  '0051: clona uma trilha numa EDIÇÃO nova cujas semanas terminam na '
  'âncora (próxima prova), preservando a forma do plano. O histórico '
  'fica na edição anterior: metas são unique por (aluno, trilha, semana), '
  'então edição nova é a única forma de o aluno repetir o plano sem '
  'apagar o que fez. Idempotente pela âncora.';

-- ------------------------------------------------------------
-- 2) A porta da coordenação. Abre a edição e move os alunos escolhidos
--    — só os da própria escola, e só quem já encerrou o ciclo.
-- ------------------------------------------------------------
create or replace function public.abrir_proximo_ciclo(
  p_trilha uuid, p_ancora date, p_alunos uuid[] default null)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_escola uuid := app.tenant_id();
  v_nova   uuid;
  v_movidos int := 0;
begin
  if not (app.papel() = 'coordenacao' or app.eh_super_admin()) then
    raise exception 'acesso negado: só a coordenação abre ciclo';
  end if;
  if v_escola is null and not app.eh_super_admin() then
    raise exception 'sem escola no token';
  end if;

  v_nova := app.abrir_proximo_ciclo(p_trilha, p_ancora);

  if p_alunos is not null then
    -- só alunos DESTA escola, e só os que já encerraram o ciclo atual:
    -- mover quem ainda está em curso jogaria fora a semana corrente.
    update alunos a
       set trilha_id = v_nova
     where a.id = any(p_alunos)
       and (a.escola_id = v_escola or app.eh_super_admin())
       and a.trilha_id = p_trilha
       and (select estado from app.estado_ciclo(a.trilha_id)) = 'encerrado';
    get diagnostics v_movidos = row_count;
  end if;

  return jsonb_build_object('trilha_id', v_nova, 'alunos_movidos', v_movidos);
end $$;

revoke all on function public.abrir_proximo_ciclo(uuid, date, uuid[]) from public, anon;
grant execute on function public.abrir_proximo_ciclo(uuid, date, uuid[]) to authenticated, service_role;

comment on function public.abrir_proximo_ciclo(uuid, date, uuid[]) is
  '0051: porta da coordenação para abrir o próximo ciclo — a ação que '
  'ResumoResponsavel.jsx já prometia ao responsável. Move só alunos da '
  'própria escola e só os que já encerraram o ciclo. O histórico fica '
  'na edição anterior, intacto.';

-- ------------------------------------------------------------
-- ROLLBACK (manual): drop das duas funções. Não cria tabela nem coluna,
-- e não altera dado existente — só passa a permitir criar edições.
-- ------------------------------------------------------------
