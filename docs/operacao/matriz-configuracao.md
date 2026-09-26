# Matriz de configuração (Etapa 4)

**Levantada em:** 26/09/2026, a partir do código na `main` em `add4fd2`, do
que o dono conferiu nos painéis em 24 e 25/09 e de leituras feitas nesta data
(logs, listagens e `SELECT`). **Nada foi alterado em ambiente hospedado.**

**Nenhum valor secreto aparece aqui.** Nome, tipo, consumidor, ambiente,
presença e efeito observado: sim. Valor: nunca. Quando um log mostra uma
chave, o documento registra só o tipo dela (publicável, secreta, JWT legado).

## Como ler

| Coluna | Significado |
| --- | --- |
| Nome | Variável, secret ou ajuste de painel |
| Tipo | O que o valor é |
| Consumidor | Arquivo e linha que lê o valor, ou o serviço que o aplica |
| Ambiente | **P** produção (Supabase `zckyhihxjjbnqjqilymn`, `sa-east-1`; Vercel `triliva-producao`, `app.trilivaedu.com.br`) · **D** demo/vitrine (Supabase `bdjkgrzfzoamchdpobbl`, `us-east-1`; Vercel `rumo-a-aprova-o`) · **L** local e CI |
| Obrig./cond. | Obrigatório, ou condicional e sob qual condição |
| Origem | Onde o valor mora |
| Prova de presença | Evidência de que o valor existe. **Confirmação no painel conta só aqui** |
| Prova funcional | **ok** só quando uma execução registrada mostra o efeito da configuração (workflow com HTTP 200, cron com `succeeded`, token emitido com o algoritmo configurado, teste que passou). Sem isso: **pendente**, com o que falta |
| Dono | Quem responde pela configuração. "dono" é o titular das contas (GitHub `Jinriuk`, Vercel, Supabase); "repo" é arquivo versionado, revisado por PR |
| Data | Data da evidência mais recente |

Um log mostrando tráfego real só vale como prova funcional quando identifica
sem ambiguidade quem fez a chamada. O log do gateway do Supabase não guarda a
página de origem, então tráfego de navegador não distingue o site publicado de
um build local apontado para o mesmo projeto. Esses casos ficam **pendente**,
com o tráfego anotado.

---

## 1. Front (build do Vite)

| Nome | Tipo | Consumidor | Ambiente | Obrig./cond. | Origem | Prova de presença | Prova funcional | Dono | Data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | URL pública, embutida no build | `app/src/lib/supabase.js:6`; `scripts/captura/pack-v2.mjs:106` | P, D, L | obrigatório: sem ela o front lança erro (`supabase.js:9-12`) | P e D: Vercel, tipo `sensitive`, alvos Production e Preview. L: `app/.env.production` (aponta para o D) | P e D: nome listado em 26/09 (`filter_project_envs`, sem decriptar), igual ao relato do dono. L: arquivo versionado | P: **pendente** (25/09: navegador falando com o projeto P, origem da página não registrada). D: **pendente** (último navegador no log do D: 19/09). L: **ok**, é a URL do D, que respondeu HTTP 200 ao keepalive de 25/09 | dono; repo (L) | 26/09 |
| `VITE_SUPABASE_ANON_KEY` | chave de cliente, embutida no build | `supabase.js:7`; `redefinirSenha` em `app/src/shared/data/index.js:841`; `pack-v2.mjs:107` | P, D, L | obrigatório | como acima | como acima. P: criada em 04/09 e nunca editada. D: criada em 03/07 e nunca editada (`updatedAt` = `createdAt`) | P: **pendente**. O log de 25/09 tem 199 req REST e 19 de Auth vindas de navegador com a chave **publicável**, sem erro de chave, mas não prova que vieram de `app.trilivaedu.com.br`. D: **pendente**. Em 19/09 o navegador usava a **anon legada**, e a variável não mudou desde julho. L: o arquivo tem a anon legada do D (JWT `role: anon`), a que `get_publishable_keys` lista como ativa em 26/09. **ok**: o keepalive do D usou exatamente essa chave em 25/09 (mesmo `iat` e mesmo prefixo de assinatura no log do gateway) e recebeu HTTP 200 | dono; repo (L) | 26/09 |
| `VITE_APP_ENV` | flag de build (`demo`) | `app/src/shared/branding/ambiente.js:5` (faixa "AMBIENTE DE DEMONSTRAÇÃO") | D (esperada); P não deve ter | condicional: só no projeto do D | Vercel | **ausente nos dois projetos** (listagem de 26/09; relato do dono; E0 em 21/09) | **pendente**: sem ela, `EH_DEMO` é falso na vitrine e a faixa depende só da escola carregada (`demoEscola.js`). A tela de entrada do D não tem marca de demonstração | dono | 26/09 |
| `VITE_ERROR_REPORT_URL` | URL do coletor de erro | `app/src/shared/lib/observabilidade.js:9` | nenhum | condicional: sem ela, o erro fica só no console | Vercel (não criada) | ausente nos dois projetos | **pendente**. Ver lacuna 8.1: a CSP bloqueia coletor externo e o corpo do POST não segue o formato do Sentry | dono | 26/09 |
| CSP e cabeçalhos de segurança | cabeçalho HTTP | navegador, todas as rotas | P, D | obrigatório | `vercel.json` | arquivo versionado | **pendente**: nenhum teste lê os cabeçalhos do deploy publicado | repo | 26/09 |

## 2. Edge Functions

As 7 funções (`backoffice-coordenador`, `gerar-meta`, `lgpd-titular`,
`provisionar-aluno`, `revogar-responsavel`, `trocar-senha`, `virar-semana`)
estão `ACTIVE` nos dois projetos, com o mesmo `ezbr_sha256` por função em P e D
(`list_edge_functions`, 26/09).

| Nome | Tipo | Consumidor | Ambiente | Obrig./cond. | Origem | Prova de presença | Prova funcional | Dono | Data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` | URL do projeto | `_shared/contexto.ts:11` e as funções que criam cliente próprio (`provisionar-aluno`, `revogar-responsavel`, `trocar-senha`, `backoffice-coordenador:30`) | P, D, L | obrigatório | injetada pela plataforma | não listável; as 7 funções respondem | P: **ok**, 25/09: 16 req das funções (`Deno … SupabaseEdgeRuntime`) ao REST e ao Auth do próprio projeto, 0 erro. D: **pendente**, nenhuma chamada das 7 no log retido (a de 19/09 era da `capture-oidc-20260919`, já removida). L: **ok**, `e2e-local` no run `36221495753` | Supabase injeta; dono | 26/09 |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta | cliente admin (`_shared/contexto.ts:12` e as 4 funções acima); porteiro da `virar-semana` (`index.ts:49`) | P, D, L | obrigatório | injetada pela plataforma | idem | P: **ok**. As req de 25/09 chegam ao gateway com prefixo `sb_secret`: o valor que a plataforma injeta sob este nome já é a **secreta nova** (o mecanismo não está documentado aqui). D e L: como na linha acima | Supabase; dono | 26/09 |
| `SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS` | JSON de chaves | nenhum hoje (Passo 1 de `plano-rotacao-chaves-supabase.md`) | P, D | não consumidas | injetadas pela plataforma | não verificada (não listável) | não se aplica | Supabase | 26/09 |
| `ALLOWED_ORIGINS` | CSV de origens | `_shared/cors.ts:19` (as 7) | P definida; D ausente, vale o default `cors.ts:42-47` | condicional: sem ela vale o default; com ela, substitui a lista inteira | Edge Functions › Secrets | P: dono, 24-25/09. D: dono relata "só `RESEND_*`" | **pendente**: nenhum preflight contra a função publicada. `tests/onda1-cors-modais.test.mjs` prova a lógica com `Deno.env` simulado, não o valor | dono | 25/09 |
| `VERCEL_PREVIEW_PREFIX` | slug de projeto Vercel | `cors.ts:74` | P definida; D ausente, valem `rumo-a-aprova-o` e `triliva-producao` | condicional | Secrets | P: dono | **pendente**. Com a prévia do `triliva-producao` desligada, o efeito prático em P hoje é só a prévia do projeto cujo slug estiver no valor | dono | 25/09 |
| `VERCEL_PREVIEW_PREFIXES` | CSV de slugs | `cors.ts:71` (tem precedência sobre o singular) | nenhum | condicional | — | ausente nos dois (relato) | não se aplica | dono | 25/09 |
| `PASSWORD_RESET_REDIRECT_URL` | URL | `backoffice-coordenador/index.ts:50` | P definida; D ausente, vale `https://rumo-a-aprova-o.vercel.app/redefinir-senha` | condicional | Secrets | P: dono | **pendente**: nenhum e-mail de acesso de coordenação concluído e registrado. D: não conferido se o default está na lista de redirects do Auth do D | dono | 25/09 |
| `RESEND_API_KEY` | chave de API de terceiro (crítica) | `backoffice-coordenador/index.ts:134` | P, D | obrigatório para enviar; sem ela a função devolve estado `_pendente` | Secrets | P e D: dono | **pendente**: nenhum envio aceito pelo Resend registrado | dono | 25/09 |
| `RESEND_FROM_EMAIL` | remetente verificado | `backoffice-coordenador/index.ts:135` | P, D | obrigatório para enviar | Secrets | P e D: dono | **pendente** | dono | 25/09 |
| `verify_jwt = false` | flag de deploy | as 7 funções | P, D, L | obrigatório: as funções validam o token no código, e o gate da plataforma quebraria o preflight | `supabase/config.toml:81-106`, aplicado no deploy | `list_edge_functions`: `false` nas 7, nos dois projetos | L: **ok** (`e2e-local`). P e D: **pendente** | repo; dono | 26/09 |

## 3. Workflows (GitHub Actions)

O `ci.yml` não usa secret nenhum. O `codeql.yml` também não.

| Nome | Tipo | Consumidor | Ambiente | Obrig./cond. | Origem | Prova de presença | Prova funcional | Dono | Data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PROD_SUPABASE_URL` | URL | `manter-banco-acordado.yml:75` | GitHub → P | obrigatório: desde o #155, sem ele o passo reprova | secret de repositório | log do run `36133379313` (`URL: ***`). Ausente até 25/09 11:47 UTC (run `36131272062`, `URL:` vazio) | **ok**: HTTP 200 no run `36133379313`, e a batida aparece no log do gateway de P em 25/09 12:10:06 | dono | 25/09 |
| `PROD_SUPABASE_ANON_KEY` | chave | `manter-banco-acordado.yml:76` | GitHub → P | obrigatório | secret | idem | **ok**: idem. É a **anon legada** (JWT HS256, `role: anon`) | dono | 25/09 |
| `DEMO_SUPABASE_URL` | URL | `manter-banco-acordado.yml:157` | GitHub → D | obrigatório | secret | idem | **ok**: HTTP 200, batida no log de D em 25/09 12:10:07 | dono | 25/09 |
| `DEMO_SUPABASE_ANON_KEY` | chave | `manter-banco-acordado.yml:158` | GitHub → D | obrigatório | secret | idem | **ok**: idem, **anon legada** | dono | 25/09 |
| `TRILIVA_CAPTURA_COORD_EMAIL`, `_COORD_SENHA`, `_ALUNO_CODIGO`, `_ALUNO_SENHA`, `_RESP_CODIGO`, `_RESP_SENHA` (um conjunto, usado junto) | credenciais das contas de captura do D | `captura-pack-v2.yml:97-102` → `scripts/captura/pack-v2.mjs` | GitHub → D | condicional: o modo oficial exige; o ensaio sem segredo não captura | secrets de repositório | **não verificada**: a última execução (`36164451664`, 25/09 17:01, 26 s) não deixou requisição no log do D | **pendente** | dono | 25/09 |
| `CAPTURA_MODO`, `CAPTURA_TELA_18`, `CAPTURA_TELA`, `CAPTURA_BASE`, `CAPTURA_SAIDA`, `CAPTURA_BASE_URL` | parâmetros | `pack-v2.mjs:54-59` | runner | condicional | inputs do `workflow_dispatch` | não se aplica | não se aplica | repo | — |

## 4. Scripts de operador e de teste

| Nome | Tipo | Consumidor | Ambiente | Obrig./cond. | Origem | Prova de presença | Prova funcional | Dono | Data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` (scripts) | URL | `scripts/criar-coordenacao.mjs`, `criar-super-admin.mjs`, `corrigir-senha-codigo-0093.mjs`, `seed-auth-usuarios.mjs` | máquina do operador, contra P ou D | condicional: só quando o script roda | shell do operador (`.env` local, fora do repo) | não se aplica: não fica guardada em lugar nenhum | **pendente**: nenhuma execução registrada | dono | — |
| `SUPABASE_SERVICE_ROLE_KEY` (scripts) | chave secreta (crítica) | os mesmos 4 | idem | condicional | idem | idem | **pendente**. O valor a exportar passa a ser a secreta nova (Passo 5 do plano de rotação) | dono | — |
| `ADMIN_EMAIL`, `ADMIN_NOME`, `ADMIN_SENHA` | entrada do script | `criar-super-admin.mjs` | operador | condicional | shell | não se aplica | **pendente** | dono | — |
| `COORD_EMAIL`, `COORD_NOME`, `COORD_SENHA`, `ESCOLA_SLUG` | entrada do script | `criar-coordenacao.mjs` | operador | condicional | shell | não se aplica | **pendente** | dono | — |
| `SUPABASE_DB_URL` / `DATABASE_URL` | string de conexão (leva senha quando remota) | `scripts/manifesto-rpcs.mjs:164`, `scripts/checar-migrations.mjs:35` | L (CI); operador contra P ou D | condicional | L: `ci.yml:117` (Postgres do job). Operador: shell | L: arquivo | L: **ok**, passo "Contrato de RPCs" verde no run `36221482457`. P e D: **pendente** | repo; dono | 26/09 |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | conexão do Postgres de teste | `tests/reset-db.sh`, suíte `node --test` | L | obrigatório para a suíte | `ci.yml:56-60` (build-e-unitarios) e `ci.yml:246-250` (matriz-autorizacao); `.env.example` | arquivo | **ok**: `build-e-unitarios` verde no run `36221482457` | repo | 26/09 |
| `E2E_API_URL`, `E2E_ANON_KEY`, `E2E_SERVICE_ROLE_KEY`, `E2E_DB_URL`, `E2E_FUNCTIONS_URL`, `E2E_EDGE_URL`, `E2E_MAIL_URL`, `E2E_JWT_SECRET`, `E2E_RUN_ID`, `E2E_WORKDIR`, `E2E_FRONT_ORIGIN`, `E2E_HOSTS_INTERNOS`, `E2E_EXTRA_CA`, `E2E_MANTER_STACK`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` | ambiente da stack local | `scripts/e2e/*`, `app/e2e/*`, `app/playwright.config.js` | L (`e2e-local`) | obrigatório para o `e2e-local`; gerado a cada run | `scripts/e2e/stack.sh` escreve `$E2E_WORKDIR/local.env`. São as chaves de demonstração da CLI, válidas só na stack local; a trava (`scripts/e2e/trava.mjs`) recusa `*.supabase.co` | gerado a cada run | **ok**: `e2e-local` verde no run `36221495753` | repo | 26/09 |

## 5. Plataforma (painéis e agendamentos)

| Nome | Tipo | Consumidor | Ambiente | Obrig./cond. | Origem | Prova de presença | Prova funcional | Dono | Data |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Expiração do JWT: 3600 s | Auth | todo login | P, D | obrigatório | painel Auth; `config.toml` (L) | dono, 24-25/09, nos dois | P: **ok**, 212 req autenticadas em 25/09 com `exp − iat = 3600`. D: **ok em 19/09** (1.116 req); sem tráfego autenticado depois | dono | 25/09 (P), 19/09 (D) |
| Assinatura do JWT: ECC | Auth (chave de assinatura) | todo token de usuário | P, D | obrigatório | painel Auth › Signing Keys | dono, nos dois | P: **ok**, tokens `ES256` no log de 25/09. D: **ok em 19/09** (`ES256`) | dono | 25/09 (P), 19/09 (D) |
| Cadastro público desligado | Auth | `/auth/v1/signup` | P (o relato não diz se vale para o D) | obrigatório: só o backoffice cria conta | painel Auth; `config.toml:51` (L) | dono | **pendente**. Teste de leitura sugerido: `GET /auth/v1/settings` deve trazer `disable_signup: true`. Esta sessão não alcança `*.supabase.co` (proxy 403) | dono | 25/09 |
| Schema `app` fora da Data API | PostgREST (schemas expostos) | toda chamada REST | P (o relato não diz se vale para o D) | obrigatório | painel › Data API; `config.toml:8` (L) | dono | L: **ok**, `H.postgrest.accept_profile_app` (`app/e2e/http/camada-http.spec.js:44`) recebe `PGRST106`. P e D: **pendente**, falta o mesmo pedido contra o hospedado | dono | 25/09 |
| SMTP próprio pelo Resend | Auth › SMTP | e-mails do Auth (redefinição, convite) | P | obrigatório antes de aluno real | painel Auth | dono. O log do Auth de P tem, em 25/09 12:02 UTC, "Email limiter from 2/1h to 30", compatível com a troca para SMTP próprio | **pendente**: nenhum envio concluído registrado | dono | 25/09 |
| Site URL `app.trilivaedu.com.br` e 2 redirects | Auth › URL Configuration | links dos e-mails do Auth | P. D: não conferido | obrigatório | painel Auth | dono (os 2 redirects não foram listados no relato) | **pendente**: falta o fluxo de redefinição ponta a ponta no domínio real | dono | 25/09 |
| Prévia do `triliva-producao` desligada | Vercel (deploy de branch) | todo push fora da `main` | P | obrigatório: as duas `VITE_` têm alvo Preview e apontariam a prévia para o banco de P | painel Vercel | dono | **ok**: a prévia do PR #155 saiu "Ignored" em 26/09 05:40 UTC | dono | 26/09 |
| Prévia do `rumo-a-aprova-o` ligada | Vercel | todo push | D | condicional | painel Vercel | — | **ok**: prévia do #155 "Ready" (aponta para o banco do D) | dono | 26/09 |
| `virar-semana-diaria` (`5 3 * * *`) | pg_cron | `app.virar_semana()` | P, D | obrigatório | `supabase/migrations/0004_agendamento.sql` | `cron.job` ativo nos dois (`SELECT`, 26/09) | **ok**. P: 7 execuções `succeeded` em 7 dias, última 26/09 03:05 UTC, heartbeat global com 0 aluno com erro. D: 7 `succeeded`, `app.virada_saude()` = ok | repo; dono | 26/09 |
| `demo-virada-semanal` (`0 3 * * 1`), `demo-liberacao-diaria` (`10 3 * * *`) | pg_cron | `demo.virar_semana()`, `demo.liberar()` | D | condicional: só a vitrine | `supabase/demo/07_agendamento.sql:38-39` | ativos (`SELECT`, 26/09) | liberação: **ok**, 3 `succeeded` em 7 dias. Semanal: **pendente**, nenhuma execução em 7 dias (as 3 da diária indicam criação em 23/09, depois da última segunda-feira) | repo; dono | 26/09 |
| Chave publicável `default` | chave de cliente | site de P | P, D | obrigatório para a rotação | painel › API Keys | D: ativa (`get_publishable_keys`, 26/09). P: em uso no log de 25/09 | ver `VITE_SUPABASE_ANON_KEY` | dono | 26/09 |
| Anon legada (JWT HS256) | chave de cliente legada | keepalive (P, D); `app/.env.production` do D (build do CI e da captura); provavelmente o site do D | P, D | condicional: a Supabase encerra as legadas no fim de 2026 | painel › API Keys (legadas) | D: ativa (`get_publishable_keys`). P: aceita pelo gateway em 25/09 | **ok**: keepalive com HTTP 200 nos dois em 25/09 | dono | 25/09 |
| Secreta `default` (nova) | chave secreta | Edge Functions de P (valor injetado) | P, D | obrigatório para a rotação | painel › API Keys | P: em uso no log de 25/09. D: usada pelo próprio painel (`mgmt-api`) em 25/09 00:45 UTC; o plano de rotação marcava "NÃO VERIFICADO" | P: **ok** (linha `SUPABASE_SERVICE_ROLE_KEY`). D: **pendente** | dono | 25/09 |
| `service_role` legada | chave secreta legada | nenhum consumidor nosso visto no log de P de 25/09 | P, D | a desativar (Passo 6 do plano) | painel | não listável | não se aplica. Antes do Passo 6, conferir o "último uso" no painel | dono | 25/09 |

---

## 6. Quem usa cada chave (conferido nos logs do gateway)

Fonte: `query_logs` sobre `edge_logs` de cada projeto, agregando por tipo de
chave, serviço e cliente, sem exibir valor. P: janela de 25/09 00:00 a 26/09
00:00 UTC. D: janelas de 24 h de 19/09 a 26/09 05:40 UTC, com uma lacuna de
20/09 00:00 a 05:40.

| Consumidor | Produção, 25/09 | Demo |
| --- | --- | --- |
| Site (navegador) | **publicável**: 199 req REST e 19 de Auth. Os 10 erros de Auth são o `PATCH /auth/v1/user` → 405 (corrigido no #147), senha errada e logout de sessão vencida; nenhum é de chave | **não medido desde 19/09**: não há tráfego de navegador com chave de 20/09 até agora. Em 19/09, **anon legada**, a mesma do `app/.env.production` (mesmo `iat` e prefixo de assinatura), em 45 req de navegador e 1.074 da captura. A variável da Vercel não mudou desde 03/07, então o site do D provavelmente ainda usa a anon legada |
| Edge Functions | **secreta nova**: 10 req REST e 6 de Auth, 0 erro | nenhuma chamada das 7 funções no log retido. As 18 chamadas de 19/09 com a secreta nova (`POST /auth/v1/admin/generate_link`) coincidem com a captura que usava a `capture-oidc-20260919` |
| Keepalive | **anon legada**: 1 req, HTTP 200, 12:10:06 | **anon legada**: 1 req, HTTP 200, 12:10:07 |
| Painel da Supabase (`mgmt-api`) | publicável, secreta nova e JWT interno `supabase_admin` | idem |

**Conclusão:** em produção a afirmação do dono se confirma. O keepalive é o
último consumidor da anon legada ali. No demo o quadro é outro: o keepalive, o
`app/.env.production` (build do CI e da captura) e, provavelmente, o próprio
site ainda dependem da anon legada. Desativar as legadas no demo primeiro, como
manda o plano de rotação, derrubaria a vitrine se a variável da Vercel do demo
não for trocada antes.

Consequências para `plano-rotacao-chaves-supabase.md`:

1. **Passo 4 antes do Passo 6, nos dois projetos.** Com a legada desativada, o
   keepalive recebe 401. Desde o #155 isso deixa o workflow vermelho, que é o
   comportamento certo, mas o seguro para de funcionar até a troca. A troca
   exige tirar o `Authorization: Bearer` do workflow, porque a publicável é
   recusada nesse cabeçalho.
2. **Passo 1 pode ser menor do que o previsto.** Em produção, o valor injetado
   sob `SUPABASE_SERVICE_ROLE_KEY` já é a secreta nova. Falta confirmar se o
   demo está igual e se a plataforma mantém essa correspondência depois de
   desativar as legadas.

## 7. Endpoint `logs.all` da Supabase

**Nenhum script usa.** Buscas feitas em 26/09:

```bash
grep -rn -i "logs\.all\|logs_all\|analytics/endpoints\|api\.supabase\.com\|SUPABASE_ACCESS_TOKEN\|sbp_" \
  --exclude-dir=node_modules --exclude-dir=.git .
git log --all --oneline -S "logs.all"
git log --all --oneline -S "analytics/endpoints"
```

Nenhuma ocorrência em código, workflow ou script, nem no histórico de nenhum
branch. O repositório também não tem token de Management API. As consultas de
log deste documento foram feitas pelo MCP da Supabase desta sessão, não por
script do repositório.

---

## 8. Lacunas de alerta

Nada foi contratado. Os preços são das páginas de preço dos fornecedores,
consultadas por busca em 26/09/2026 (fontes no fim). Conferir no dia da
configuração.

### Resumo

| Lacuna | Hoje | Opção recomendada | Custo |
| --- | --- | --- | --- |
| 8.1 Erro do front | só console | Edge Function própria + tabela | R$ 0 |
| 8.2 Backup | **nenhum backup** de P ou D registrado | dump criptografado por workflow agendado, com teste de restauração | R$ 0 |
| 8.3 Monitoramento | nenhum monitor externo | monitor gratuito (Better Stack ou UptimeRobot) no site e na REST | R$ 0 |
| 8.4 Falha da virada | sinal existe, ninguém é avisado | heartbeat externo chamado pelo banco ao fim da virada | R$ 0 |
| 8.5 Falha do keepalive | job vermelho desde o #155 | e-mail de falha do próprio GitHub | R$ 0 |
| 8.6 Keepalive não rodou | nada avisa | heartbeat externo pingado pelo job, com a REST monitorada como segunda batida | R$ 0 |

Um único plano gratuito do Better Stack (10 monitores, 10 heartbeats) comporta
os 4 monitores de 8.3 e os 4 heartbeats de 8.2, 8.4 (P e D) e 8.6.

### 8.1 Erro do front

**Hoje:** `observabilidade.js` escreve no console e, se `VITE_ERROR_REPORT_URL`
existir, faz um POST com um JSON próprio (`mensagem`, `pilha`, `origem`, `em`,
`rota`). A variável não existe em nenhum projeto. Dois fatos derrubam a
recomendação antiga de "apontar para o Sentry" (EST0 A4, handoff do EST1-B):

- o corpo não segue o protocolo do Sentry, então apontar a variável para a
  ingestão dele não registra nada sem mudar código;
- a CSP (`vercel.json`) libera `connect-src` só para `'self'` e
  `*.supabase.co`, então o navegador bloqueia qualquer coletor externo.

O build também não publica sourcemap, então a pilha chega minificada em
qualquer opção.

| Opção | Custo | Trabalho | Fraqueza |
| --- | --- | --- | --- |
| A. Edge Function `relatar-erro` gravando numa tabela | R$ 0 (dentro da cota do plano free) | 1 função, 1 migration, teto de tamanho e de taxa | endpoint público sem login; sem teto vira depósito de lixo no banco de 500 MB. Continua precisando de entrega do alerta (8.3/8.4) |
| B. Sentry, plano Developer | R$ 0 até 5 mil erros/mês, 1 usuário; Team a US$ 26/mês | SDK no front, domínio de ingestão na CSP | novo operador de dados fora do Brasil (rota e mensagem podem carregar identificador) |
| C. Better Stack (exceções) | free com cota de exceções | SDK compatível com Sentry, CSP | mesmo ponto de B |

**Recomendação:** A. Passa na CSP sem mudança e não acrescenta operador de
dados. B só se o agrupamento pronto de erros valer a mudança de CSP e o
operador novo.

### 8.2 Backup

**Hoje:** P e D estão no plano free, que não tem backup gerenciado. Não há
registro de dump executado de nenhum dos dois: `docs/e1-migrations.md:691`
descreve o comando e diz que ele não foi rodado, e
`docs/operacao/aplicacao-e2-0055-0058.md:12` diz que não houve `pg_dump`. Antes
de alerta de falha de backup, falta o backup.

| Opção | Custo | Trabalho | Fraqueza |
| --- | --- | --- | --- |
| A. Workflow agendado com `pg_dump` criptografado (chave pública no repo, privada offline com o dono), guardado como artefato | R$ 0 (Actions é gratuito em repositório público) | 1 workflow, 1 secret com a string de conexão, 1 teste de restauração em banco local | o repositório é público: sem criptografia, o artefato fica baixável por qualquer conta. Artefato vive no máximo 90 dias. `pg_dump` sem superusuário não leva o schema `auth` (`docs/e1-migrations.md:454`), então as contas não voltam desse dump |
| B. Supabase Pro | US$ 25/mês por organização; backup diário com 7 dias de retenção; PITR é add-on pago à parte | nenhum código | custo recorrente; decisão registrada é ficar no free até haver receita (`manter-banco-acordado.md`). Também acaba com o pause por inatividade |
| C. Dump manual semanal pelo dono | R$ 0 | nenhum | depende de memória; é o estado atual, e nunca aconteceu |

**Recomendação:** A, com restauração testada antes do primeiro aluno real e um
heartbeat no fim do job (como em 8.6) para avisar quando o backup não rodar.
B quando houver receita.

### 8.3 Monitoramento (disponibilidade)

**Hoje:** nenhum monitor externo. O único sinal diário é o keepalive, que
chega 5 a 6 horas atrasado (8.6).

| Opção | Custo | Limites do gratuito | Fraqueza |
| --- | --- | --- | --- |
| A. Better Stack | R$ 0 | 10 monitores, 10 heartbeats, checagem a cada 3 min, e-mail | cota de monitores curta se crescer |
| B. UptimeRobot | R$ 0 | 50 monitores, checagem a cada 5 min, heartbeat | o gratuito proibiu uso comercial em out/2024; a central de ajuda diz que a proibição caiu em 2026. Conferir os termos no cadastro |
| C. healthchecks.io | R$ 0 | 20 checks, 3 membros; só heartbeat, não faz uptime | não serve para disponibilidade |

O que monitorar: `app.trilivaedu.com.br` e o site do demo (200 e um texto do
HTML), e a REST de P e de D com
`GET /rest/v1/concursos?select=id&limit=1`, só com o cabeçalho `apikey` da
publicável, **exigindo 200 exato** (401 e 403 são chave errada).

Esse monitor da REST tem um efeito a mais: é requisição de API vinda de fora,
a mesma coisa que o keepalive faz. Com checagem de minutos, ele vira uma
segunda batida que não depende do agendador do GitHub.

**Recomendação:** A, porque cobre também os heartbeats de 8.2, 8.4 e 8.6 numa
conta só. B se a cota de 10 apertar.

### 8.4 Falha da virada

**Hoje:** o sinal existe e ninguém é avisado. A virada grava heartbeat
(`virada_execucoes`, migration 0039), `app.virada_saude()` interpreta
(0043/0050) e o backoffice mostra, mas só para quem abrir o painel do
super_admin. Em 26/09 as duas estavam saudáveis (seção 5).

| Opção | Custo | Trabalho | Fraqueza |
| --- | --- | --- | --- |
| A. Heartbeat externo chamado pelo próprio banco: ao fim da virada, `pg_net` faz GET na URL do heartbeat; com `alunos_com_erro > 0`, chama a URL de falha | R$ 0 | 1 migration (`pg_net`, URL guardada no Vault) | a URL permite ping falso a quem a tiver (baixo impacto) |
| B. O workflow diário consulta a saúde e reprova com `ok = false` | R$ 0 | expor uma leitura a um papel que o workflow alcance (hoje `virada_saude` é interna e `backoffice_virada_saude` exige super_admin) | herda o atraso de 5 a 6 h e a desativação de 60 dias do agendador |
| C. `pg_cron` + `pg_net` + Resend, e-mail direto do banco | R$ 0 (Resend free: 3 mil/mês, 100/dia; cota dividida com os e-mails do produto se for a mesma conta) | 1 migration | quem vigia é o mesmo banco que falhou: se o `pg_cron` parar, o alerta para junto |

**Recomendação:** A. O vigia fica fora do banco, então o silêncio de um
`pg_cron` morto também dispara o alerta.

### 8.5 Falha do keepalive

**Hoje (depois do #155):** secret ausente, 401, 403, 5xx ou nenhuma resposta
deixam o job vermelho. O GitHub manda e-mail de execução agendada que falhou
para quem criou o workflow, ou para quem alterou por último a linha `cron`, ou
para quem o reativou depois de desativado. Isso só acontece se essa pessoa
tiver a notificação de Actions ligada (*Settings › Notifications › Actions*,
"only notify for failed workflows"). Custo: R$ 0.

**Prova funcional: pendente.** Não houve falha depois do #155, e o e-mail não
foi testado. Testar sem apagar secret exige um disparo manual que falhe de
propósito (por exemplo, um input `simular_falha` no `workflow_dispatch`, que
seria outro PR). Execução manual notifica quem disparou, não o destinatário das
agendadas; o teste confirma o canal de e-mail, não a regra do agendamento.

Falha previsível: quando a anon legada for desativada (plano de rotação, até
01/12/2026), o keepalive vai dar 401. O alerta estará certo, mas o seguro
estará desligado. O Passo 4 vem antes.

### 8.6 Keepalive não rodou (atraso ou ausência)

Execução que não acontece não gera e-mail. E o agendador do GitHub atrasa:

| Dia | Agendado (UTC) | Início real (UTC) | Atraso | Batida real? |
| --- | --- | --- | --- | --- |
| 19/09 | 06:17 | 10:54 | 4h37 | não (secrets ausentes) |
| 20/09 | 06:17 | 11:18 | 5h01 | não |
| 21/09 | 06:17 | 12:43 | 6h26 | não |
| 22/09 | 06:17 | 11:33 | 5h16 | não |
| 23/09 | 06:17 | 11:30 | 5h13 | não |
| 24/09 | 06:17 | 11:40 | 5h23 | não |
| 25/09 | 06:17 | 11:46 | 5h29 | não; a primeira batida real foi o disparo manual das 12:10 |

A documentação do GitHub diz que o evento `schedule` atrasa sob carga e que,
com carga alta o bastante, execuções na fila podem ser descartadas. Em
repositório público, workflows agendados são desativados depois de 60 dias sem
atividade no repositório. Nenhum dos três casos gera execução vermelha: o
workflow simplesmente não roda.

| Opção | Custo | Trabalho | Fraqueza |
| --- | --- | --- | --- |
| A. Heartbeat externo (Better Stack ou healthchecks.io): o último passo do job faz GET na URL do heartbeat só se as duas batidas deram 200; período de 24 h, folga de 12 h (o atraso observado chegou a 6h26) | R$ 0 | 1 passo no workflow, 1 secret (PR futuro) | avisa depois de até 36 h sem batida, dentro da janela de 7 dias do pause |
| B. Monitor da REST de 8.3 como segunda batida | R$ 0 | só a configuração do monitor | não avisa que o workflow parou; torna a parada inofensiva |
| C. Segundo workflow do GitHub conferindo o primeiro | R$ 0 | 1 workflow | mesmo agendador: atraso, descarte e desativação de 60 dias atingem os dois juntos. Não recomendado |
| D. Supabase Pro | US$ 25/mês por organização | nenhum | acaba o pause por inatividade e o keepalive deixa de ser necessário; é custo recorrente |

**Recomendação:** A mais B. A avisa, B tira a dependência de um único
agendador.

---

## 9. Divergências com outros documentos

Achadas neste levantamento. Não corrigidas aqui, para o PR ficar só com o
inventário.

| Documento | Diz | Estado em 26/09 |
| --- | --- | --- |
| `ambientes-e-variaveis.md:14-22` | um projeto único de demo e produção | produção separada (`zckyhihxjjbnqjqilymn`, `sa-east-1`, criada em 03/09) |
| `ambientes-e-variaveis.md:40` | `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` como secrets opcionais do GitHub | o job hospedado saiu na Etapa 3; os nomes agora são gerados pela stack local |
| `ambientes-e-variaveis.md:48-52` | três funções carregam cópia própria do CORS | as 7 importam `_shared/cors.ts` |
| `ambientes-e-variaveis.md:45-46` | default de preview só `rumo-a-aprova-o` | defaults `rumo-a-aprova-o` e `triliva-producao` (`cors.ts:68`) |
| `plano-rotacao-chaves-supabase.md:39` | secreta nova "NÃO VERIFICADO" | em uso pelas Edge Functions de P (seção 6) |
| `plano-rotacao-chaves-supabase.md:56` | keepalive com "secrets ainda não criados" | criados em 25/09, entre 11:47 e 12:10 UTC |
| `ambiente.js:2-4` e `.env.example` | `VITE_APP_ENV` definida no projeto do demo | ausente nos dois projetos |

## Fontes externas (26/09/2026)

- GitHub, notificações de workflow: https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs
- GitHub, desativação de workflow agendado: https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow
- GitHub, evento `schedule` (atraso e descarte): https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- healthchecks.io, planos: https://healthchecks.io/pricing/
- Better Stack, uptime: https://betterstack.com/uptime
- UptimeRobot, uso comercial do plano gratuito: https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan
- Sentry, preços (resumo indexado): https://costbench.com/software/developer-tools/sentry/free-plan/
- Supabase, preços (resumo indexado): https://uibakery.io/blog/supabase-pricing
- Resend, preços: https://resend.com/docs/knowledge-base/what-is-resend-pricing
