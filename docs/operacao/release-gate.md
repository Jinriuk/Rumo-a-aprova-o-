# release-gate (Etapa 5)

O check que a proteção da `main` deve exigir. Um só nome no lugar de
três, e que não fica verde por omissão.

## O que ele exige

Job `release-gate` no `.github/workflows/ci.yml`, com `if: always()` e
`needs: [build-e-unitarios, e2e-local, matriz-autorizacao]`. O script é
`scripts/ci/release-gate.mjs`. Ele lista todos os problemas e reprova
quando:

| Condição | Mensagem |
| --- | --- |
| job obrigatório fora do `needs` | `job X ausente do needs do release-gate` |
| job obrigatório `failure`, `cancelled` ou `skipped` | `job X falhou` / `cancelado` / `pulado` |
| `continue-on-error` em qualquer linha do `ci.yml` (fora de comentário) | `ci.yml:N usa continue-on-error` |
| job obrigatório sumiu do `ci.yml` | `ci.yml não define o job X` |
| saída `relatorio` do `e2e-local` vazia | `relatório de jornadas ausente` |
| relatório ilegível ou de outra versão | `ilegível` / `formato desconhecido` |
| SHA do checkout do E2E ≠ `GITHUB_SHA` do gate | `relatório de outro commit` |
| run diferente | `relatório de outro run` |
| zero testes executados | `nenhum teste foi executado` |
| jornada abaixo do mínimo, teste crítico pulado, falho ou instável | as mensagens do `relatorio-jornadas.mjs` |
| navegador falou com projeto hospedado | idem |

A avaliação das jornadas é **refeita no gate** com o `jornadas.mjs` do
checkout, a partir da lista de testes (título, projeto, tags, status).
O veredito do `e2e-local` sozinho não basta.

Por que `continue-on-error` é proibido no arquivo inteiro: num job, ele
faz o job aparecer como sucesso para quem depende dele; num passo, o
job segue verde com o passo vermelho. Nos dois casos o `needs` mentiria.

## O relatório

O passo `Relatório jornada → testes` do `e2e-local` (`id: relatorio`,
`if: always()`) escreve `app/e2e-resultados/jornadas.json` e a saída
`relatorio` do job: versão do formato, SHA de `git rev-parse HEAD`, run,
cada teste com tags e status, contagem de rede e os problemas que ele
viu. Não leva mensagem de erro nem corpo de requisição.

## Matriz de autorização

Job próprio (`matriz-autorizacao`, Postgres 17): roda
`tests/e2-matriz-autorizacao-db.test.mjs` e reprova se algum teste do
arquivo não passar, for pulado ou marcado como todo, ou se o arquivo
cair abaixo de 7 testes. A matriz continua também no `npm test` do
`build-e-unitarios`, para não abrir buraco enquanto a proteção exige só
aquele job. A camada HTTP da matriz é a jornada `limites_acesso` do E2E.

## Guardas

- `tests/ci-release-gate.test.mjs` (roda no `build-e-unitarios`): a
  lógica do gate caso a caso e o `ci.yml` lido como texto.
- `tests/ci-e2e-local.test.mjs`: o `e2e-local` não pula nem usa secret.

## Limite conhecido

O gate roda o código do próprio PR. Um PR que edite
`scripts/ci/release-gate.mjs` ou o `ci.yml` pode afrouxar o gate que o
julga. A defesa é revisão obrigatória nesses caminhos (CODEOWNERS em
`.github/` e `scripts/ci/`), não o gate.

## Aceite negativo

Três PRs de teste contra `claude/etapa-5-release-gate-qri6ri`, fechados
sem merge. O resultado fica registrado no PR da Etapa 5 e na resposta ao
dono.

| Cenário | O que o PR muda | Esperado do gate |
| --- | --- | --- |
| E2E quebrado | uma asserção de teste crítico passa a falhar | `job e2e-local falhou` + teste crítico `FALHOU` |
| Relatório removido | tira o passo do relatório do `e2e-local` | `relatório de jornadas ausente` |
| Job pulado | `if: false` no `e2e-local` | `job e2e-local pulado` + relatório ausente |

## Tornar obrigatório

Só depois do aceite negativo, e é o dono quem muda:
Settings → Branches (ou Rules) → regra da `main` → Require status checks
→ adicionar `release-gate`. Pode manter `build-e-unitarios` junto;
`e2e-local` e `matriz-autorizacao` já entram pelo gate.
