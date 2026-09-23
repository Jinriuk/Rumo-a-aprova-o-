# Instituto Meridiano: a demonstração que não envelhece

**Onde vive:** só no projeto de demonstração (`bdjkgrzfzoamchdpobbl`, www.trilivaedu.com.br).
**Tenant:** Instituto Meridiano, `dddddddd-dddd-4ddd-8ddd-dddddddddddd`, `plano = 'demo'`.
**Código:** `supabase/demo/` (fora de `supabase/migrations`: nada daqui roda em produção nem no CI).
**Ligado em:** 23/09/2026.

---

## 1. A história que a demonstração conta

É sempre a **semana 4 de 9** do "Bloco intensivo de 9 semanas · ciclo 2026" (Colégio Naval):
"Geometria pesada + sistemas", Simulado 2. As semanas 1 a 3 ficam no passado. As 5 a 9 ainda
não começaram. Duas turmas, oito alunos, todos fictícios.

| Aluno | Turma | Papel na história | Semana 4 (sábado) | Ciclo | XP sáb. / seg. |
|---|---|---|---|---|---|
| **Helena Vasconcelos** | manhã | A aluna "no caminho": estuda quase todo dia, acerto bom, meta quase fechada. Única com responsável vinculado e com onboarding preenchido: é a aluna das telas do aluno e do responsável. | 5/7 atividades · 79 questões · 4h03m · 4 dias · 78% | 378 q · 77,8% | 1.720 / 1.210 (3º Sargento nos dois) |
| **Camila Restrepo** | tarde | A melhor da tarde: volume e acerto altos. | 5/7 · 58 q · 72% · 3 dias | 288 q · 71,2% | 1.720 / 1.210 |
| **Rafael Munhoz** | manhã | Regular, fecha o pódio de acerto em 7 dias (69%, 59 questões). | 4/7 · 59 q · 69% · 3 dias | 304 q · 65,1% | 1.560 / 1.110 |
| **Gustavo Peçanha** | tarde | Estudou só um dia na semana (18 questões): é o caso que o pódio do painel e o do Ranking tratavam diferente (D05). | 3/7 · 18 q · 72% · 1 dia | 222 q · 62,6% | 1.260 / 910 |
| **Beatriz Okamoto** | manhã | Pouco volume, dois dias na semana. | 2/7 · 29 q · 62% · 2 dias | 144 q · 58,3% | 1.060 / 810 |
| **Thiago Albuquerque** | manhã | Estuda, mas acerta pouco: o caso de "matérias para reforçar". | 3/7 · 33 q · 42% · 2 dias | 198 q · 48,0% | 1.160 / 810 |
| **Larissa Fontoura** | manhã | **Sem atividade**: último registro na semana 2. Tem credencial e consentimento; parou. | 0/7 · 0 q | 117 q · 55,6% | 800 / 800 |
| **Enzo Bandeira** | tarde | **Sem credencial, sem consentimento, sem atividade.** Nunca acessou. Por isso não tem registro, simulado nem XP (D07). | 0/7 · 0 q | 0 q | 0 / 0 |

**Painel da coordenação no sábado:** 6 ativos na semana, 276 questões em 7 dias. Alertas: 2 sem
atividade (Larissa e Enzo), 1 sem credencial (Enzo), 8 com pendências da semana. Turma da tarde:
510 questões no ciclo.

**Consentimentos:** 7 de 8 (todos menos o Enzo). O mecanismo não toca em `consentimentos` nem em
`logs_acesso`. São registros de auditoria: os acessos reais feitos durante as demonstrações ficam
na trilha de acesso. Dado de demonstração pode ter `aceito_em` retroativo. Quando o N02 for
aprovado, `registrado_em` passa a guardar o momento real da gravação.

## 2. Como a semana se repete

A gravação é uma fotografia do Meridiano em 23/09/2026, depois do D07/D09. Descontados o D07 (Enzo
sem registro e sem simulados) e o D09 (os 5 registros de 22/08 passaram para 24/08), o estado é o
das capturas de 19/09. A semana 5, que a virada global gerou em 21/09, ficou de fora. Cada linha guarda o dia **relativo** à segunda-feira da semana 4 (14/09): `dia = -21` é a
segunda da semana 1, `dia = 4` é a sexta da semana 4.

| Quando (Brasília) | Job (UTC) | O que acontece |
|---|---|---|
| **Segunda 00:00** | `demo-virada-semanal` · `0 3 * * 1` | `demo.virar_semana()`. Apaga o dinâmico do Meridiano: registros, simulados, metas, atividades, eventos de XP, níveis e missões. Re-ancora as 9 semanas com a semana 4 começando hoje e reinsere a gravação. Tudo o que tem data de hoje em diante vai para `demo.fila`. |
| Segunda 00:05 | `virar-semana-diaria` · `5 3 * * *` (global, já existia) | Encontra a meta da semana 4 já criada e não gera nada para o Meridiano. |
| **Todo dia 00:10** | `demo-liberacao-diaria` · `10 3 * * *` | `demo.liberar()`. Move da fila para o produto o que vence até hoje, ou seja, o que a gravação data de ontem. |

Consequências, dia a dia:

- **Sábado depois das 00:10** (e domingo): os números são os das capturas de 19/09 (tabela acima).
- **Nos outros dias**: os números de 19/09 até a véspera. O registro de segunda aparece na terça
  às 00:10, e assim por diante.
- **Segunda-feira**: a semana corrente começa sem registros. O painel de 7 dias mostra a semana
  anterior (a semana 3 da gravação).
- **Atividades concluídas**: o seed original gravou as 89 conclusões com o mesmo instante
  (18/09 17:39:20 UTC). Reproduzir esse carimbo deixaria a Helena em 0/7 de segunda a sexta,
  estudando todo dia. Cada conclusão vai para o **primeiro dia da semana em que o aluno registrou
  a mesma matéria**. Sem isso, vai para o último dia com registro na semana; sem registro, para a
  sexta. Aparece no dia seguinte, como o resto. Helena: 0/7 na segunda, 2/7 na terça, 4/7 de
  quarta a sexta, 5/7 no sábado.
- **XP**: não cresce de uma semana para a outra (V6 é o mesmo em sábados seguidos). Mas **volta
  na segunda**: a Helena tem 1.720 no sábado e 1.210 na segunda, porque as conclusões e o
  Simulado 2 da semana 4 voltam para a fila. Rafael (1.110 → 1.560) e Gustavo (910 → 1.260)
  passam de Cabo a 3º Sargento durante a semana e voltam a Cabo na segunda. Isso é a semana se
  repetindo, não um defeito. Para mostrar patente estável, apresente do meio da semana em diante.

### Gatilhos: por que "reprodução" e não "recálculo"

A virada e a liberação rodam com `session_replication_role = replica`. Isso desliga os gatilhos
de usuário só naquela transação: nenhuma outra sessão, de nenhum tenant, é afetada. Os eventos de
XP e os níveis vêm da gravação, com os mesmos ids.

Por que não "recálculo" (gatilhos ligados)? O XP até ficaria estável, porque a virada apaga todos
os eventos do Meridiano antes de reinserir, e o teste confirmou isso. O problema está em outros
dois pontos:

1. Cada rodada gera eventos com id e `criado_em` novos. A mesma data deixa de dar o mesmo estado,
   e rodar duas vezes deixa de ser idempotente. Com o `replica` removido, os testes de
   equivalência e de idempotência de `tests/bloco1-demo-semana-repetida-db.test.mjs` falham.
2. O motor PED1 (`trg_ped1_registro`) recalcula os níveis por matéria a partir de dados parciais
   a cada reinserção. O histórico de níveis ganharia uma linha a cada mudança, semana após semana.
   Isso vem da leitura do código de `app.motor_avaliar_aluno`, não de teste.

Detalhes que valem para quem mexer:

- `replica` também desliga FKs e `ON DELETE CASCADE`. As funções apagam filhos antes dos pais e
  todo insert faz join com os alunos do Meridiano.
- No Supabase, `set_config('session_replication_role', …)` é recusado. Só o comando `SET` passa
  (supautils), por isso o `EXECUTE 'set local …'`. Testado no pg_cron em 23/09.
- Se alguém usar a demonstração ao vivo (registrar estudo, concluir atividade), vale até a próxima
  segunda. A liberação não passa por cima: só conclui atividade que ainda está `pendente`, e o XP
  de uma conclusão feita ao vivo não duplica (chave de idempotência).

### Guardas (regra 3 do documento)

Toda função que escreve começa por `demo.checar_tenant()`, que aborta se:

- a escola `dddddddd-…` não existir ou não tiver `plano = 'demo'`;
- algum aluno ou meta de **outro** tenant usar a trilha `dddddddd-0000-…-000000000001`
  (`trilha_semanas` não tem `escola_id`; re-ancorar mexeria nele).

Todo `delete`/`insert` é filtrado por `escola_id = demo.escola()`. O schema `demo` fica fora do
fingerprint (`scripts/fingerprint-schema.sql` só mede `public` e `app`) e fora da API
(o PostgREST só expõe `public`). `anon` e `authenticated` não têm `USAGE` nem `EXECUTE` nele.

## 3. Operação

Tudo abaixo roda no SQL editor do projeto de demonstração, como `postgres`.

**A demonstração está viva?**

```sql
-- V1 e V6 de supabase/demo/00_verificacoes.sql, mais:
select * from demo.estado;                                    -- âncora = segunda desta semana
select acao, hoje, detalhe, executado_em from demo.execucoes order by id desc limit 5;
select j.jobname, d.status, d.start_time, d.return_message
  from cron.job_run_details d join cron.job j using (jobid)
 where j.jobname like 'demo-%' order by d.start_time desc limit 5;
```

**Antes de uma reunião, se algo parecer errado (o paliativo):** `select demo.virar_semana();`
(`06_ativar.sql`). É idempotente e pode rodar no meio da semana.

**Pausar** (o Meridiano volta a envelhecer; na segunda seguinte a virada global fecha a semana 4 e
gera a 5): `91_desligar.sql`, que remove os dois jobs e chama `demo.pausar(true)`.
**Retomar:** `select demo.pausar(false);`, depois `06_ativar.sql` e `07_agendamento.sql`.

**Restaurar o backup de 23/09** (desfaz o mecanismo **e** o D07/D09: o Enzo volta a ter 1
registro, 2 simulados e 100 XP; a semana 1 volta a ter 9 dias): `90_restaurar_backup_20260923.sql`.
Ensaiado com rollback em 23/09: devolve as 9 tabelas linha a linha.

**Regravar** (mudar a história): pausar, editar os dados do Meridiano como deseja que a semana 4
fique, garantir que a semana 4 da trilha comece na segunda usada como âncora, rodar
`select demo.gravar(date 'AAAA-MM-DD');` com essa segunda e religar. A gravação é trocada inteira;
a função recusa âncora que não seja segunda ou que não coincida com o início de uma semana.

## 4. Arquivos

| Arquivo | O quê | Rodou em |
|---|---|---|
| `00_verificacoes.sql` | V1 a V9 (janela do produto) e V9b (md5 por tenant). Só leitura. | a cada escrita |
| `01_schema.sql` | Schema `demo`: estado, execuções, fila, gravação. | 23/09 |
| `02_backup_20260923.sql` | Backup do dinâmico do Meridiano antes de tudo. | 23/09 |
| `03_d07_d09.sql` | D07 (Enzo) e D09 (semanas de segunda a domingo). | 23/09 |
| `04_funcoes.sql` | `gravar`, `virar_semana`, `liberar`, `pausar`, guardas. | 23/09 |
| `05_gravar_semana4.sql` | `demo.gravar('2026-09-14')`. | 23/09 |
| `06_ativar.sql` | Liga agora / paliativo manual. | 23/09 |
| `07_agendamento.sql` | Os dois jobs do pg_cron. | 23/09 |
| `90_restaurar_backup_20260923.sql` | Rollback completo. | ensaiado |
| `91_desligar.sql` | Desliga sem desfazer dados. | · |
