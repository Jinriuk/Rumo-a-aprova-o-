-- ============================================================
-- 0050 — A2: a saúde da virada passa a olhar RESULTADO, não só erro
-- ------------------------------------------------------------
-- A 0043 criou app.virada_saude() lendo o heartbeat da 0039. A
-- condição de ok era:
--
--     (v.alunos_com_erro = 0 and v_horas <= p_janela_horas)
--
-- `metas_geradas` era devolvido e NUNCA testado. Quer dizer: uma virada
-- que rodou no horário e não errou em ninguém reporta ok=true mesmo
-- tendo gerado zero meta. Os dois sinais existentes medem a ÚLTIMA
-- EXECUÇÃO ("rodou? explodiu em alguém?") e nenhum mede o ESTADO que a
-- execução deveria ter produzido ("tem aluno sem meta aberta?").
--
-- O que a medição no demo mostrou (17/09/2026), e que corrige o
-- catálogo: o motor NÃO está quebrado. Nas 49 execuções registradas
-- desde 16/07, `alunos_com_erro` foi 0 em TODAS, e as 2 viradas de
-- semana que caíram dentro da janela do heartbeat (20/07 e 27/07)
-- geraram 63 metas cada — todos os alunos com trilha. As outras 47
-- execuções são dias de meio de semana e dias posteriores a 01/08,
-- quando a única trilha encerrou: não havia o que gerar. "2 de 49 dias
-- geraram meta" é aritmética de job semanal, não sintoma.
--
-- O defeito é outro, e é estrutural: o alerta NÃO TEM COMO ficar
-- vermelho por falta de produção. Se o motor parar de verdade no meio
-- de um ciclo, o heartbeat continua gravando linha, `alunos_com_erro`
-- continua 0 (ninguém falhou — ninguém foi processado) e o painel
-- continua verde. O demo nunca expôs isso porque nunca teve a falha.
--
-- Esta migration acrescenta o terceiro sinal, baseado em ESTADO ATUAL:
--
--     alunos_sem_meta = alunos que DEVERIAM ter meta aberta hoje e não têm
--
-- "Deveria ter" = aluno cuja trilha tem uma semana cobrindo a data
-- local de hoje. Ciclo encerrado sai sozinho dessa definição: sem
-- semana vigente, o aluno não entra na conta (mesma doutrina que a
-- Onda 5 usou no T31, sem precisar de um segundo sinal de ciclo).
-- Também ficam de fora aluno `pendente_configuracao` (0046 — ainda não
-- terminou de ser provisionado) e escola `suspensa`/`cancelada` (0025 —
-- desligada de propósito). `demo` e `piloto` CONTAM: rodam o motor de
-- verdade e precisam ser vigiadas.
--
-- Atenção à diferença de natureza, que está no comentário da função: os
-- dois sinais antigos falam da última EXECUÇÃO; o novo fala do ESTADO
-- de AGORA. Um pode estar bom e o outro ruim, e é exatamente por isso
-- que os três precisam existir.
--
-- O tipo de retorno muda (coluna nova), então DROP antes — mesma razão
-- que a 0039 documentou. `public.backoffice_virada_saude` usa
-- `to_jsonb(s)`, então a coluna nova flui sem alterar a porta.
-- Idempotente. Não altera a virada, o heartbeat nem dado nenhum.
-- ============================================================

drop function if exists app.virada_saude(int);

create function app.virada_saude(p_janela_horas int default 26)
returns table (
  ok               boolean,
  ultima_execucao  timestamptz,
  horas_desde      numeric,
  metas_geradas    int,
  alunos_com_erro  int,
  alunos_sem_meta  int,
  motivo           text
)
language plpgsql stable security definer set search_path = public, app as $$
declare
  v          virada_execucoes;
  v_horas    numeric;
  v_hoje     date := app.hoje_local();
  v_sem_meta int;
begin
  -- O invariante de RESULTADO é independente do heartbeat: vale mesmo
  -- que a virada nunca tenha executado, e é o que diz se o sistema
  -- está entregando o que promete AGORA.
  select count(*) into v_sem_meta
  from alunos a
  join escolas e        on e.id = a.escola_id
  join trilha_semanas ts on ts.trilha_id = a.trilha_id
                        and v_hoje between ts.inicio and ts.fim
  where a.status_provisionamento = 'ok'
    and e.status not in ('suspensa', 'cancelada')
    and not exists (
      select 1 from metas m
      where m.aluno_id = a.id
        and m.status = 'ativa'
        and m.semana_numero = ts.numero
    );

  -- só a virada GLOBAL (escola_id is null) é a agendada pelo cron; as
  -- por-escola são operação manual e não definem a saúde do job.
  select * into v from virada_execucoes
    where escola_id is null order by executado_em desc limit 1;

  if not found then
    return query select
      false, null::timestamptz, null::numeric, null::int, null::int, v_sem_meta,
      ('a virada nunca executou (heartbeat vazio)'
        || case when v_sem_meta > 0
                then '; ' || v_sem_meta || ' aluno(s) sem meta aberta hoje'
                else '' end)::text;
    return;
  end if;

  v_horas := round((extract(epoch from (now() - v.executado_em)) / 3600)::numeric, 1);

  return query select
    (v.alunos_com_erro = 0 and v_horas <= p_janela_horas and v_sem_meta = 0),
    v.executado_em,
    v_horas,
    v.metas_geradas,
    v.alunos_com_erro,
    v_sem_meta,
    (case
      when v.alunos_com_erro > 0
        then v.alunos_com_erro || ' aluno(s) pulados por erro na última virada'
      when v_horas > p_janela_horas
        then 'virada atrasada: última execução há ' || v_horas || ' h (janela ' || p_janela_horas || ' h)'
      when v_sem_meta > 0
        then v_sem_meta || ' aluno(s) com semana vigente e sem meta aberta'
      else 'ok'
    end)::text;
end $$;

revoke all on function app.virada_saude(int) from public, authenticated, anon;
grant execute on function app.virada_saude(int) to service_role;

comment on function app.virada_saude(int) is
  'A2 (0050): saúde da virada por três sinais. Dois sobre a última '
  'EXECUÇÃO (atraso e alunos_com_erro, do heartbeat virada_execucoes) e '
  'um sobre o ESTADO de agora (alunos_sem_meta: aluno com semana vigente '
  'e sem meta ativa). O terceiro existe porque os dois primeiros ficam '
  'verdes quando o motor simplesmente não processa ninguém.';

-- ------------------------------------------------------------
-- ROLLBACK (manual): `drop function app.virada_saude(int)` e reaplicar
-- o corpo da 0043 (sem alunos_sem_meta). Nada de dado muda — é só a
-- leitura do sinal, então o rollback é só de código.
-- ------------------------------------------------------------
