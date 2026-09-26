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

## Jornadas

Cada teste leva a tag da jornada (`@j:<nome>`) e, nas obrigatórias, `@critica`.

| Jornada | Spec | O que prova |
|---|---|---|
| `auth` | `auth.spec.js` | login válido e inválido (mesma mensagem para código inexistente e senha errada), troca obrigatória, recuperação pelo e-mail que chega ao Mailpit local (o `PUT /auth/v1/user` que dava 405 em produção), logout, refresh da página, sessão expirada e revogada no servidor |
| `aluno` | `aluno.spec.js` | Hoje, trilha, concluir objetivo, registro de estudo e simulado, cada um conferido no banco e depois de atualizar a página |
| `coordenacao` | `coordenacao.spec.js` | turma → aluno → meta → credencial → troca de senha do aluno novo → responsável e vínculo → progresso na ficha; painel, abas e marca |
| `responsavel` | `responsavel.spec.js` | lê só o vinculado (tela e API com a sessão dele), não edita (sem controle e a API recusa), revogação pela tela da coordenação vale na sessão aberta |
| `super_admin` | `admin.spec.js` | cria escola com coordenação (claims e log), a coordenação ativa o acesso pelo e-mail local, suspender e reativar chegam na sessão dela, usuário comum negado na tela e nas RPCs |
| `ciclo` | `ciclo.spec.js` | virada, fronteira da meia-noite de Brasília (02:59:59Z × 03:00Z), encerramento e próximo ciclo pela tela, com datas controladas |
| `concorrencia` | `concorrencia.spec.js` | duplo clique, duas abas e falha de API sem duplicar registro nem XP e sem perder o que foi digitado |
| `mobile` | `mobile.spec.js` (projeto `mobile`) | cada papel sem estouro horizontal, barra inferior e "Mais", e uma escrita de verdade no celular |
| `privacidade` | `privacidade.spec.js` | exportar e apagar os dados de um titular sintético pela tela (dossiê só dele; exclusão leva banco e Auth; log fica) |
| `limites_acesso` | `http/camada-http.spec.js` | os 15 casos da `camada_http` da matriz de autorização (174 casos T/A/R repetidos por HTTP), mais `http/pendencias-e3.spec.js` |

Depois de uma execução, `node scripts/e2e/registrar-camada-http.mjs` grava o
observado da camada HTTP em `docs/evidencias/e2-matriz-autorizacao.json`.
