-- ============================================================
-- 0049 — estado do CICLO DE ESTUDO, explícito (A1 / A3, Onda 3)
-- ------------------------------------------------------------
-- O PROBLEMA, medido no demo em 13/09/2026:
--   • 547 metas, semanas 1 a 9, TODAS `fechada`. Zero `ativa`.
--   • toda virada desde 01/08 registra 0 fechadas, 0 geradas, 0 erros.
--   • 63 alunos veem "MISSÃO 9, ATRASADA" em vermelho há 43 dias.
--
-- A CAUSA está em app.semana_da_data (0003, linha 40):
--
--     select * into s from trilha_semanas
--       where trilha_id = p_trilha order by numero desc limit 1;
--     return s;   -- depois da última: vale a última
--
-- Passado o fim da trilha ela devolve a última semana PARA SEMPRE.
-- gerar_meta_protegida então encontra a meta daquela semana já criada,
-- responde 'ja_tinha', e nenhuma meta nova nasce nunca mais. O motor
-- roda todo dia produzindo nada, e `alunos_com_erro = 0` é LEGITIMAMENTE
-- zero — por isso o heartbeat (0043) marca verde sobre um motor morto.
-- 'ja_tinha' é uma resposta verdadeira que comunica a coisa errada.
--
-- A DECISÃO: `semana_da_data` NÃO MUDA. O clamp da PRIMEIRA semana
-- (data antes do início → vale a 1ª) é comportamento correto e tem
-- outros chamadores; mexer nela para consertar o outro lado é risco
-- desnecessário. Em vez disso, uma função nova responde a pergunta que
-- nenhuma camada sabia fazer: em que ponto do ciclo esta data está?
--
-- ESCOPO DELIBERADO — isto é o CICLO DE ESTUDO, não a data da prova.
-- São coisas diferentes, e confundi-las foi o erro da primeira versão
-- do desenho desta onda. Medido: os 63 alunos do demo dividem UMA
-- trilha que acaba em 01/08 e prestam CINCO provas distintas —
-- CN 01/08, EPCAR 28/06, EsPCEx 28/09, EsSA 01/10, EEAr 16/11.
-- Tratar o fim da trilha como data de prova diria "prova realizada"
-- para 14 alunos da EsPCEx com a prova ainda a 58 dias. A data da
-- prova vive em alunos.data_prova_alvo (com a média do concurso como
-- fallback) e é resolvida no front; aqui só existe o plano de estudo.
--
-- Aditiva. Idempotente. Não altera dado. Não toca 0001–0048.
-- ============================================================

-- ------------------------------------------------------------
-- 1) estado_ciclo — a pergunta que faltava
-- ------------------------------------------------------------
-- Devolve o ponto do ciclo e a semana correspondente:
--   'antes'      → a trilha ainda não começou (semana = a 1ª)
--   'em_curso'   → a data cai dentro de uma semana (semana = ela)
--   'encerrado'  → passou da última semana (semana_numero = NULL)
--
-- `sem_semanas` é o quarto caso e existe de propósito: trilha sem
-- nenhuma semana é dado quebrado, e semana_da_data levanta exceção
-- nesse caso. Aqui ele vira um estado nomeado em vez de um erro, para
-- o chamador poder distinguir "trilha vazia" de "ciclo acabou" — são
-- situações opostas que o clamp antigo tornava indistinguíveis.
create or replace function app.estado_ciclo(
  p_trilha uuid, p_data date default null,
  out estado text, out semana_numero int
)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_data    date := coalesce(p_data, app.hoje_local());
  v_primeira trilha_semanas;
  v_ultima   trilha_semanas;
  v_corrente trilha_semanas;
begin
  select * into v_primeira from trilha_semanas
    where trilha_id = p_trilha order by numero asc limit 1;
  if not found then
    estado := 'sem_semanas'; semana_numero := null; return;
  end if;

  select * into v_ultima from trilha_semanas
    where trilha_id = p_trilha order by numero desc limit 1;

  if v_data < v_primeira.inicio then
    estado := 'antes'; semana_numero := v_primeira.numero; return;
  end if;

  if v_data > v_ultima.fim then
    estado := 'encerrado'; semana_numero := null; return;
  end if;

  -- dentro do intervalo da trilha: acha a semana que cobre a data.
  -- Buraco entre semanas (calendário com lacuna) não é 'encerrado' —
  -- o ciclo segue correndo, só não há semana para esta data.
  select * into v_corrente from trilha_semanas
    where trilha_id = p_trilha and inicio <= v_data and fim >= v_data
    order by numero limit 1;
  estado := 'em_curso';
  semana_numero := v_corrente.numero;  -- NULL se a data caiu numa lacuna
end $$;

revoke all on function app.estado_ciclo(uuid, date) from public, authenticated, anon;
grant execute on function app.estado_ciclo(uuid, date) to service_role;

comment on function app.estado_ciclo(uuid, date) is
  'Ponto do ciclo de ESTUDO de uma trilha numa data: antes | em_curso | '
  'encerrado | sem_semanas. Não é a data da prova (essa vive em '
  'alunos.data_prova_alvo). Criada na Onda 3 porque semana_da_data '
  'devolve a última semana para sempre depois do fim, tornando o fim do '
  'ciclo inexprimível — ver o cabeçalho da 0049.';

-- ------------------------------------------------------------
-- 2) gerar_meta_protegida deixa de mentir por omissão
-- ------------------------------------------------------------
-- Antes: ciclo encerrado devolvia 'ja_tinha', indistinguível de "a meta
-- desta semana já foi criada hoje de manhã". Agora devolve
-- 'ciclo_encerrado', que é o que o heartbeat (A2, Onda 7) precisa para
-- separar "não gerou porque acabou" de "não gerou porque quebrou".
--
-- 'sem_semanas' também sai nomeado: antes virava 'erro' com a mensagem
-- crua da exceção de semana_da_data.
--
-- A assinatura (OUT resultado, OUT erro) NÃO muda — app.virar_semana
-- (0039) compara com 'gerada' e 'erro' e continua correta: os dois
-- valores novos não são nem um nem outro, e caem no ramo neutro, que é
-- exatamente o comportamento desejado (nada gerado, nada quebrado).
create or replace function app.gerar_meta_protegida(
  p_aluno uuid, p_trilha uuid, p_hoje date, out resultado text, out erro text
)
language plpgsql security definer set search_path = public, app as $$
declare
  v_estado  text;
  v_semana  int;
begin
  select e.estado, e.semana_numero into v_estado, v_semana
    from app.estado_ciclo(p_trilha, p_hoje) e;

  -- Trilha sem semanas continua sendo ERRO, com a mesma mensagem de
  -- antes. NÃO uniformize com 'ciclo_encerrado': são situações opostas.
  -- Ciclo encerrado é o curso tendo cumprido seu ciclo; trilha vazia é
  -- configuração quebrada que alguém precisa arrumar, e o contrato de
  -- erro é o que faz `virar_semana` contá-la em alunos_com_erro e o
  -- heartbeat (0043) ficar vermelho por causa dela.
  --
  -- Na primeira versão desta migration eu havia devolvido 'sem_semanas'
  -- aqui, achando que nomear era melhor que errar. Três testes
  -- pré-existentes quebraram e estavam certos: aquilo desligava um
  -- alarme que já funcionava. `estado_ciclo` continua distinguindo o
  -- caso (é informação legítima naquela camada); o que não pode é a
  -- distinção rebaixar a severidade aqui.
  if v_estado = 'sem_semanas' then
    resultado := 'erro';
    erro := format('trilha %s sem semanas', p_trilha);
    return;
  end if;

  if v_estado = 'encerrado' then
    resultado := 'ciclo_encerrado';
    return;
  end if;

  -- lacuna no calendário: sem semana para hoje, e sem meta a gerar.
  -- Não é erro e não é fim de ciclo.
  if v_semana is null then
    resultado := 'sem_semana_hoje';
    return;
  end if;

  if exists (
    select 1 from metas m
    where m.aluno_id = p_aluno and m.trilha_id = p_trilha
      and m.semana_numero = v_semana
  ) then
    resultado := 'ja_tinha';
    return;
  end if;

  perform app.gerar_meta(p_aluno, p_hoje);
  resultado := 'gerada';
exception when others then
  resultado := 'erro';
  erro := sqlerrm;
end $$;

revoke all on function app.gerar_meta_protegida(uuid, uuid, date) from public, authenticated, anon;
grant execute on function app.gerar_meta_protegida(uuid, uuid, date) to service_role;

-- ------------------------------------------------------------
-- ROLLBACK (manual): reaplicar o corpo da 0039 em
-- app.gerar_meta_protegida e `drop function app.estado_ciclo(uuid, date)`.
-- Nada de dado muda, então o rollback é só de código.
-- ------------------------------------------------------------
