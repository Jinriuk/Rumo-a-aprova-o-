# Ambiente E2E: stack Supabase local e descartável (Etapa 3)

> Regra que vale desde a Fase 17.2 e ficou mais forte: **o E2E nunca
> escreve no demo nem na produção, e não depende de projeto na nuvem.**
> A suíte sobe um Supabase inteiro no próprio runner, usa, e derruba.

## Por que mudou

Até a Etapa 3 o job `e2e` só rodava com um terceiro projeto hospedado
(`secrets.E2E_SUPABASE_URL`) e, sem ele, pulava com `::warning::`. Esse
projeto nunca existiu, então o E2E nunca rodou. Em 25/09 o teste manual de
produção achou dois defeitos que um E2E teria pegado: `PATCH
/auth/v1/user` dava 405 na redefinição de senha, e embeds ambíguos da 0055
davam 300. O desenho antigo (projeto E2E hospedado, secrets, `e2e-guard`)
saiu do CI.

## Os três ambientes

| Ambiente | Para quê | Onde |
|---|---|---|
| Produção | clientes reais | projeto Supabase de produção. O E2E nunca aponta para ele |
| Demo comercial | apresentação e vendas | projeto do demo. O E2E nunca aponta para ele |
| **E2E** | CI e máquina de quem desenvolve | **stack local da CLI do Supabase**, criada e destruída a cada execução |

## O desenho

```
scripts/e2e/rodar.sh
  ├─ stack.sh subir        CLI fixada → Postgres 17, Auth, PostgREST, Kong,
  │                        Edge Runtime (7 funções), Mailpit; prontidão real
  ├─ banco.sh              trava (marcar) → 59 migrations por psql → seeds
  │                        (menos 04 e 21) → tira o cron da virada → trava (conferir)
  ├─ semear.mjs            trava → fixture da matriz → usuários pela API admin local
  ├─ front.sh              trava → vite build --mode e2e → conferir-bundle.sh
  └─ playwright test       globalSetup = trava inteira → projetos http, desktop, mobile
```

| Peça | O que garante |
|---|---|
| `stack.sh` | CLI **2.118.0** (a mesma versão fixa as imagens). O Postgres é **17**, o mesmo major do remoto (17.6). A espera é pela prontidão real de Postgres, Auth, PostgREST, Mailpit e Edge Functions, não por tempo fixo. Studio, analytics, realtime e storage ficam desligados. Diretório temporário com `migrations/` vazio, porque a CLI para no prefixo 0047 duplicado e a cadeia vai por `psql`. |
| Segredos das funções | Todos locais: `ALLOWED_ORIGINS` é o front do runner, o link de redefinição volta para ele, e `RESEND_API_KEY` não existe (nenhum e-mail sai). Nada de chave do demo, da produção ou `capture-oidc`. |
| `local.env` | É gerado pela stack: URLs, chave anon, chave de serviço, Mailpit e Edge Runtime direto. Os nomes antigos `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` também são escritos aqui, **com os valores da stack local**. Nunca vêm de secret do GitHub, e a trava confere os dois. |
| `trava.mjs` | Antes de criar usuário, rodar seed, buildar ou testar, exige três coisas: host local (`127.0.0.1`, `localhost` ou interno declarado em `E2E_HOSTS_INTERNOS`), id de execução e o marcador da fixture **no próprio banco** (`e2e_local.execucao`). Recusa `*.supabase.co/.com/.in` sempre, mesmo declarado como interno. |
| `front.sh` + `conferir-bundle.sh` | `--mode e2e` não lê o `app/.env.production`. O bundle tem de conter a URL local e não pode citar nenhum projeto hospedado. |
| Guarda de rede (`app/e2e/local/base.js`) | Todo contexto de navegador do teste fala só com `127.0.0.1`. Chamada a `*.supabase.co` reprova. A contagem por teste vai para `rede.jsonl`. |
| E-mail | Recuperação e ativação chegam ao **Mailpit local**. O teste lê o link por lá. |

## Jornadas e o portão do job

As jornadas obrigatórias e o mínimo de testes críticos de cada uma estão
em `scripts/e2e/jornadas.mjs`. Cada teste leva a tag `@j:<jornada>`, e os
que contam para o mínimo levam também `@critica`. A tabela está em
`app/e2e/README.md`.

`scripts/e2e/relatorio-jornadas.mjs` roda depois da suíte, mesmo quando
ela falha. Ele liga cada jornada aos testes executados, escreve a tabela no
resumo do job e **reprova** quando:
- nenhum teste rodou;
- uma jornada crítica rodou menos que o mínimo, inclusive zero;
- um teste crítico foi pulado, falhou ou só passou na repetição;
- o navegador tentou falar com projeto hospedado;
- nenhum teste de navegador chamou a API local.

Nada de skip condicional. O projeto `mobile` só roda o `mobile.spec.js` e o
`desktop` o exclui, então nenhum teste nasce pulado por viewport.

## O job no CI (`e2e-local`)

1. **Provas negativas** (`scripts/e2e/provas-negativas.sh`): cada configuração errada tem de falhar, e os dois controles têm de passar. Os casos:
   - API ou banco num projeto hospedado;
   - `E2E_SUPABASE_URL` hospedado;
   - projeto hospedado declarado como interno;
   - host que não é local;
   - execução sem id;
   - bundle que cita o demo;
   - bundle sem a URL local.
2. Stack, banco, fixture, front e a **suíte inteira**.
3. Relatório de jornadas: o portão descrito acima, com `if: always()`. O
   passo tem `id: relatorio` e publica o resumo como saída do job.
4. **Artefatos sanitizados** (`scripts/e2e/sanitizar-artefatos.mjs`), com `if: always()`:
   - Sobem só os JSON e MD dos resultados, e o `error-context` e o screenshot de quem falhou.
   - Tudo passa por redação: JWT, chaves, access e refresh tokens, senhas da fixture. Depois há uma varredura final.
   - Nunca sobem trace, vídeo, relatório HTML nem estado de autenticação. Se existir estado de autenticação salvo no app, o passo reprova.
5. **Derrubar a stack** com `if: always()`, mesmo em erro.

O job **não usa secret nenhum**. Desde a Etapa 5, o `release-gate` exige
que ele termine em `success` e refaz o portão a partir da saída
`relatorio` do passo 3 (SHA do checkout e cada teste com tags e status):
ver [`release-gate.md`](release-gate.md). A guarda estática
`tests/ci-e2e-local.test.mjs` reprova, no gate `build-e-unitarios`, o PR
que fizer uma destas coisas:
- recolocar skip ou secret;
- tirar o `if: always()`;
- publicar artefato cru.

## Como rodar na máquina

```bash
(cd app && npm ci) && (cd tests && npm ci)
(cd app && npx playwright install chromium)
bash scripts/e2e/rodar.sh                    # tudo, derruba a stack no fim
E2E_MANTER_STACK=1 bash scripts/e2e/rodar.sh # mantém a stack para iterar
cd app && npx playwright test aluno.spec     # contra a stack já de pé
node scripts/e2e/relatorio-jornadas.mjs      # o portão, localmente
bash scripts/e2e/stack.sh parar
```

Requisitos: Docker, CLI do Supabase na versão do CI, `psql` e Node 22.
Máquina atrás de proxy com TLS próprio: `E2E_EXTRA_CA=<bundle.crt>` (o
Deno das funções baixa módulos do `jsr.io`). Onde o ECR da Supabase não é
alcançável: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. Chromium de
outra versão: `PW_CHROMIUM_PATH`.

Depois de uma execução, `node scripts/e2e/registrar-camada-http.mjs` grava
o observado dos 15 casos da `camada_http` em
`docs/evidencias/e2-matriz-autorizacao.json`.

## Diferenças da stack local (o que ela NÃO prova)

- **CORS:** o Kong local responde o preflight das funções com `*` antes do
  código delas. O caso `H.edge.options_cors` fala direto com o Edge Runtime
  (`E2E_EDGE_URL`, IP do container, declarado como interno para a trava).
- **Limite de login:** o GoTrue da CLI não limita `/token` (falta
  `GOTRUE_RATE_LIMIT_HEADER`). O limite do hospedado não é observável aqui.
- **Intervalo entre e-mails:** 1 s na stack local. No hospedado é maior. A
  jornada do super admin espera o intervalo a partir do `recovery_sent_at`.
- **Data:** a virada roda com `p_hoje` controlado. `now()` do Postgres não é
  congelado. A regra de `app.hoje_local()` é conferida à parte, com a sessão
  em três fusos.
- **Porta:** o Postgres da suíte `node --test` e o da stack usam 54322. No
  CI estão em jobs separados. Na máquina, suba um dos dois em outra porta.
- **Postgres da suíte unitária:** desde a Etapa 5, o `build-e-unitarios`
  e o `matriz-autorizacao` rodam em `postgres:17` (vanilla), o mesmo major
  do remoto (17.6) e da stack local. Até a Etapa 4 era o 15.

## Histórico

Até a Etapa 3 este documento descrevia o projeto E2E hospedado (Fase
17.2), os secrets `E2E_SUPABASE_*` e o `e2e-guard`. Esse desenho foi
retirado. O registro do episódio de flaky da área do aluno (Fase 17)
também ficou para trás: a causa era o banco do demo, remoto e
compartilhado, que o E2E não usa mais.
