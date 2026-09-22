# Etapa 1 — Ensaio da 0051 e contrato de banco

**Data:** 21/09/2026.
**Base:** `docs/e0-baseline.md` (Etapa 0).
**Natureza:** ensaio e decisão de aplicação. Não aplica nada.

## O que esta etapa era e o que ela virou

O roadmap previa 10 a 20 horas reconciliando histórico de ledger. A Etapa 0
derrubou a aposta: os schemas de demo e produção são idênticos, os dois
remendos de ledger são operações de registro sem DDL, e sobrou uma decisão só
— como aplicar a `0051` com segurança.

## Travas respeitadas

- A `0051` **não foi aplicada** em `bdjkgrzfzoamchdpobbl` (demo) nem em
  `zckyhihxjjbnqjqilymn` (produção).
- Contra os bancos hospedados, **só leitura**: duas consultas `SELECT` a
  `pg_proc`/`pg_roles`, registradas no Bloco 2.
- Todo ensaio em **Postgres 16 local descartável** (`127.0.0.1:54322`,
  `initdb` em `/var/lib/postgresql/e1`), derrubado e apagado ao final.
  Confirmado: `pg_isready` → `no response`.
- Nenhuma migration existente foi reordenada, renomeada ou teve timestamp
  alterado.
- Nenhum valor de secret neste documento.

## Regra de evidência

Comando, saída e caminho com linha em cada afirmação. Sem evidência entra como
**NÃO VERIFICADO**.

---

# BLOCO 1 — Ensaio da 0051

Infra usada: `tests/reset-db.sh`, que é o que o CI já roda
(`.github/workflows/ci.yml`, step "Migrations + seed (2x)"). A stack Supabase
em Docker é escopo da Etapa 3 e não foi montada.

## (a) Instalação limpa — 0001 até 0051, do zero

```
$ cd tests && PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres bash reset-db.sh
EXIT: 0
migrations aplicadas: 52
última: 0051_proxima_edicao_trilha.sql
banco rumo_teste pronto (migrations + seed 2x, idempotência exercitada)
grep -iE 'erro|error|fatal|abort' → (vazio)
```

**Passou. Zero SQL manual.** O contrato final sai completo do arquivo:

```
           funcao           |                     args                      | retorno | secdef
----------------------------+----------------------------------------------+---------+--------
 app.abrir_proximo_ciclo    | p_trilha uuid, p_ancora date                 | uuid    | t
 public.abrir_proximo_ciclo | p_trilha uuid, p_ancora date, p_alunos uuid[]| jsonb   | t
```

E a suíte inteira do repositório roda verde contra esse banco:

```
$ cd tests && npm test
# tests 958   # suites 42   # pass 958   # fail 0
```

## (b) Atualização a partir do estado atual

Banco `e1_ate0050` reconstruído com **0001 até 0050** (51 arquivos — a
sequência tem dois `0047`) mais o seed, parando explicitamente antes da
`0051`:

```
>>> PARANDO antes de 0051_proxima_edicao_trilha.sql
migrations aplicadas: 51
seed aplicado
abrir_proximo_ciclo existe? → 0
escolas 2 | alunos 61 | trilhas 2 | metas 73 | registros 278
```

`abrir_proximo_ciclo` ausente é exatamente o estado que o baseline mediu em
demo e em produção. **Um ensaio serve para os dois**, e isto não é atalho: a
Etapa 0 provou paridade de schema por fingerprint de 12 categorias e,
separadamente, por `md5(prosrc)` normalizado das 63 funções. Não rodei o
ensaio duas vezes, e digo isso em vez de fingir que rodei.

Aplicando **só** a `0051`:

| | trilhas | semanas | disciplinas | atividades | metas | registros | funções |
| --- | --- | --- | --- | --- | --- | --- | --- |
| antes | 2 | 18 | 17 | 159 | 73 | 278 | 0 |
| depois | 2 | 18 | 17 | 159 | 73 | 278 | **2** |

**Passou.** A `0051` só adiciona duas funções. Não cria tabela nem coluna e
não toca uma linha de dado — consistente com o que o próprio arquivo promete
na seção ROLLBACK (`supabase/migrations/0051_proxima_edicao_trilha.sql:181-184`).

## (c) Repetição — aplicar a 0051 duas vezes

```
ANTES da 2a:  app.abrir_proximo_ciclo    oid=19125 md5corpo=a097d0bc…
              public.abrir_proximo_ciclo oid=19126 md5corpo=c49d761b…
2a aplicacao OK
DEPOIS:       funções com esse nome: 2   (não 4)
              app.abrir_proximo_ciclo    oid=19125 md5corpo=a097d0bc…
              public.abrir_proximo_ciclo oid=19126 md5corpo=c49d761b…
              trilhas 2 | semanas 18 | metas 73 | registros 278
ACL preservada: app → service_role=X | public → authenticated=X, service_role=X
```

**Passou.** Mesmos OIDs, mesmo corpo, mesma ACL, zero dado tocado. O
`create or replace` torna o arquivo idempotente por construção.

---

# BLOCO 2 — Critérios específicos da 0051

## ✅ A RPC existe no schema que o cliente consome

O front chama `supabase.rpc("abrir_proximo_ciclo", { p_trilha, p_ancora, p_alunos })`
em `app/src/shared/data/index.js:368`.

```sql
select to_regprocedure('public.abrir_proximo_ciclo(uuid,date,uuid[])') is not null;  --> t
select p.proname||'('||array_to_string(p.proargnames,', ')||')' …                    --> abrir_proximo_ciclo(p_trilha, p_ancora, p_alunos)
```

Schema `public` (o exposto pelo PostgREST), 3 argumentos, **nomes de parâmetro
idênticos** aos que o front manda, retorno `jsonb`. PostgREST chama por nome,
não por posição, então essa igualdade é o que importa. **Passou.**

## ✅ Caminho feliz

Aluno `a0000000-…-01` da escola A, movido para a trilha `espcex` v1, cujo
ciclo está `encerrado`. Coordenação da escola A chama com âncora
`current_date + 200`:

```
RETORNO: {"trilha_id": "a2925ff1-846f-4d7a-ad7e-36c74c21b60c", "alunos_movidos": 1}

 versao |                  id                  | sem | disc | ativ |    ini     |    fim
--------+--------------------------------------+-----+------+------+------------+------------
      1 | f6098026-b2ac-4563-80f1-36900900d3b3 |   9 |    9 |  109 | 2026-07-13 | 2026-09-13
      2 | a2925ff1-846f-4d7a-ad7e-36c74c21b60c |   9 |    9 |  109 | 2027-02-06 | 2027-04-09
```

**Passou.** Edição v2 criada com a forma do plano preservada — 9 semanas, 9
disciplinas, 109 atividades, mesmo span de 62 dias — e terminando exatamente
na âncora.

## Caminhos negativos

| Caso | Previsto | Observado | Veredito |
| --- | --- | --- | --- |
| Caller anônimo | recusa | `ERROR: permission denied for function abrir_proximo_ciclo` | ✅ |
| Caller papel `aluno` | recusa | `ERROR: acesso negado: só a coordenação abre ciclo` | ✅ |
| Caller papel `responsavel` | recusa | `ERROR: acesso negado: só a coordenação abre ciclo` | ✅ |
| Coordenação sem `escola_id` no token | recusa | `ERROR: sem escola no token` | ✅ |
| Âncora igual ao fim do ciclo atual | recusa | `ERROR: a âncora … não é posterior ao fim do ciclo atual` | ✅ |
| Trilha sem semanas | recusa | `ERROR: trilha … não tem semanas — nada a deslocar` | ✅ |
| Vínculo inválido (aluno de outra escola) | não move | `alunos_movidos: 0`; aluno B permanece na trilha antiga | ✅ |
| Aluno já ativo no ciclo (`em_curso`) | não move | `alunos_movidos: 0` | ✅ |
| **Escola suspensa** | **bloquear** | **`alunos_movidos: 1` — não bloqueia** | ❌ |

### ❌ ACHADO 1 — escola suspensa não é verificada

Teste controlado, mesmo cenário, única variável o `status` da escola:

```
CONTROLE (status='ativa'):    {"trilha_id": "8de09516-…", "alunos_movidos": 1}
SUSPENSA (status='suspensa'): {"trilha_id": "36df28d8-…", "alunos_movidos": 1}
```

A causa é estrutural. A policy que deveria barrar existe:

```
policyname   | cmd    | qual
alunos_update| UPDATE | escola_id = app.tenant_id() AND app.papel()='coordenacao' AND app.tenant_operacional()
```

e `app.tenant_operacional()` retorna falso para `status in ('suspensa','cancelada')`.
Mas `public.abrir_proximo_ciclo` é `SECURITY DEFINER`
(`0051_proxima_edicao_trilha.sql:142`) e **não checa `app.tenant_operacional()`
no corpo** — depende da RLS, que não é avaliada para o dono.

**A ressalva que eu esperava não se sustentou: é pior nos bancos reais.**
Consultei os dois ambientes hospedados (leitura pura):

```sql
select pg_get_userbyid(p.proowner), rolsuper, rolbypassrls, count(*)
  from pg_proc p … where n.nspname in ('public','app') and p.prosecdef …
```

| Projeto | dono | `rolsuper` | `rolbypassrls` | funções SECURITY DEFINER |
| --- | --- | --- | --- | --- |
| `zckyhihxjjbnqjqilymn` (produção) | `postgres` | false | **true** | 48 |
| `bdjkgrzfzoamchdpobbl` (demo) | `postgres` | false | **true** | 48 |

`BYPASSRLS` faz o mesmo que superuser para efeito de RLS. O comportamento
observado no local **vale igual em demo e em produção**. Não é artefato de
ambiente de teste.

Gravidade: uma escola suspensa por inadimplência consegue abrir ciclo novo e
migrar alunos. Não corrompe dado nem vaza tenant — a checagem de escola do
`update` (`0051:163`) continua valendo — mas fura a 0027
(`escola_suspensa_bloqueio`), que existe justamente para isso.

### ❌ ACHADO 2 — edição órfã quando ninguém é elegível

A edição é criada **antes** de se saber se algum aluno será movido
(`0051:155` cria; `0051:157-167` move). Três chamadas com âncoras diferentes,
nenhum aluno elegível:

```
chamada 1 (ancora+300): {"trilha_id": "02f6cc71-…", "alunos_movidos": 0}
chamada 2 (ancora+301): {"trilha_id": "acfd1000-…", "alunos_movidos": 0}
chamada 3 (ancora+302): {"trilha_id": "40d7348a-…", "alunos_movidos": 0}

trilhas ANTES: 2 → trilhas DEPOIS: 5

 versao | sem | ativ | alunos
      1 |   9 |   50 |     61
      2 |   9 |   50 |      0
      3 |   9 |   50 |      0
      4 |   9 |   50 |      0
```

Cada tentativa deixa uma trilha completa — 9 semanas, 9 disciplinas, 50
atividades — com zero alunos, e incrementa `versao`. A idempotência só protege
quando a âncora é **exatamente** a mesma: errar a data em um dia cria uma
edição órfã. A coordenação não tem como apagar isso pela tela.

> **Este achado continua ABERTO.** Uma trava de banco para ele foi escrita,
> ensaiada e **descartada na revisão** — ela era cross-tenant. O motivo está em
> [PROBLEMA CONHECIDO — a edição órfã segue sem trava no banco](#problema-conhecido--a-edição-órfã-segue-sem-trava-no-banco),
> mais abaixo. A `0052` fecha só o ACHADO 1.

## ✅ Histórico preservado

Mesmo aluno, antes e depois da migração para a edição nova:

| | metas | meta_atividades | registros_estudo | simulados | aluno_eventos_progresso | md5 das metas |
| --- | --- | --- | --- | --- | --- | --- |
| antes | 1 | 6 | 3 | 2 | 5 | `1cb227ced9eaec6f5d88337bf06dc92e` |
| depois | 1 | 6 | 3 | 2 | 5 | `1cb227ced9eaec6f5d88337bf06dc92e` |

**Passou.** Hash idêntico: as metas continuam presas à trilha anterior, com os
mesmos `trilha_id` e `semana_numero`. `registros_estudo`, `simulados` e
`aluno_eventos_progresso` não foram tocados — coerente com o desenho, já que
são presos ao aluno e não à trilha.

Contra os uniques citados:
- `metas (aluno_id, trilha_id, semana_numero)`: `73 total / 73 distintas`. A
  edição nova tem `trilha_id` diferente, então o aluno pode refazer a semana 1
  sem colidir com a semana 1 antiga — é o motivo de a solução ser edição nova
  e não deslocamento de datas.
- `trilhas (nicho, versao)`: `3 total / 3 distintas`. É este unique que segura
  a concorrência, abaixo.

## ✅ Concorrência e duplo clique

**Duplo clique, mesma âncora, sequencial** — três cliques:

```
clique 1: {"trilha_id": "2d203854-…", "alunos_movidos": 1}
clique 2: {"trilha_id": "2d203854-…", "alunos_movidos": 0}
clique 3: {"trilha_id": "2d203854-…", "alunos_movidos": 0}

edições espcex: 2   |   metas 73 total / 73 distintas   |   semanas na edição nova: 9 (não 27)
```

**Duas transações realmente sobrepostas** (ambas abertas, `pg_sleep(2)`, e só
então a chamada):

```
tx 1: ERROR: duplicate key value violates unique constraint "trilhas_nicho_versao_key"
tx 2: {"trilha_id": "40eee021-…", "alunos_movidos": 1}

edições espcex: v1 (0 alunos) + v2 (1 aluno)
trilhas: 3 total / 3 distintas
semanas por edição: 9 e 9   |   atividades: 109 e 109
```

**Passou no critério pedido.** Não se criam dois ciclos ativos e não se
duplicam metas. O `unique (nicho, versao)` é o que garante isso.

Ressalva de UX, não de dado: quem perde a corrida recebe o erro de constraint
do Postgres cru. `validarAncora` (`app/src/modules/escola/proximoCiclo.js:97`)
não cobre esse caso, porque ele não é sobre a âncora.

---

# BLOCO 3 — A lógica duplicada no cliente

`app/src/modules/escola/proximoCiclo.js:92-96` declara espelhar a checagem de
`app.abrir_proximo_ciclo`. Rodei a **mesma matriz** nos dois lados.

Cliente — `node`, chamando `validarAncora` diretamente:

| âncora | fimAtual | cliente |
| --- | --- | --- |
| 2026-09-14 | 2026-09-13 | ACEITA |
| 2026-09-13 | 2026-09-13 | RECUSA |
| 2026-09-12 | 2026-09-13 | RECUSA |
| 2027-04-09 | 2026-09-13 | ACEITA |
| `null` | 2026-09-13 | RECUSA |
| 2026-09-14 | `null` | RECUSA |

Servidor — `app.abrir_proximo_ciclo` sobre a trilha cujo fim é 2026-09-13:

| âncora | servidor |
| --- | --- |
| 2026-09-14 | ACEITA |
| 2026-09-13 | RECUSA |
| 2026-09-12 | RECUSA |
| 2027-04-09 | ACEITA |
| trilha sem semanas | RECUSA: `trilha … não tem semanas — nada a deslocar` |

## Veredito: batem

Nos seis casos testáveis dos dois lados, ACEITA/RECUSA é idêntico. Inclusive
a borda que mais erra na prática — âncora **igual** ao fim — é recusada nos
dois, e o comentário de `0051:80-85` mostra que essa ordem foi deliberada.

Duas observações, nenhuma é divergência de resultado:

1. **O cliente compara string, o servidor compara `date`.** `String(ancora) <= String(fimAtual)`
   (`proximoCiclo.js:100`) só é equivalente a comparação de data enquanto as
   duas pontas forem ISO `yyyy-mm-dd` zero-padded. É o formato que o Supabase
   devolve e o que `<input type="date">` produz, então hoje bate. Um dia em
   que `fim` chegar como `Date` ou em outro formato, a comparação passa a
   mentir sem erro. Mesma família da armadilha de collation já registrada em
   `scripts/fingerprint-schema.sql`.
2. **O cliente valida menos do que o servidor, de propósito.** `validarAncora`
   cobre só a âncora; `public.abrir_proximo_ciclo` cobre âncora + papel +
   escola no token + elegibilidade. Isso é o desenho certo — cliente antecipa,
   servidor é autoridade — mas significa que o botão fica habilitado em
   situações que o servidor recusa (papel errado, token sem escola), e aí o
   usuário vê erro cru. Na prática a tela só é alcançável pela coordenação,
   então é defesa em profundidade e não buraco de UX.

**Nada foi corrigido nesta etapa**, conforme pedido.

---

# BLOCO 4 — Contrato de banco como gate

Entregue: **`scripts/manifesto-rpcs.mjs`** (script irmão de
`checar-migrations.mjs`, mesma convenção de conexão e de exit code).

## O que ele confere

As três coisas, não só a primeira:

1. **Existe** — há função com esse nome em `public`.
2. **Assinatura** — os parâmetros que o front manda existem na função **com
   esses nomes**. PostgREST chama por nome, não por posição: `p_aluno` no
   lugar de `p_alunos` quebra em runtime e passa por qualquer checagem que só
   olhe o nome da função.
3. **Autorização** — o papel usado (`authenticated` por padrão) tem `EXECUTE`.
   Função que existe e não pode ser executada é tão morta quanto função
   ausente.

Chamadas dinâmicas: o extrator só enxerga `.rpc("literal"`. Se encontrar
`.rpc(variavel)`, ele **acusa e sai com 1**, exigindo declaração explícita em
`RPCS_DINAMICAS`. Não adivinha nome de função. Hoje a lista está vazia — as 11
chamadas do front são literais.

## Saída contra um banco com a 0051 aplicada

```
$ SUPABASE_DB_URL="postgresql://postgres@127.0.0.1:54322/rumo_teste" node scripts/manifesto-rpcs.mjs
MANIFESTO DE RPCs — 11 chamadas literais no front

✓ abrir_proximo_ciclo
     chamada em: app/src/shared/data/index.js:368
     front manda: {p_alunos, p_ancora, p_trilha}
     banco tem:   public.abrir_proximo_ciclo(p_trilha uuid, p_ancora date, p_alunos uuid[]) → jsonb
     execute:     postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres
…
✓ contrato íntegro: as 11 RPCs existem, com assinatura compatível e EXECUTE para o papel usado.
EXIT: 0
```

As 11 RPCs: `abrir_proximo_ciclo`, `backoffice_criar_escola`,
`backoffice_dashboard`, `backoffice_definir_status`,
`backoffice_detalhe_escola`, `backoffice_editar_escola`,
`backoffice_escolas`, `backoffice_registrar_reenvio`, `resumo_escola`,
`salvar_onboarding_aluno`, `sou_super_admin`.

## Os três contrafactuais

O script foi provado contra cada modo de falha, não só contra o caso feliz.

**1. Função ausente — o estado real de demo e produção hoje:**

```
❌ abrir_proximo_ciclo
     chamada em: app/src/shared/data/index.js:368
     front manda: {p_alunos, p_ancora, p_trilha}
     ⚠ não existe em public — o front chama e o banco não tem
EXIT: 1
```

**Este é o teste que importa: rodado hoje contra demo ou produção, o script
teria falhado.** É o defeito que chegou ao usuário.

**2. Assinatura incompatível** (`p_alunos` renomeado para `p_aluno`):

```
❌ abrir_proximo_ciclo
     banco tem: public.abrir_proximo_ciclo(p_trilha uuid, p_ancora date, p_aluno uuid[]) → jsonb
     ⚠ assinatura incompatível — o front manda {p_alunos, p_ancora, p_trilha},
       a função aceita {p_trilha, p_ancora, p_aluno}; sobra(m): p_alunos
EXIT: 1
```

Nomeia o parâmetro que sobra. `to_regprocedure` sozinho teria dito "existe".

**3. Sem `EXECUTE` para `authenticated`:**

```
❌ abrir_proximo_ciclo
     execute: postgres=X/postgres,service_role=X/postgres
     ⚠ `authenticated` NÃO tem EXECUTE (acl: postgres=X/postgres,service_role=X/postgres)
EXIT: 1
```

## Onde encaixar

- **No CI**, depois do `reset-db.sh`: prova que o repositório é coerente
  consigo mesmo.
- **Antes de publicar o front** contra um ambiente: prova que aquele banco
  aguenta o bundle que está prestes a subir.

Não alterei `ci.yml` nesta etapa — o escopo era produzir o script.

---

# BLOCO 5 — Plano de aplicação e reversão

## Antes: backup lógico

```bash
pg_dump --format=custom --no-owner --no-privileges \
        --file=pre-0051-<AMBIENTE>-$(date +%Y%m%dT%H%M%SZ).dump \
        "$SUPABASE_DB_URL"
```

**O que inclui:** schemas `public` e `app` completos — tabelas, dados,
funções, views, constraints, índices, triggers.

**O que NÃO inclui, e por isso não é um backup do projeto:**
- `auth.users`, `auth.sessions`, `auth.refresh_tokens` — `pg_dump` sem
  superuser não lê o schema `auth` do Supabase. Restaurar este dump **não
  traz as contas de volta**.
- `storage.objects` e os arquivos em si.
- Edge Functions, secrets de função, configuração de Auth, policies de
  Storage — nada disso vive no Postgres.
- Extensões e roles gerenciadas pela plataforma (`--no-owner --no-privileges`
  descarta dono e grants de propósito, para o restore não brigar com os roles
  do Supabase).

Para a `0051` isso é suficiente, porque ela só toca `public`/`app`. Não
confunda com backup de desastre — esse é o PITR do painel, e é assunto da
Etapa 4.

## Ordem exata

```bash
# 1. Backup (acima) e confirmação de que o arquivo existe e tem tamanho > 0.

# 2. Estado ANTES — guarde a saída.
psql "$SUPABASE_DB_URL" -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='abrir_proximo_ciclo';"
# esperado: 0

# 3. Aplicar.
psql -v ON_ERROR_STOP=1 "$SUPABASE_DB_URL" -f supabase/migrations/0051_proxima_edicao_trilha.sql

# 4. Registrar no ledger (o passo que o Supabase CLI faria; à mão, é isto):
psql "$SUPABASE_DB_URL" -c "insert into supabase_migrations.schema_migrations (version, name)
  values (to_char(now() at time zone 'utc','YYYYMMDDHH24MISS'), '0051_proxima_edicao_trilha');"

# 5. Estado DEPOIS.
psql "$SUPABASE_DB_URL" -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='abrir_proximo_ciclo';"
# esperado: 2

# 6. O gate do Bloco 4 — é isto que fecha a aplicação.
SUPABASE_DB_URL="$SUPABASE_DB_URL" node scripts/manifesto-rpcs.mjs
# esperado: EXIT 0, "contrato íntegro"
```

O passo 4 não é opcional: sem ele o `checar-migrations.mjs` passa a acusar a
`0051` como faltando, e o próximo operador vai reaplicar achando que precisa.

## Como reverter, e o que a reversão NÃO desfaz

```sql
drop function if exists public.abrir_proximo_ciclo(uuid, date, uuid[]);
drop function if exists app.abrir_proximo_ciclo(uuid, date);
delete from supabase_migrations.schema_migrations where name = '0051_proxima_edicao_trilha';
```

**O drop remove a capacidade, não o efeito.** Ensaiado, com um ciclo já
aberto:

| | funções | edições | alunos migrados | semanas novas | atividades novas |
| --- | --- | --- | --- | --- | --- |
| antes do rollback | 2 | 3 | 1 | 18 | 218 |
| depois do rollback | **0** | **3** | **1** | **18** | **218** |

E o aluno migrado fica assim:

```
 id                                   | trilha_id (edição v2)                | versao | estado
 a0000000-0000-4000-8000-000000000001 | 2d203854-316c-4591-9e0f-c9b02381212d |      2 | antes
```

**O estado que sobra:** o aluno continua apontando para a edição nova, com
ciclo `'antes'` (a edição ainda não começou). Ele não volta sozinho para a
trilha antiga, e ninguém tem mais como abrir ciclo para desfazer. As metas
antigas continuam na edição anterior, intactas — mas o aluno não as vê mais,
porque está em outra trilha.

Reverter de verdade, depois de ciclo aberto, exige DML manual: repontar
`alunos.trilha_id` para a edição de origem e limpar as trilhas órfãs em
`atividades_modelo` → `trilha_semanas` → `disciplinas` → `trilhas`, nessa
ordem. Isso não está no arquivo da migration e não deve ser improvisado no
meio de um incidente.

**Conclusão prática: o ponto sem retorno não é aplicar a `0051`. É a primeira
coordenação clicar no botão.** Entre um e outro, o rollback é trivial.

## Recomendação de ordem: demo primeiro, produção depois

**Demo primeiro**, e não pelo motivo de sempre. A paridade de schema já está
provada, então "testar no demo para ver se aplica" não acrescenta quase nada
— o percurso (b) deste ensaio já respondeu isso. O que só o demo responde é o
**uso**: é lá que a coordenação da vitrine vai clicar no botão pela primeira
vez, com 60 alunos e trilha de verdade, e é lá que os dois achados aparecem
sem custo — a edição órfã e a escola suspensa. (Com a `0052` junto, só a
edição órfã sobra para aparecer; ela segue sem trava no banco.)

Produção tem 1 escola, 1 aluno, 0 registros (medido na Etapa 0). Aplicar lá é
barato e reversível; o risco não está na aplicação.

Janela entre um e outro: até a coordenação do demo abrir um ciclo real e o
resultado ser conferido. Se a intenção for só destravar a tela, os dois podem
ir no mesmo dia.

---

# PROBLEMA CONHECIDO — a edição órfã segue sem trava no banco

**Status: ABERTO. Não resolvido no banco, e a `0052` não o resolve.**
Esta seção existe para que a próxima pessoa não reescreva a trava que já foi
escrita, ensaiada e descartada.

## O comportamento

`public.abrir_proximo_ciclo` cria a edição **antes** de saber se algum aluno
será movido (`0051:155` cria; `0051:157-167` move). A idempotência só protege
quando a âncora é byte a byte a mesma. Então:

- A coordenação erra a data em **um dia** → nasce uma edição completa (9
  semanas, 9 disciplinas, ~50 atividades) com **zero alunos**, e `versao`
  incrementa.
- Abrir o ciclo sem passar `p_alunos` é **uso previsto** — o parâmetro tem
  `default null`, e "abrir agora, vincular depois" é um fluxo legítimo. Esse
  caminho também deixa a edição vazia, por desenho.
- A tela da coordenação **não tem como apagar** a edição órfã. Só quem tem
  acesso direto ao banco limpa.

Gravidade: lixo acumulável no catálogo, sem caminho de limpeza pelo produto.
Não corrompe dado, não vaza tenant, não move aluno. Envenena a lista de
edições que a coordenação enxerga.

## Por que a trava de banco foi descartada

A trava chegou a existir: recusava criar edição nova quando já havia uma
edição **futura** do mesmo nicho sem nenhum aluno vinculado, nomeando qual
era. Ela passou nos cinco casos que foram ensaiados para ela. Foi descartada
na revisão do PR #128 por um motivo que só aparece olhando o schema:

> **`trilhas` não tem `escola_id`.** As colunas são `id, nicho, nome, versao,
> publicada, criada_em`, com `unique (nicho, versao)` — ver
> `0001_fundacao.sql:106-114`. Nenhuma migration posterior adiciona a coluna.

`trilhas` é **catálogo global por nicho**, compartilhado entre escolas. Medido
no demo (`bdjkgrzfzoamchdpobbl`, leitura), o nicho `colegio-naval` é usado por
**três escolas ao mesmo tempo**: Curso Beta Preparatório, Instituto Meridiano
e Matriz Educação RM.

Qualquer trava que filtre por `nicho` e conte alunos **sem recorte de escola**
é, portanto, cross-tenant. O cenário concreto:

1. A escola A abre ciclo sem passar `p_alunos` — uso previsto.
2. A edição fica sem alunos.
3. A escola B tenta abrir o ciclo **dela**, com outra âncora, e é **recusada**.
4. O erro cita uma edição que não é dela, que ela não pode vincular nem apagar.
5. Só o super admin destrava — e a escola B não tem como nem saber disso.

E a mensagem de erro, para ser útil, nomeava a edição: vazava **nome, versão e
data de fim** de uma edição de outro tenant.

Há um segundo motivo, independente do vazamento: **os dois blocos da função
assumiriam modelos opostos.** O bloco de idempotência (`0051:91-101`) reusa
DELIBERADAMENTE a edição de qualquer origem que termine na âncora — ele trata
o catálogo como compartilhado, que é o que ele é. A trava tratava a edição
como propriedade de quem a criou. Uma contradiria a outra, a três linhas de
distância.

**Conclusão: o problema não tem trava correta enquanto o catálogo não tiver
dono por escola.** Não é uma questão de refinar o predicado.

## As duas saídas possíveis

### 1. Aviso na interface — cabe agora, sem mudar modelo

A tela da coordenação avisa, antes de confirmar, que a âncora escolhida vai
criar uma **edição nova** (e não reusar uma existente), mostrando a data de
fim resultante. O erro que a trava de banco tentava evitar é, na prática, um
erro de digitação de data: um passo de confirmação que mostre o efeito pega a
maior parte dele.

Isso é trabalho de **front**, entra com a tela na mão, e **não faz parte deste
documento nem do PR #128**. Não corrige o caso de quem confirma mesmo assim,
nem dá caminho de limpeza — reduz a incidência, não fecha o furo.

### 2. `criada_por_escola` em `trilhas` — mudança de modelo, NÃO autorizada

Adicionar `criada_por_escola uuid references escolas(id)` (nulo para o
catálogo de origem) daria dono às edições e tornaria uma trava por escola
possível **e** correta. Também abriria caminho para a coordenação apagar a
própria edição órfã pela tela.

**Isso é decisão de produto, não de banco, e não está autorizada.** Muda o
significado de `trilhas` de "catálogo global" para "catálogo global + edições
por escola", e puxa junto, no mínimo: as policies de `trilhas`, o bloco de
idempotência da `0051`, a listagem de edições na Área da Escola, e a pergunta
de o que acontece com as edições já criadas sem dono nos dois ambientes.

Registrado aqui como opção, não como plano.

---

# O que este ensaio achou, e o que fazer com isso

A `0051` **aplica limpa nos três percursos** e cumpre todos os critérios de
contrato, caminho feliz, histórico e concorrência. Os dois achados não são
defeitos de migration — são defeitos de **produto** na função que ela cria, e
nenhum dos dois é resolvido por não aplicar:

| Achado | Gravidade | Situação |
| --- | --- | --- |
| Escola suspensa não é verificada | Fura a 0027 em demo **e** produção (dono tem `BYPASSRLS`) | **Fechado pela `0052`** — lê `escolas.status` no corpo da função e nega em `suspensa`, `cancelada` e escola não encontrada |
| Edição órfã quando ninguém é elegível | Lixo acumulável, sem caminho de limpeza na tela | **ABERTO** — ver [PROBLEMA CONHECIDO](#problema-conhecido--a-edição-órfã-segue-sem-trava-no-banco) acima |

> **Correção ao que este documento dizia antes.** A primeira versão desta
> tabela propunha `if not app.tenant_operacional() then raise` para o ACHADO 1.
> **Isso estava errado**, e a `0052` deliberadamente não faz isso:
> `app.tenant_operacional()` tem `coalesce(..., true)` e responde OPERACIONAL
> quando a escola não é encontrada (o C-S04 da auditoria). Usá-la teria
> herdado metade do furo. A `0052` lê `escolas.status` direto e nega por
> ausência. Corrigir a própria `tenant_operacional` é Etapa 2 — ela serve
> policies de várias tabelas, e inverter o default pode derrubar fluxo
> legítimo que este ensaio não cobriu.
>
> A mesma tabela propunha, para o ACHADO 2, "criar a edição só quando houver
> aluno a mover, ou exigir `p_alunos` não vazio". **Isso também estava errado**:
> `p_alunos` tem `default null` e "abrir agora, vincular depois" é uso
> previsto — exigir a lista quebraria o fluxo normal para evitar o acidental.

Só o ACHADO 1 virou `0052`. A decisão de aplicar a `0051` antes ou depois dela
é do gate, não deste documento.

## NÃO VERIFICADO

- **Comportamento sob o PostgREST real.** Todo o Bloco 2 foi exercido por
  `psql` simulando as claims do JWT, que é o método que `tests/identidades.mjs`
  já usa. A camada HTTP do PostgREST não foi exercida — isso é escopo da
  Etapa 3.
- **`pg_dump` contra os bancos hospedados.** O comando do Bloco 5 não foi
  executado; o que ele inclui e exclui vem da documentação do Supabase e do
  comportamento do `pg_dump`, não de uma execução nesta sessão.
