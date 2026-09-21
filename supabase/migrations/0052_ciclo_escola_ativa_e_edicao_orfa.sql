-- ============================================================
-- 0052 — DUAS TRAVAS NO MOTOR DE CICLO (achados do ensaio da 0051)
-- ------------------------------------------------------------
-- O ensaio da Etapa 1 (docs/e1-migrations.md) aplicou a 0051 em banco
-- local descartável e achou dois buracos. Nenhum é defeito da migration
-- 0051 — os dois são da função que ela cria, e nenhum deles desaparece
-- por não aplicar a 0051. Esta migration fecha os dois.
--
-- Ela NÃO altera a 0051: redefine as duas funções com `create or
-- replace`, preservando todo o resto do corpo. A 0051 continua sendo o
-- registro de como o motor nasceu.
--
-- ============================================================
-- CORREÇÃO 1 — ESCOLA SUSPENSA ABRIA CICLO
-- ------------------------------------------------------------
-- MEDIDO, não suposto. Mesmo cenário, única variável o `status`:
--   escola 'ativa'    → {"alunos_movidos": 1}
--   escola 'suspensa' → {"alunos_movidos": 1}
--
-- POR QUE A RLS NÃO SEGUROU
-- A policy existe e está correta:
--   alunos_update USING (escola_id = app.tenant_id()
--                        AND app.papel() = 'coordenacao'
--                        AND app.tenant_operacional())
-- Mas `public.abrir_proximo_ciclo` é SECURITY DEFINER, e o dono das
-- funções (`postgres`) tem rolbypassrls = true nos DOIS ambientes
-- hospedados — confirmado por leitura direta em bdjkgrzfzoamchdpobbl e
-- zckyhihxjjbnqjqilymn, e confirmado de forma independente pela sessão
-- de gestão. Dentro de uma SECURITY DEFINER dessas, a RLS não avalia
-- nada. Depender dela para autorizar é depender de algo que não roda.
--
-- POR QUE NÃO USAR app.tenant_operacional() AQUI
-- Porque ela tem o fallback invertido (C-S04 da auditoria):
--   select coalesce(
--     (select e.status not in ('suspensa','cancelada')
--        from escolas e where e.id = app.tenant_id()),
--     true)
-- O `coalesce(..., true)` responde OPERACIONAL quando a escola não é
-- encontrada. Um token com escola_id que não existe passa. Usar essa
-- função aqui seria herdar exatamente o furo que esta migration existe
-- para fechar.
--
-- Corrigir a própria `tenant_operacional` é tentador e está FORA de
-- escopo de propósito: ela é usada em policies de várias tabelas, e
-- inverter o default pode derrubar fluxo legítimo em lugares que esta
-- migration não testou. Isso é Etapa 2.
--
-- O QUE ESTA MIGRATION FAZ: lê `escolas.status` no CORPO da função,
-- direto, e NEGA em três casos — 'suspensa', 'cancelada' e escola não
-- encontrada. Negar por ausência é o ponto inteiro.
--
-- ============================================================
-- CORREÇÃO 2 — EDIÇÃO ÓRFÃ
-- ------------------------------------------------------------
-- MEDIDO: três chamadas com âncoras diferentes e nenhum aluno elegível
-- deixaram três trilhas completas (9 semanas, 9 disciplinas, 50
-- atividades cada) com zero alunos, cada uma incrementando `versao`.
-- A idempotência da 0051 só protege quando a âncora é EXATAMENTE a
-- mesma; errar a data em um dia cria uma edição órfã, e a tela da
-- coordenação não tem como apagá-la.
--
-- A TRAVA IMPEDE A SEGUNDA EDIÇÃO ÓRFÃ, NÃO A PRIMEIRA.
-- A assinatura tem `p_alunos default null`, então "abrir a edição agora
-- e mover os alunos depois" é uso PREVISTO. Quebrar isso seria trocar
-- um problema por outro.
--
-- O CRITÉRIO NÃO É "QUALQUER EDIÇÃO SEM ALUNOS", e a diferença importa.
-- Ao fim de um ciclo a turma migra, e a edição de ORIGEM fica com zero
-- alunos — legitimamente, é histórico. Se a trava olhasse só "sem
-- alunos", abrir o ciclo seguinte a partir da edição atual seria
-- recusado por causa de uma edição velha e esvaziada. Falso positivo
-- que quebraria o fluxo normal a partir do segundo ciclo.
--
-- Por isso o critério é: edição do mesmo nicho, diferente da origem,
-- SEM ALUNOS e que termina DEPOIS do fim da origem. Ou seja: uma edição
-- criada para o futuro e nunca povoada. Edição passada vazia é
-- histórico e não dispara nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) O clone, agora com a trava da edição órfã.
--    Tudo o mais é idêntico à 0051.
-- ------------------------------------------------------------
create or replace function app.abrir_proximo_ciclo(p_trilha uuid, p_ancora date)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_origem   trilhas;
  v_fim_atual date;
  v_delta    int;
  v_nova     uuid;
  v_orfa     trilhas;
  v_orfa_fim date;
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
  --
  -- ESTE BLOCO VEM ANTES DA TRAVA DE ÓRFÃ, e não é detalhe: é o que
  -- mantém o duplo clique e a reabertura idempotentes. Quem repete a
  -- MESMA âncora recebe a mesma edição de volta, mesmo que ela ainda
  -- não tenha aluno nenhum. A trava abaixo só entra quando se está
  -- prestes a criar uma edição NOVA.
  select t.id into v_nova
    from trilhas t
   where t.nicho = v_origem.nicho
     and t.id <> p_trilha
     and (select max(fim) from trilha_semanas s where s.trilha_id = t.id) = p_ancora
   limit 1;
  if v_nova is not null then
    return v_nova;
  end if;

  -- 0052: TRAVA DA EDIÇÃO ÓRFÃ.
  -- Só chega aqui quem vai criar edição nova. Se já existe uma edição
  -- FUTURA deste nicho sem nenhum aluno, ela é o lixo da tentativa
  -- anterior — ou a edição que a coordenação abriu e ainda não povoou.
  -- Nos dois casos a resposta é a mesma: use aquela, não crie outra.
  select t.* into v_orfa
    from trilhas t
   where t.nicho = v_origem.nicho
     and t.id <> p_trilha
     and not exists (select 1 from alunos a where a.trilha_id = t.id)
     and coalesce((select max(fim) from trilha_semanas s where s.trilha_id = t.id),
                  v_fim_atual) > v_fim_atual
   order by t.versao
   limit 1;

  if found then
    select max(fim) into v_orfa_fim from trilha_semanas where trilha_id = v_orfa.id;
    raise exception
      'já existe a edição "%" (versão %, terminando em %) sem nenhum aluno vinculado. '
      'Use essa edição, ou vincule alunos a ela, antes de abrir outra.',
      v_orfa.nome, v_orfa.versao, v_orfa_fim;
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
  '0051/0052: clona uma trilha numa EDIÇÃO nova cujas semanas terminam na '
  'âncora (próxima prova), preservando a forma do plano. O histórico '
  'fica na edição anterior: metas são unique por (aluno, trilha, semana), '
  'então edição nova é a única forma de o aluno repetir o plano sem '
  'apagar o que fez. Idempotente pela âncora. 0052: recusa criar uma '
  'SEGUNDA edição futura sem alunos — edição passada vazia é histórico '
  'e não bloqueia.';

-- ------------------------------------------------------------
-- 2) A porta da coordenação, agora negando escola não operacional.
--    Tudo o mais é idêntico à 0051.
-- ------------------------------------------------------------
create or replace function public.abrir_proximo_ciclo(
  p_trilha uuid, p_ancora date, p_alunos uuid[] default null)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_escola uuid := app.tenant_id();
  v_nova   uuid;
  v_movidos int := 0;
  v_status text;
begin
  if not (app.papel() = 'coordenacao' or app.eh_super_admin()) then
    raise exception 'acesso negado: só a coordenação abre ciclo';
  end if;
  if v_escola is null and not app.eh_super_admin() then
    raise exception 'sem escola no token';
  end if;

  -- 0052: TRAVA DA ESCOLA NÃO OPERACIONAL.
  --
  -- Lê `escolas.status` aqui, no corpo, em vez de confiar na policy:
  -- esta função é SECURITY DEFINER e o dono tem BYPASSRLS nos dois
  -- ambientes, então a RLS não é avaliada e a policy `alunos_update`
  -- nunca roda. Ver o cabeçalho desta migration.
  --
  -- NÃO usa app.tenant_operacional() de propósito: aquela função tem
  -- `coalesce(..., true)` e responde OPERACIONAL para escola ausente.
  -- Aqui a ausência NEGA — é metade do defeito que estamos fechando.
  --
  -- O super admin passa por regra explícita, como já acontece nas duas
  -- checagens acima: ele opera sobre qualquer escola por desenho, e o
  -- backoffice é justamente o lugar de onde se mexe numa escola
  -- suspensa.
  if not app.eh_super_admin() then
    select e.status into v_status from escolas e where e.id = v_escola;

    -- `not found` cobre o token com escola_id inexistente. Mensagem
    -- deliberadamente IGUAL à de escola suspensa: a coordenação não
    -- precisa saber qual dos dois é, e a diferença só interessa a quem
    -- estiver sondando o banco.
    if not found or v_status in ('suspensa', 'cancelada') then
      raise exception
        'abertura de ciclo bloqueada: a escola não está com acesso ativo. '
        'Fale com o suporte do Triliva para regularizar.';
    end if;
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
  '0051/0052: porta da coordenação para abrir o próximo ciclo — a ação que '
  'ResumoResponsavel.jsx já prometia ao responsável. Move só alunos da '
  'própria escola e só os que já encerraram o ciclo. O histórico fica '
  'na edição anterior, intacto. 0052: nega quando a escola do caller '
  'está suspensa, cancelada ou não é encontrada — a checagem é no corpo '
  'porque SECURITY DEFINER com dono BYPASSRLS não avalia RLS.';

-- ------------------------------------------------------------
-- ROLLBACK (manual): reaplicar 0051_proxima_edicao_trilha.sql devolve
-- as duas funções à versão sem estas travas. Como a 0052 não cria
-- tabela, coluna nem dado, não há mais nada a desfazer.
--
-- O que o rollback NÃO desfaz, igual à 0051: edições já criadas e
-- alunos já migrados continuam onde estão. Ver docs/e1-migrations.md,
-- Bloco 5.
-- ------------------------------------------------------------
