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
cada teste como `arquivo:linha` + projeto + tags + status, contagem de
rede e o número de problemas que ele viu.

**Nenhum texto livre na saída.** No primeiro run (`36245732923`) o runner
descartou a saída inteira (`Skip output 'relatorio' since it may contain
secret`) porque o título de um teste terminava em "Bearer abc", que casa
com o padrão de segredo do runner. O gate reprovou por relatório
ausente, o que é o comportamento certo, mas com o E2E verde. Por isso a
saída não leva título nem frase de problema, e o teste
`tests/ci-release-gate.test.mjs` garante isso. Os títulos continuam no
resumo do job `e2e-local`.

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

## Aceite negativo (26/09, rodada 2)

Três PRs de teste contra `claude/etapa-5-release-gate-qri6ri`, fechados
sem merge. Base de todos: `9bd881e`. Controle positivo no mesmo commit:
run `36246202687`, os quatro jobs `success`, o gate leu o relatório
(SHA `9bd881e`, 74 testes, 10 jornadas no mínimo) e aprovou.

| PR | Cenário | O que muda | Run (pull_request) | release-gate disse |
| --- | --- | --- | --- | --- |
| #157 | E2E quebrado | `auth.spec.js:30` com `toBeEnabled()` no botão desabilitado | `36246208416` | `job e2e-local falhou`; `auth: teste crítico FALHOU: auth.spec.js:30` |
| #158 | Relatório removido | sai o passo `id: relatorio` do `e2e-local` | `36246210760` | `job build-e-unitarios falhou` (guarda estática); `relatório de jornadas ausente`, com o `e2e-local` **verde** |
| #159 | Job pulado | `if: false` no `e2e-local` | `36246211643` | `job build-e-unitarios falhou` (guarda estática); `job e2e-local pulado`; `relatório de jornadas ausente` |

No #157 o relatório chegou mesmo com o passo vermelho, e o gate apontou
o teste por `arquivo:linha`. No #158 o E2E passou inteiro e só o gate
(e a guarda estática) segurou.

**Rodada 1 não conta.** Nela os três PRs ficaram vermelhos, mas o
controle positivo também (runs `36245732923` e `36245800988`): o runner
descartou a saída `relatorio` por causa do título "Bearer abc" (ver
"O relatório" acima). Corrigido em `9bd881e`.

## Tornar obrigatório

Só depois do aceite negativo, e é o dono quem muda:
Settings → Branches (ou Rules) → regra da `main` → Require status checks
→ adicionar `release-gate`. Pode manter `build-e-unitarios` junto;
`e2e-local` e `matriz-autorizacao` já entram pelo gate.
