-- ============================================================
-- DEMO 00 — consultas de verificação (SOMENTE LEITURA)
-- ------------------------------------------------------------
-- As V1 a V9 do documento de 23/09/2026, com um ajuste de janela:
-- o produto conta "7 dias" como [app.hoje_local() - 6, hoje], em
-- America/Sao_Paulo (public.resumo_escola, migration 0016). O
-- documento usava current_date, que é a data UTC do servidor e vira
-- o dia às 21:00 de Brasília. Aqui vale a janela do produto.
--
-- V6 também mudou: a view vw_aluno_xp_total só tem linha para aluno
-- com evento, então aluno sem XP (o Enzo, depois do D07) sumia da
-- lista em vez de aparecer com 0. O left join a partir de alunos
-- mostra o 0.
--
-- V9b é nova: a V9 só compara contagens, e contagem igual não prova
-- que nenhuma linha mudou. A V9b tira um md5 do conteúdo de cada
-- tabela tocada pelo mecanismo, por tenant. Rode as duas antes e
-- depois de toda escrita.
-- ============================================================

-- V1 · A demonstração está viva? (janela do produto)
select max(data) as ultimo_registro,
       count(distinct aluno_id) filter (where data >= app.hoje_local() - 6) as ativos_7d,
       coalesce(sum(questoes) filter (where data >= app.hoje_local() - 6), 0) as questoes_7d
from registros_estudo
where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

-- V2 · As quatro versões do "acerto médio" (D04)
with r as (
  select aluno_id,
         sum(acertos)::numeric a, sum(questoes)::numeric q,
         sum(acertos)  filter (where data >= app.hoje_local() - 6)::numeric a7,
         sum(questoes) filter (where data >= app.hoje_local() - 6)::numeric q7
  from registros_estudo
  where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  group by aluno_id)
select round(100 * avg(a / nullif(q, 0)), 1)        as simples_ciclo,
       round(100 * sum(a) / nullif(sum(q), 0), 1)   as ponderado_ciclo,
       round(100 * avg(a7 / nullif(q7, 0)), 1)      as simples_7d,
       round(100 * sum(a7) / nullif(sum(q7), 0), 1) as ponderado_7d
from r;

-- V3 · Coerência por aluno: credencial, consentimento e atividade (D01, D07)
-- "sem credencial" no produto é usuario_id nulo (adaptarResumoEscola);
-- status_provisionamento é NOT NULL e vale 'ok' para os 8.
select a.nome, a.status_provisionamento, a.usuario_id is not null as tem_credencial,
       exists (select 1 from consentimentos c where c.aluno_id = a.id) as tem_consentimento,
       (select count(*) from registros_estudo r where r.aluno_id = a.id) as registros,
       (select coalesce(sum(r.questoes), 0) from registros_estudo r where r.aluno_id = a.id) as questoes,
       (select count(*) from simulados s where s.aluno_id = a.id) as simulados
from alunos a
where a.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
order by a.nome;

-- V4 · Duração das semanas da trilha (D09)
select numero, inicio, fim, fim - inicio + 1 as dias, extract(isodow from inicio) as dia_da_semana_inicio
from trilha_semanas
where trilha_id = 'dddddddd-0000-4000-8000-000000000001'
order by numero;

-- V5 · Acerto da Helena: semana corrente × ciclo (D15)
select round(100.0 * sum(r.acertos)  filter (where r.data between ts.inicio and ts.fim)
            / nullif(sum(r.questoes) filter (where r.data between ts.inicio and ts.fim), 0), 1) as semana,
       round(100.0 * sum(r.acertos) / nullif(sum(r.questoes), 0), 1) as ciclo
from registros_estudo r
join alunos a on a.id = r.aluno_id
join trilha_semanas ts on ts.trilha_id = a.trilha_id and app.hoje_local() between ts.inicio and ts.fim
where a.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and a.nome ilike 'Helena%';

-- V6 · XP por aluno (nunca cai; de um sábado para o seguinte sobe exatamente o ganho da semana gravada)
select a.nome, coalesce(sum(v.xp_total), 0) as xp_total
from alunos a
left join vw_aluno_xp_total v on v.aluno_id = a.id
where a.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
group by a.nome
order by a.nome;

-- V7 · Consentimentos (D01)
select count(*) as consentimentos,
       count(distinct aluno_id) as alunos_com_consentimento,
       (select count(*) from alunos where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') as alunos
from consentimentos
where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

-- V8 · Papéis gravados na trilha de acesso (D10)
select papel, count(*) from logs_acesso
where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
group by papel;

-- V9 · Isolamento: estas contagens não podem mudar (rode antes e depois de cada escrita)
select e.nome,
       (select count(*) from registros_estudo r where r.escola_id = e.id) as registros,
       (select count(*) from metas m where m.escola_id = e.id) as metas,
       (select count(*) from simulados s where s.escola_id = e.id) as simulados,
       (select count(*) from consentimentos c where c.escola_id = e.id) as consentimentos
from escolas e
where e.id <> 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
order by e.nome;

-- V9b · Isolamento por conteúdo: md5 de cada tabela tocada, por tenant.
-- Atenção ao ler: a virada global (cron virar-semana-diaria, 03:05 UTC)
-- gera metas novas para as outras escolas toda segunda. Compare
-- antes/depois da MESMA escrita, não de dias diferentes.
select e.nome,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from registros_estudo x where x.escola_id = e.id) as registros,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from simulados x where x.escola_id = e.id) as simulados,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from metas x where x.escola_id = e.id) as metas,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from meta_atividades x where x.escola_id = e.id) as meta_atividades,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from aluno_eventos_progresso x where x.escola_id = e.id) as eventos,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from aluno_niveis x where x.escola_id = e.id) as niveis,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from aluno_nivel_historico x where x.escola_id = e.id) as nivel_historico,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from aluno_missoes x where x.escola_id = e.id) as missoes,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from consentimentos x where x.escola_id = e.id) as consentimentos,
  (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from logs_acesso x where x.escola_id = e.id) as logs_acesso
from escolas e
where e.id <> 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
union all
select '(trilhas de outros tenants)',
  (select md5(string_agg(x::text, '|' order by x.id)) from trilha_semanas x where x.trilha_id <> 'dddddddd-0000-4000-8000-000000000001'),
  null, null, null, null, null, null, null, null, null
order by 1;
