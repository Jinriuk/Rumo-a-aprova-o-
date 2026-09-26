# Manter o banco de produção acordado

Workflow: `.github/workflows/manter-banco-acordado.yml`

## O problema

Projeto no plano **free** do Supabase é **pausado após 7 dias sem atividade de
API**, e acordar leva dezenas de segundos. Durante a prospecção o sistema passa
dias sem ninguém entrar — então quem paga a espera é justamente o primeiro
prospecto a abrir o sistema na semana.

Decisão de negócio registrada: fica no free durante a prospecção; o Pro entra
quando houver receita. Este workflow é o seguro para essa decisão, não um
substituto dela.

## O que ele faz

Um `GET` diário em `/rest/v1/concursos?select=id&limit=1` com a chave anon.

A tabela `concursos` tem `GRANT SELECT` para `anon`, mas RLS ligada e **nenhuma
policy** para esse papel. Resultado: **200 com lista vazia**. A consulta chega
ao Postgres (o plano roda, a policy é avaliada) e nenhum dado sai. É a batida
mais barata que ainda conta como atividade real.

`pg_cron` **não serve** para isso: o contador de inatividade do Supabase olha
requisição de API, não trabalho interno do banco. A batida precisa vir de fora.

## Configuração

Em **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
|---|---|
| `PROD_SUPABASE_URL` | `https://<ref-de-producao>.supabase.co` |
| `PROD_SUPABASE_ANON_KEY` | a chave anon do projeto de **produção** |
| `DEMO_SUPABASE_URL` | `https://<ref-do-demo>.supabase.co` |
| `DEMO_SUPABASE_ANON_KEY` | a chave anon do projeto de **demo** (vitrine) |

Sem o par de um ambiente, o passo daquele ambiente **reprova** com `exit 1` e
um `::error::FALTA CONFIGURAÇÃO`, e o workflow fica vermelho. Secret ausente é
o seguro desligado, e seguro desligado é falha.

Até a Etapa 4 esse caminho saía com `exit 0` e um `::warning::PULADO`. O
resultado foi dez execuções verdes sem nenhum `curl` (`docs/e0-baseline.md`,
Bloco 3): o aviso só aparecia dentro do log, e ninguém abre log de execução
verde. Os quatro secrets existem desde 25/09 (run `36133379313`, HTTP 200 nos
dois passos).

Um ambiente sem secret não impede a batida do outro: o passo do demo tem
`if: always()` e roda mesmo com o de produção reprovado.

A chave anon é publicável por design (ela já viaja no bundle para todo
visitante; a segurança é a RLS). Está como secret só para não aparecer no log.

## ⚠️ O prazo de validade deste seguro

O GitHub **desativa automaticamente workflows agendados após 60 dias sem
atividade no repositório** — e não avisa. Ou seja: se o projeto ficar dois meses
parado, o seguro para de rodar exatamente quando seria mais necessário.

Se houver um período longo sem commits, entre em **Actions → Manter banco
acordado** e reative o workflow à mão, ou rode uma vez pelo **Run workflow**.

## Cadência

Diário, às 06:17 UTC. O plano original previa a cada 3 dias; ficou diário porque
o GitHub avisa que execuções agendadas podem **atrasar** em períodos de carga
alta. Com uma por dia sobram 7 chances dentro da janela de 7 dias; a cada 3
dias sobrariam 2, e duas falhas seguidas já deixariam pausar.

O minuto é quebrado de propósito: o topo da hora é o horário mais disputado e
o que mais sofre atraso.

## Quando remover

Quando o projeto de produção subir para um plano pago. Aí não há mais pause por
inatividade e este workflow vira ruído.
