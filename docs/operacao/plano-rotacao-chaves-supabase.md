# Plano de rotação da `service_role` (C-S03)

**Estado:** PLANO. Nada aqui foi executado. Cada passo que mexe em ambiente
hospedado precisa de aprovação do dono, em prompt próprio, como as
migrations 0053 a 0057.

**Escrito em:** 24/09/2026, Etapa 2, Fatia 6. Fontes da Supabase consultadas
no mesmo dia (links no fim). Nenhum valor de chave aparece neste arquivo.

## Por que rotacionar

1. **A chave ficou exposta a mais gente do que precisava.** Em 21/09 o
   projeto Vercel `triliva-producao` tinha `SUPABASE_SERVICE_ROLE_KEY` em
   Production **e Preview** (`docs/e0-baseline.md`, tabela "PRODUÇÃO — 8
   variáveis"). O build roda `npm install`, e os dois projetos constroem
   preview de toda branch, inclusive as de bot. Qualquer script de
   instalação de dependência, em qualquer preview, lia a chave. Não há
   indício de vazamento, e também não há como auditar isso: o Vercel não
   guarda o que um build leu do ambiente.
2. **As chaves legadas têm prazo.** A Supabase avisa que `anon` e
   `service_role` legadas "keep working until the end of 2026". A migração
   para as chaves novas acontece de um jeito ou de outro até 31/12/2026.
   Fazer agora transforma a obrigação na rotação que a C-S03 pede.
3. **O caminho antigo não existe mais.** A Supabase diz que "it is no
   longer possible to rotate the legacy anon, service and JWT secrets".
   Mesmo quando existia, trocar o JWT secret legado deslogava todo mundo e
   trocava `anon` e `service_role` ao mesmo tempo.

**Prazo proposto:** antes do primeiro aluno real, e nunca depois de
**01/12/2026** (um mês de folga antes do fim das legadas).

## O que já está feito (medido em 24/09)

| Item | Estado | Como foi medido |
| --- | --- | --- |
| Vercel `triliva-producao` | só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; `hiddenProductionEnvCount: 0` | `filter_project_envs`, sem decriptar |
| Vercel `rumo-a-aprova-o` (demo) | as mesmas duas | idem |
| Chave publicável nova (`default`) | existe e está ativa em demo e produção | `get_publishable_keys` |
| Chave secreta nova (`default`) | **NÃO VERIFICADO**: a ferramenta só lista as publicáveis | o dono confere em *Settings > API Keys* |
| Bundle | só JWT de papel `anon`; sem `sb_secret_`; sem sourcemap | teste `E2/C-S03` em `tests/sec3-endurecimento-edge.test.mjs`, no CI, sobre o build do próprio job |
| Bundle publicado em produção | **NÃO VERIFICADO** diretamente: a ferramenta do Vercel não lê os arquivos do deploy, e a rede desta sessão não alcança o domínio | Por construção é o mesmo código; as `VITE_` de produção não são legíveis (tipo `sensitive`) |
| Variáveis compartilhadas do time Vercel | **NÃO VERIFICADO**: a ferramenta não lista | o dono confere em *Team Settings > Environment Variables* |

## Quem usa cada chave hoje

| Consumidor | Chave | Onde | Muda para |
| --- | --- | --- | --- |
| `_shared/contexto.ts` (gerar-meta, lgpd-titular, virar-semana) | `service_role` | `supabase/functions/_shared/contexto.ts:12` | secreta |
| provisionar-aluno | `service_role` | `supabase/functions/provisionar-aluno/index.ts:26` | secreta |
| revogar-responsavel | `service_role` | `supabase/functions/revogar-responsavel/index.ts:16` | secreta |
| trocar-senha | `service_role` | `supabase/functions/trocar-senha/index.ts:25` | secreta |
| backoffice-coordenador | `service_role` | `supabase/functions/backoffice-coordenador/index.ts:31` | secreta |
| Porteiro da virar-semana | compara o `Bearer` com a `service_role` | `supabase/functions/virar-semana/index.ts:48-51` | aceitar a secreta no cabeçalho `apikey` |
| Scripts de operador | `service_role` pelo ambiente | `scripts/criar-coordenacao.mjs`, `criar-super-admin.mjs`, `corrigir-senha-codigo-0093.mjs`, `seed-auth-usuarios.mjs` | secreta (só troca o valor) |
| Front | `anon` | `app/src/lib/supabase.js:7`, `app/src/shared/data/index.js:825`, Vercel (2 projetos), `app/.env.production` | publicável |
| Keepalive | `anon` (secrets ainda não criados) | `.github/workflows/manter-banco-acordado.yml:97-98` e `:176-177` | publicável, **sem** o `Authorization: Bearer` |
| E2E no CI | `anon` de projeto isolado (`E2E_SUPABASE_ANON_KEY`, opcional) | `docs/operacao/e2e-ambiente.md` | publicável do projeto isolado |
| pg_cron | nenhuma | os três jobs chamam SQL direto (`select app.virar_semana()`), sem HTTP | nada |

As 7 funções usam `verify_jwt = false` (`supabase/config.toml`) e validam o
usuário com `admin.auth.getUser(token)`. Isso as deixa prontas para a
migração seguinte, de JWT secret para chaves de assinatura, que quebra
quem depende do `verify_jwt` da plataforma.

## Ordem de execução

Demo primeiro, sempre. Produção só depois de o demo passar um dia inteiro
sem erro.

### Passo 0: conferências do dono (painel, sem mudar nada)

- *Settings > API Keys*, aba das chaves novas: confirmar que existe a
  secreta `default` nos dois projetos. Se não existir, criar (não afeta as
  legadas).
- *Edge Functions > Secrets*: confirmar que `SUPABASE_SECRET_KEYS` e
  `SUPABASE_PUBLISHABLE_KEYS` aparecem.

### Passo 1: código das funções (PR próprio, sem aplicar)

- Um ajudante em `_shared/` que devolve a secreta:
  `JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS"))["default"]`, com a
  `SUPABASE_SERVICE_ROLE_KEY` como alternativa **só durante a transição**,
  para que o mesmo deploy funcione antes e depois da desativação.
- As 5 funções que instanciam cliente passam a usar o ajudante.
- `virar-semana`: o porteiro aceita a secreta no cabeçalho `apikey`
  (comparação em tempo constante, como hoje). A Supabase recusa chave nova
  no `Authorization: Bearer`. O `Bearer` com a legada continua aceito até
  o Passo 6.
- Testes: inspeção de fonte e execução com `Deno.env` simulado, a mesma
  técnica do teste de CORS da Fatia 5.

### Passo 2: publicar as funções (aprovação do dono)

Redeploy das 7 no demo. Verificação (E3): uma chamada de cada função pelo
fluxo da tela, e a `virar-semana` com a secreta no `apikey`, escopada à
escola de teste.

### Passo 3: front com a chave publicável

- Vercel: trocar o valor de `VITE_SUPABASE_ANON_KEY` pela publicável do
  projeto certo, nos dois projetos, e refazer o deploy. O nome da
  variável pode ficar; trocar o nome é outro PR.
- `app/.env.production`: publicável do demo (é a que o CI usa).
- Verificação: login por código, login de coordenação, recuperação de
  senha (a `redefinirSenha` manda a chave no `apikey`, o que funciona com
  a publicável) e uma Edge Function chamada pela tela.

### Passo 4: keepalive

O workflow manda a chave também como `Authorization: Bearer`. Com a
publicável isso é recusado ("You can't send a publishable or secret key in
the Authorization: Bearer header"). Tirar essa linha nos dois passos e
criar os secrets já com a publicável. **Até esse ajuste, os secrets do
keepalive (item da E0) devem receber a `anon` legada.**

### Passo 5: scripts de operador

Só o valor muda: quem roda passa a exportar a secreta na variável que o
script já lê. Os scripts rodam do terminal (sem `User-Agent` de navegador),
então a proteção "401 se vier de navegador" da secreta não os atinge.

### Passo 6: desativar as legadas

- *Settings > API Keys*: conferir o indicador de "último uso" das legadas.
  Só seguir se nada as usou depois do Passo 5.
- Desativar `anon` e `service_role` legadas no demo. **É reversível**:
  dá para reativar no mesmo lugar.
- Observar 24 h (logs das funções, do PostgREST e do keepalive).
- Repetir em produção.
- A partir daqui, quem tinha a `service_role` antiga não entra mais. Essa é
  a rotação de fato.

### Passo 7, separado e opcional agora: chaves de assinatura do JWT

Migrar o JWT secret legado para chaves de assinatura assimétricas. Não
desloga ninguém, segundo a Supabase, e fecha o último uso do segredo
compartilhado. Esperar pelo menos o JWT expiry mais 15 minutos antes de
revogar o segredo legado.

## Reversão

| Passo | Como desfazer |
| --- | --- |
| 1 e 2 | Redeploy da versão anterior das funções (o ajudante com alternativa legada torna isso desnecessário) |
| 3 | Voltar o valor da variável no Vercel e refazer o deploy |
| 4 | Voltar o workflow |
| 6 | Reativar as legadas no painel |

## O que o dono faz, e o que o Claude faz

| Ação | Quem |
| --- | --- |
| Passo 0 (conferir e criar chave no painel) | dono |
| Passo 1 (PR das funções, com testes) | Claude |
| Passo 2 (publicar) | Claude, **depois** da aprovação escrita do dono |
| Passo 3 (valor no Vercel) | dono cola o valor; Claude faz o PR do `.env.production` |
| Passo 4 (workflow e secrets) | Claude no workflow; dono cria os secrets |
| Passo 5 (scripts) | quem roda os scripts |
| Passo 6 (desativar) | dono |

## Fontes

- Supabase, *Migrating to publishable and secret API keys*:
  https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- Supabase, *JWT Signing Keys*:
  https://supabase.com/docs/guides/auth/signing-keys
- Supabase, *Rotating Anon, Service, and JWT Secrets*:
  https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd
