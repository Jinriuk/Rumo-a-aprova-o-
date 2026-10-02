# Alertas que chegam ao dono (Etapa 4) — custo R$ 0

**Escrito em:** 02/10/2026. **Nada disto foi aplicado em demo nem em produção.**
A aplicação vem depois do primeiro backup real (Etapa 6) e da autorização do
dono. Lacunas que isto fecha: 8.1, 8.4, 8.5 e 8.6 de
[`matriz-configuracao.md`](./matriz-configuracao.md).

## 1. O que avisa o quê

| Sinal | Quem percebe | Como chega ao dono | Configuração |
| --- | --- | --- | --- |
| Erro na tela (React quebrou, promessa rejeitada, erro de janela) | `observabilidade.js` manda para a Edge Function `registrar-erro` | e-mail pelo Resend para `ALERTA_EMAIL`, 1 por erro por hora | `ALERTA_EMAIL` (Supabase) e `VITE_ERROR_REPORT_URL` (Vercel) |
| Resposta 5xx de qualquer Edge Function | `comRelato5xx` (`_shared/coletor-servidor.ts`) nas 7 funções | o mesmo e-mail, origem `edge:<função>` | nada além do acima |
| Keepalive não rodou, atrasou demais ou uma batida falhou | healthchecks.io, check `keepalive` | e-mail do healthchecks | `HC_KEEPALIVE_URL` (GitHub) |
| Virada de semana não rodou, ou rodou com aluno em erro | healthchecks.io, check `virada-semana` | e-mail do healthchecks | `hc_virada_url` (Vault do Supabase) |

O e-mail de erro diz o ambiente no assunto (`[Triliva produção]`,
`[Triliva demo]`), porque os dois projetos mandam para o mesmo endereço.

## 2. Onde cadastrar cada coisa (passo a passo)

### 2.1 `ALERTA_EMAIL` — no Supabase, nos dois projetos

1. Entre em supabase.com, abra o projeto (**produção** primeiro, depois o
   **demo**).
2. Menu **Edge Functions** › **Secrets**.
3. **Add new secret**: nome `ALERTA_EMAIL`, valor = o e-mail que recebe os
   alertas. Salve.

`RESEND_API_KEY` e `RESEND_FROM_EMAIL` já estão lá e são reaproveitados.
Se o remetente ainda for o de teste do Resend (`onboarding@resend.dev`), o
Resend só entrega para o e-mail **dono da conta Resend**: use esse e-mail em
`ALERTA_EMAIL` até o domínio próprio estar verificado.

Sem qualquer um dos três, o erro é gravado na tabela e o e-mail não sai; o
log da função diz qual falta.

### 2.2 `HC_KEEPALIVE_URL` — no GitHub, **antes** do merge do PR de banco

1. No healthchecks.io, abra o check **keepalive** e copie a **Ping URL**
   (`https://hc-ping.com/<uuid>`).
2. No GitHub: repositório › **Settings** › **Secrets and variables** ›
   **Actions** › **New repository secret**.
3. Nome `HC_KEEPALIVE_URL`, valor = a Ping URL. Salve.

Sem o secret, o workflow *Manter banco acordado* fica **vermelho** a partir
do merge (mesma regra do #155: vigia desligado é falha, não pulo).

Ajuste do check no healthchecks: **Period 1 dia**, **Grace 12 horas** (o
agendador do GitHub já atrasou 6h26). O workflow pinga a URL quando as duas
batidas passaram e `<url>/fail` quando uma delas falhou.

### 2.3 `hc_virada_url` — no Vault do Supabase, **depois** de aplicar a 0060

A URL não entra no repositório. No **SQL Editor** do projeto:

```sql
select vault.create_secret(
  'https://hc-ping.com/<uuid do check virada-semana>',
  'hc_virada_url',
  'healthchecks: check virada-semana'
);
```

Para trocar depois:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'hc_virada_url'),
  'https://hc-ping.com/<uuid novo>'
);
```

Ajuste do check: **Period 1 dia**, **Grace 1 hora** (o `pg_cron` roda às
03:05 UTC e é pontual), ou o agendamento cron `5 3 * * *` em UTC.

**Um check por ambiente.** Se demo e produção pingarem o mesmo check
`virada-semana`, o ping de sucesso do demo esconde a falta de ping da
produção. Ponha `hc_virada_url` só na produção, ou crie um segundo check
(`virada-semana-demo`) para o demo. O plano gratuito tem 20 checks. O
keepalive não tem esse problema: um job só cobre os dois bancos e só pinga
quando os dois responderam.

### 2.4 `VITE_ERROR_REPORT_URL` — na Vercel, **depois** de publicar a função

1. Vercel › projeto › **Settings** › **Environment Variables**.
2. Nome `VITE_ERROR_REPORT_URL`, valor
   `https://<ref do MESMO ambiente>.supabase.co/functions/v1/registrar-erro`
   (produção: `zckyhihxjjbnqjqilymn`; demo: `bdjkgrzfzoamchdpobbl`). Nunca
   aponte um projeto para o coletor do outro.
3. Alvo **Production**. Faça um **Redeploy**: o Vite grava a variável no
   build.

A CSP não muda: `connect-src` já libera `https://*.supabase.co`. O front de
hoje já manda o relato nesse formato; o PR do front acrescenta release,
papel e correlation_id.

## 3. Ordem de aplicação

1. Primeiro backup real dos dois ambientes (Etapa 6).
2. `HC_KEEPALIVE_URL` no GitHub (2.2).
3. Merge do **PR de banco** (migrations, funções, workflow).
4. Aplicar `0059_coletor_erros` e `0060_heartbeat_virada` no demo, conferir,
   depois na produção.
5. Publicar as funções: `registrar-erro` (nova) e as 7 existentes (ganharam o
   relato de 5xx). Antes, arquivar o código publicado hoje, como na E2
   (`aplicacao-e2-0055-0058.md`). Pela CLI (`supabase functions deploy
   --project-ref <ref>`) os imports de `_shared/` vão sozinhos; pelo MCP
   (`deploy_edge_function`), cada função leva os arquivos de `_shared/` que
   importa, e agora todas importam também `coletor-servidor.ts`,
   `coletor.ts` e `relato5xx.ts` (que importa `coletor.ts`), além do
   `cors.ts`. Ordem: `registrar-erro` primeiro, depois as 7. Função
   publicada antes da migration chama uma RPC que não existe: o 5xx dela
   continua 5xx e o relato falha calado (o teste de prazo cobre isso), mas
   o certo é a 0059 antes.
6. `ALERTA_EMAIL` (2.1) e `hc_virada_url` (2.3).
7. `VITE_ERROR_REPORT_URL` na Vercel e redeploy (2.4).
8. Merge do **PR do front**.

## 4. Como testar depois de configurar

- **Coletor e e-mail:** abra o site, F12 › Console, rode
  `Promise.reject(new Error("teste de alerta do dono"))`. Em até um minuto
  chega o e-mail; a linha aparece em `app.erros_ocorrencias`.
- **Keepalive:** Actions › *Manter banco acordado* › **Run workflow**. O check
  `keepalive` mostra o ping.
- **Virada:** espere a próxima 03:05 UTC, ou rode no SQL Editor
  `select * from app.virar_semana();`. A virada é idempotente (é o que o cron
  roda todo dia), mas rodar à mão em produção é decisão do dono.

## 5. Ler os erros

```sql
-- últimos relatos
select criado_em, origem, mensagem, rota, release, papel, correlation_id
  from app.erros_ocorrencias order by criado_em desc limit 50;

-- grupos (o "mesmo erro"), do mais frequente
select fingerprint, origem, mensagem, ocorrencias, primeira_em, ultima_em, ultimo_email_em
  from app.erros_grupos order by ultima_em desc limit 50;
```

Um 5xx de Edge Function tem `correlation_id`; o mesmo id está no log da
função (Edge Functions › Logs) junto do erro detalhado, e no cabeçalho
`x-correlation-id` da resposta que o navegador recebeu.

## 6. Limites (no corpo da RPC da 0059)

| Trava | Valor |
| --- | --- |
| Corpo do relato | 16 KB (413 acima) |
| Por IP (HMAC do IP com o segredo da função e a data; o IP não é gravado) | 20 por minuto (429 acima) |
| Ocorrências gravadas | 500 em 24 h; acima disso só conta, e o grupo `teto-diario` alerta |
| E-mail por erro | 1 por hora |
| E-mails no total | 20 em 24 h por projeto (40 com demo e produção), dentro dos 100/dia do Resend gratuito, que é dividido com os e-mails de acesso da coordenação |
| Retenção | ocorrências e e-mails 30 dias; grupos 90 dias sem ocorrer |

## 7. O que NÃO está provado, e o risco que fica

- **IP real no hospedado.** A função usa `cf-connecting-ip`, depois
  `x-real-ip`, depois o primeiro `x-forwarded-for`. Qual cabeçalho o Supabase
  hospedado entrega, e se o cliente consegue forjá-lo, não foi medido (a
  sessão não alcança `*.supabase.co`). Se for forjável, o limite por IP cai;
  os tetos globais (500 ocorrências e 20 e-mails em 24 h) continuam valendo.
- **Origin é forjável fora do navegador.** Um script consegue mandar lixo até
  os tetos. O dano é ruído e e-mail desperdiçado, não vazamento.
- **Nome de pessoa em texto livre não é redigido.** A redação pega formato
  (e-mail, JWT, token, senha em chave=valor, código de acesso, CPF, telefone,
  uuid). O app não põe nome em mensagem de erro; a mensagem é cortada em 500
  caracteres.
- **Pilha minificada.** O build não publica sourcemap; a pilha serve para
  achar o arquivo, não a linha do código-fonte.
- **URL do healthchecks.** Quem tiver a URL consegue mandar ping falso
  (impacto baixo). Por isso ela fica em secret e no Vault, nunca no
  repositório nem no log.
- **Virada que aborta inteira não manda `/fail`.** Ela não grava a linha de
  heartbeat, então não há ping; o healthchecks acusa depois da folga (1 h).

## 8. Provas

Na stack local da E3 (a mesma CLI 2.118.0 e os mesmos scripts do job
`e2e-local`), pelo workflow **Provas dos alertas (stack local)**
(`.github/workflows/provas-alertas.yml`, roteiro em `scripts/alertas/`):
P1 origem recusada, P2 nenhum dado pessoal gravado nem enviado, P3 50 erros
iguais geram 1 e-mail, P4 erro do React e promessa rejeitada chegam à tabela
e geram e-mail (Resend simulado), P5 coletor fora do ar não derruba a tela,
P6 5xx de outra função entra no coletor, P7 heartbeat da virada pelo pg_net e
Vault reais. O relatório sai no resumo do job e no artefato
`provas-alertas-*`.

Testes permanentes no CI: `tests/e4-coletor-db.test.mjs` (limites, grupos,
e-mails, permissões), `tests/e4-coletor-edge.test.mjs` (redação, fingerprint,
relato de 5xx), `tests/e4-heartbeat-virada-db.test.mjs` (gatilho da virada) e
`tests/e4-keepalive-heartbeat.test.mjs` (passos do workflow).
