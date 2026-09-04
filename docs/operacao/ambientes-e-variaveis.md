# Ambientes e variáveis (Fase A.2)

> Regra absoluta: **`service_role` nunca aparece no front, nunca entra no
> repositório.** O front só recebe a chave `anon` pública — a segurança é
> a RLS no banco, não o segredo da chave.

## Ambientes hoje

| Ambiente | Onde roda | Banco | Uso |
|---|---|---|---|
| **Desenvolvimento local** | máquina do dev (`npm run dev`) | Postgres local (`tests/reset-db.sh`) ou projeto demo | trabalho do dia a dia |
| **CI** (`build-e-unitarios`) | GitHub Actions | Postgres efêmero (container `postgres:15`) | migrations + seed 2x + testes unitários/RLS, descartado a cada run |
| **CI** (`e2e`) | GitHub Actions | projeto Supabase de demo, ou projeto isolado se `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` estiverem configurados (ver `docs/operacao/e2e-ambiente.md`) | suíte Playwright contra build real |
| **Demo/produção atual** | Vercel (front) + Supabase `bdjkgrzfzoamchdpobbl` | projeto único, região us-east-1, rotulado "demo" | demonstração — **não** dado real de aluno (ver `docs/operacao/lgpd-e-infra.md`, gate de região) |

Não há hoje um ambiente de "staging" separado do "produção/demo": é o
mesmo projeto Supabase + o mesmo deploy Vercel. Para o piloto real, a
decisão já registrada em `lgpd-e-infra.md` é **não** colocar dado real de
aluno nesse projeto — é preciso um projeto novo em `sa-east-1` antes
disso (ver checklist daquele documento). Essa separação (demo ≠ piloto
real) é tratada como ambiente lógico distinto mesmo usando a mesma
plataforma.

## Variáveis de ambiente

Modelo completo em `.env.example` (raiz do repo). Nunca commitar um
`.env` real — `.gitignore` já bloqueia `.env`/`.env.*`, com exceção
explícita de `.env.example` e `app/.env.production` (que só contém a URL
e a anon key **públicas** do projeto demo — seguro por design).

| Variável | Onde é usada | Sensibilidade | Obrigatória? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | front (`app/.env`, `app/.env.production`) | pública | sim |
| `VITE_SUPABASE_ANON_KEY` | front | pública (a RLS protege os dados) | sim |
| `VITE_ERROR_REPORT_URL` | front (`shared/lib/observabilidade.js`) | endpoint próprio, não é segredo do Supabase | não — sem ela o sistema só loga no console (Fase A.4) |
| `VITE_APP_ENV` | front (`shared/branding/ambiente.js`) — liga a faixa "AMBIENTE DE DEMONSTRAÇÃO" quando vale `demo` | pública | não — só no projeto Vercel de demo/vitrine (Production e Preview); ausência no projeto de produção real = produção, sem faixa |
| `SUPABASE_URL` | scripts de operador (`scripts/*.mjs`) | pública | sim (scripts) |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts de operador, Edge Functions | **crítica — nunca no front/repo** | sim (scripts/funções) |
| `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | `tests/` (suíte local) | local, sem dado real | sim (testes) |
| `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` | secrets do GitHub Actions (job `e2e`) | pública, mas de um projeto isolado | opcional (sem ela o E2E roda contra o demo — ver `e2e-ambiente.md`) |
| `ALLOWED_ORIGINS` | secret das Edge Functions (CSV de origens; substitui a lista padrão) | pública (só origens) | não — sem ela vale o default (`https://rumo-a-aprova-o.vercel.app` + localhost) |
| `PASSWORD_RESET_REDIRECT_URL` | secret da `backoffice-coordenador` (destino do link de redefinição) | pública (só URL) | não — default `https://rumo-a-aprova-o.vercel.app/redefinir-senha` |
| `RESEND_API_KEY` | secret da `backoffice-coordenador` (Tarefa 1 — dispara o e-mail de acesso via API do Resend; `auth.admin.generateLink` só gera o link, nunca envia) | **crítica — nunca no front/repo** | sim (sem ela, o e-mail não sai; a função loga o erro e devolve estado `_pendente`) |
| `RESEND_FROM_EMAIL` | secret da `backoffice-coordenador` (remetente do e-mail, formato `"Nome <endereco@dominio>"`) | pública (só um remetente) | não — default `Triliva <onboarding@resend.dev>` (remetente de teste do Resend; sem domínio verificado, a entregabilidade é limitada — trocar assim que houver domínio próprio) |
| `VERCEL_PREVIEW_PREFIXES` | secret das Edge Functions (CSV de slugs de projeto na Vercel, para liberar os previews `<slug>-*.vercel.app` de cada um) | pública (só slugs) | não — sem ela cai no singular `VERCEL_PREVIEW_PREFIX` e depois no default `rumo-a-aprova-o`; item fora de `[a-z0-9-]` é descartado |
| `VERCEL_PREVIEW_PREFIX` | secret das Edge Functions (compat — um único slug; ver `VERCEL_PREVIEW_PREFIXES` acima para mais de um projeto) | pública (só um slug) | não — default `rumo-a-aprova-o`; valor fora de `[a-z0-9-]` é ignorado |

> As quatro últimas existem para que uma troca de **domínio, slug ou marca** na Vercel
> seja feita só por secret, sem editar as Edge Functions. Atenção: `_shared/cors.ts` é a
> versão canônica, mas `backoffice-coordenador`, `revogar-responsavel` e
> `provisionar-aluno` carregam uma **cópia própria** (deliberada, para deploy sem o
> bundler de `_shared/`) — uma mudança nos *defaults* precisa ser espelhada nos 4 arquivos.

## Verificação feita nesta fase

- Confirmado por leitura de `.gitignore`, `.env.example` e
  `app/.env.production`: nenhuma chave privada (`service_role`, senha de
  banco) está commitada em lugar nenhum do repositório.
- Confirmado por busca no código (`app/src`): nenhuma referência a
  `service_role` ou `SUPABASE_SERVICE_ROLE_KEY` existe no front — só nos
  `scripts/*.mjs` (rodados na máquina do operador) e nas Edge Functions
  (rodam no servidor do Supabase, fora do alcance do navegador).
- `VITE_ERROR_REPORT_URL` foi desenhada para ser **opcional**: ausência
  dela não quebra nada, não gera erro, não bloqueia build (regra "nunca
  criar dependência obrigatória de ferramenta externa sem fallback").

Para o procedimento de deploy e a política de segredos por etapa, ver
`docs/operacao/deploy-checklist.md` (já existente, não duplicado aqui).
