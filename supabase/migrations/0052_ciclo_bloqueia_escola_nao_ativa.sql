-- ============================================================
-- 0052 — CICLO NÃO ABRE PARA ESCOLA SEM ACESSO ATIVO
-- ------------------------------------------------------------
-- O ensaio da Etapa 1 (docs/e1-migrations.md) aplicou a 0051 em banco
-- local descartável e mediu: uma escola SUSPENSA abria ciclo e migrava
-- alunos igual a uma escola ativa. Mesmo cenário, única variável o
-- `status`:
--   escola 'ativa'    → {"alunos_movidos": 1}
--   escola 'suspensa' → {"alunos_movidos": 1}
--
-- Isto não é defeito da 0051 como migration — é da função que ela cria,
-- e não desaparece por não aplicar a 0051. Esta migration fecha o furo
-- com `create or replace`, preservando todo o resto do corpo. A 0051
-- continua sendo o registro de como o motor nasceu.
--
-- POR QUE A RLS NÃO SEGUROU
-- A policy existe e está correta:
--   alunos_update USING (escola_id = app.tenant_id()
--                        AND app.papel() = 'coordenacao'
--                        AND app.tenant_operacional())
-- Mas `public.abrir_proximo_ciclo` é SECURITY DEFINER, e o dono das
-- funções (`postgres`) tem rolbypassrls = true nos DOIS ambientes
-- hospedados — confirmado por leitura direta em bdjkgrzfzoamchdpobbl e
-- zckyhihxjjbnqjqilymn, e de forma independente pela sessão de gestão.
-- Dentro de uma SECURITY DEFINER dessas a RLS não avalia nada. Depender
-- dela para autorizar é depender de algo que não roda.
--
-- POR QUE NÃO USAR app.tenant_operacional() AQUI
-- Porque ela tem o fallback invertido (C-S04 da auditoria):
--   select coalesce(
--     (select e.status not in ('suspensa','cancelada')
--        from escolas e where e.id = app.tenant_id()),
--     true)
-- O `coalesce(..., true)` responde OPERACIONAL quando a escola não é
-- encontrada. Um token com escola_id inexistente passa. Medido no
-- ensaio, lado a lado: para esse token, `tenant_operacional()` devolve
-- `t` e a checagem abaixo NEGA.
--
-- Corrigir a própria `tenant_operacional` está FORA de escopo de
-- propósito: ela serve policies de várias tabelas, e inverter o default
-- pode derrubar fluxo legítimo que este ensaio não cobriu. Etapa 2.
--
-- O QUE ESTA MIGRATION FAZ: lê `escolas.status` no CORPO da função,
-- direto, e NEGA em três casos — 'suspensa', 'cancelada' e escola não
-- encontrada. Negar por ausência é o ponto inteiro.
--
-- ------------------------------------------------------------
-- O QUE ESTA MIGRATION *NÃO* FAZ, e por quê
--
-- O mesmo ensaio achou um segundo problema — a EDIÇÃO ÓRFÃ: a edição é
-- criada antes de se saber se algum aluno será movido, então errar a
-- âncora em um dia deixa uma trilha completa com zero alunos, e a tela
-- da coordenação não tem como apagá-la.
--
-- Uma trava de banco para isso foi escrita, ensaiada e DESCARTADA na
-- revisão, por um motivo que só aparece olhando o schema: `trilhas` não
-- tem `escola_id` (ver 0001_fundacao.sql:106-114 — id, nicho, nome,
-- versao, publicada, criada_em). É catálogo GLOBAL por nicho,
-- compartilhado entre escolas. No demo, o nicho `colegio-naval` é usado
-- por três escolas ao mesmo tempo.
--
-- Qualquer trava que filtre por `nicho` e conte alunos sem recorte de
-- escola é cross-tenant. A escola A abriria ciclo sem passar p_alunos
-- (uso previsto — o default é null), deixaria a edição sem alunos, e a
-- escola B passaria a ser RECUSADA ao abrir o ciclo dela, citando uma
-- edição que não é dela, que ela não pode vincular nem apagar. Só o
-- super admin destravaria. E a mensagem de erro vazaria nome, versão e
-- data de fim de uma edição de outro tenant.
--
-- Vale reparar que os dois blocos desta função assumem modelos opostos:
-- o de idempotência (logo abaixo) reusa DELIBERADAMENTE a edição de
-- qualquer origem que termine na âncora, tratando o catálogo como
-- compartilhado — que é o que ele é. Uma trava de posse contradiria o
-- bloco que vem imediatamente antes dela.
--
-- A edição órfã fica registrada como PROBLEMA CONHECIDO, não resolvido
-- no banco, em docs/e1-migrations.md. As duas saídas possíveis (aviso
-- na interface, ou `criada_por_escola` em `trilhas` como mudança de
-- modelo) estão descritas lá; a segunda é decisão de produto e não está
-- autorizada.
-- ============================================================

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
  -- ambientes, então a RLS não é avaliada e `alunos_update` nunca roda.
  -- Ver o cabeçalho desta migration.
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
-- a função à versão sem esta trava. Como a 0052 não cria tabela, coluna
-- nem dado, e não toca `app.abrir_proximo_ciclo`, não há mais nada a
-- desfazer.
--
-- O que o rollback NÃO desfaz, igual à 0051: edições já criadas e
-- alunos já migrados continuam onde estão. Ver docs/e1-migrations.md,
-- Bloco 5.
-- ------------------------------------------------------------
