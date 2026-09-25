# Suíte E2E — stack Supabase LOCAL (Etapa 3)

Testes de ponta a ponta com **Playwright** contra uma stack Supabase **local e
descartável** que sobe no próprio runner: Postgres 17 (o mesmo major do remoto),
Auth, PostgREST, Edge Functions e o capturador de e-mail (Mailpit). Nenhum projeto
hospedado, nenhuma credencial de nuvem. Desenho completo e regras:
[`docs/operacao/e2e-ambiente.md`](../../docs/operacao/e2e-ambiente.md).

## Como rodar

```bash
(cd app && npm ci) && (cd tests && npm ci)
cd app && npx playwright install chromium && cd ..
bash scripts/e2e/rodar.sh            # stack → banco → fixture → front → suíte
bash scripts/e2e/rodar.sh smoke      # só a fumaça
E2E_MANTER_STACK=1 bash scripts/e2e/rodar.sh --project=http
```

Precisa de Docker, da CLI do Supabase (a versão do CI está em
`.github/workflows/ci.yml`, `SUPABASE_CLI_VERSION`), `psql` e Node 22.

## O que protege o demo e a produção

- **Trava de destino** (`scripts/e2e/trava.mjs`): antes do banco, da fixture, do
  build e da suíte, exige host local, id de execução e o marcador da fixture no
  próprio banco, e recusa qualquer `*.supabase.co`.
- **Front do E2E** (`scripts/e2e/front.sh`): `vite build --mode e2e`, que não lê o
  `app/.env.production` do demo; o bundle é conferido (URL local presente, nenhum
  `*.supabase.co`).
- **Guarda de rede** (`e2e/local/base.js`): o navegador só fala com `127.0.0.1`;
  chamada a `*.supabase.co` reprova o teste.

## Contas

Vêm de `scripts/e2e/contas.mjs` (fonte única, também usada por
`scripts/e2e/semear.mjs`), criadas pela API admin do Auth local com os ids do
seed 01 e da fixture da matriz de autorização. A senha só existe na stack local.
