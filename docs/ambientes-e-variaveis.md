# Ambientes e variáveis (Fase A.2)

> Regra absoluta: **`service_role` nunca aparece no front, nunca entra no
> repositório.** O front só recebe a chave `anon` pública — a segurança é
> a RLS no banco, não o segredo da chave.

## Ambientes hoje

| Ambiente | Onde roda | Banco | Uso |
|---|---|---|---|
| **Desenvolvimento local** | máquina do dev (`npm run dev`) | Postgres local (`tests/reset-db.sh`) ou projeto demo | trabalho do dia a dia |
| **CI** (`build-e-unitarios`) | GitHub Actions | Postgres efêmero (container `postgres:15`) | migrations + seed 2x + testes unitários/RLS, descartado a cada run |
| **CI** (`e2e`) | GitHub Actions | projeto Supabase de demo, ou projeto isolado se `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` estiverem configurados (ver `docs/e2e-ambiente.md`) | suíte Playwright contra build real |
| **Demo/produção atual** | Vercel (front) + Supabase `bdjkgrzfzoamchdpobbl` | projeto único, região us-east-1, rotulado "demo" | demonstração — **não** dado real de aluno (ver `docs/lgpd-e-infra.md`, gate de região) |

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
| `SUPABASE_URL` | scripts de operador (`scripts/*.mjs`) | pública | sim (scripts) |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts de operador, Edge Functions | **crítica — nunca no front/repo** | sim (scripts/funções) |
| `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | `tests/` (suíte local) | local, sem dado real | sim (testes) |
| `E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` | secrets do GitHub Actions (job `e2e`) | pública, mas de um projeto isolado | opcional (sem ela o E2E roda contra o demo — ver `e2e-ambiente.md`) |

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
`docs/deploy-checklist.md` (já existente, não duplicado aqui).
