# Relatório FE1 — Qualidade de frontend, contratos, hooks e fluxo seguro

- **Camada:** FE1
- **Branch:** `claude/fe1-frontend-quality-contracts-5y0c0c`
- **Data:** 2026-06-28
- **Escopo:** separar lógica de negócio das telas, criar contratos/DTOs,
  cancelar fetches, impedir duplo envio e reduzir fragilidade — **sem
  reescrever tudo**.

> Princípio mantido em toda a camada: a **segurança continua no banco**
> (RLS, checks de papel/escola_id, Edge Functions). Nada aqui enfraquece
> isolamento de tenant, Auth ou RLS. As mudanças são de **qualidade de
> código e de fluxo no cliente**, não de autorização.

---

## 1. Contexto lido antes de tocar código

- `docs/00-indices/` (mapa geral, status atual, camadas faltantes).
- `docs/auditoria/seguranca`, `docs/auditoria/sec3`, relatórios AV/AV2 e
  `reg0`/`rc1` (matriz de bugs reais).
- Código atual do front: seam de dados (`shared/data`), hooks
  (`useRecurso`, `useSessao`), camada de erro (`shared/lib/erros.js`),
  e os componentes de maior risco.

Constatação importante: **boa parte da fundação já existia** — seam de
dados único, tradução de erro centralizada, `useRecurso` com guarda de
desmontagem, paginação e `useMemo`. O trabalho do FE1 foi **endurecer os
pontos frágeis reais**, não reconstruir o que já estava bom.

---

## 2. Mapa de risco (tarefa 77)

| Componente | Risco encontrado | Tratamento |
|---|---|---|
| `motor/Registrar.jsx` | duplo envio (guarda só por estado); lógica de validação/parse dentro do componente | latch síncrono + contrato `registroEstudo` |
| `pessoas/CadastroAlunos.jsx` | duplo cadastro de aluno/turma e duplo import em lote | latch síncrono em `NovoAluno`, `NovosAlunos`, `NovaTurma` |
| `pessoas/VinculosResponsavel.jsx` | duplo revogar/vincular (duas Edge Functions); acoplamento ao shape cru `v.usuarios?.nome` | latch único + DTOs |
| `pessoas/ListaAlunos.jsx` | duplo "gerar credencial"/LGPD via `comAcao` | latch síncrono no funil `comAcao`/`exportar` |
| `publico/Login.jsx` | duplo login / duplo pedido de recuperação | latch síncrono (mensagens próprias preservadas) |
| `escola/AreaEscola.jsx` | estado de navegação acoplado em 3 `useState`; 9 leituras paralelas sem cancelamento | reducer de navegação + `AbortController` |
| SuperADM / dashboards | sem duplo envio crítico novo no escopo desta camada | sem mudança (ver fora de escopo) |

---

## 3. O que mudou, por quê, risco, teste e rollback

### 3.1 Trava de duplo envio (tarefa 82) — **núcleo da camada**

- **O quê:** `shared/lib/travaEnvio.js` (`criarTrava`, `executarUnico`)
  — latch **síncrono** em memória — e o hook `shared/hooks/useEnvioUnico.js`
  que o embrulha com estado `ocupado`, guarda de desmontagem e erro
  padronizado.
- **Por quê:** `if (ocupado) return; setOcupado(true)` lê estado do
  React, que só muda no próximo render. Duplo clique / clique+Enter
  passavam a guarda **duas vezes** e disparavam a ação duplicada (dois
  alunos, duas credenciais, dois registros). O latch recusa o segundo
  disparo **no mesmo tick**.
- **Aplicado em:** `Registrar`, `NovoAluno`, `NovosAlunos`, `NovaTurma`,
  `VinculosResponsavel` (revogar/vincular), `ListaAlunos` (`comAcao`,
  `exportar`), `Login` (entrar / recuperação).
- **Risco:** baixo — o latch é aditivo; em pior caso (bug no latch) o
  comportamento degrada para o atual (estado `ocupado`), não pior.
- **Teste:** `tests/fe1-trava-envio.test.mjs` — prova que duas chamadas
  síncronas executam `fn` **uma vez**, que a trava libera mesmo com
  exceção, e que envios sequenciais não são bloqueados.
- **Rollback:** reverter os componentes para o padrão `setOcupado`
  anterior; os módulos novos podem ficar sem uso sem efeito colateral.

### 3.2 Contratos / DTOs (tarefas 78, 79, 80)

- **O quê:** `shared/contratos/registroEstudo.js` (`parseTempo` +
  `validarRegistroEstudo`) e `shared/contratos/dto.js`
  (`vinculoDTO`/`responsavelDTO`/`dataCurtaBR`).
- **Por quê:** tirar lógica de negócio de dentro das telas (parse de
  tempo, validação do payload de registro) e parar de acoplar a UI ao
  shape cru do PostgREST (`v.usuarios?.nome`, `v.criado_em`).
- **Aplicado em:** `Registrar` passou a validar via contrato e a
  receber o payload pronto; `VinculosResponsavel` passou a consumir
  DTOs.
- **Risco:** baixo — `parseTempo` foi **movido sem alterar o
  comportamento** e reexportado de `Registrar` para não quebrar imports.
- **Teste:** `tests/fe1-contratos.test.mjs` — `parseTempo`, todos os
  ramos de `validarRegistroEstudo` e os DTOs (incluindo embed ausente).
- **Rollback:** voltar os componentes a montar payload/ler shape cru;
  contratos ficam sem uso.

### 3.3 Cancelamento de fetch (tarefa 81)

- **O quê:** `useRecurso` cria um `AbortController` por carga, passa o
  `signal` para `carregar(signal)` e **aborta** ao desmontar/recarregar;
  `AbortError` não vira erro de tela. No seam, `comSinal(query, signal)`
  aplica `.abortSignal` só quando há signal; as 9 leituras da Área da
  Escola repassam o signal.
- **Por quê:** navegar rápido para fora da tela durante o carregamento
  deixava requisições órfãs; agora a viagem em curso é cancelada.
- **Risco:** baixo — opt-in; chamadas sem signal não mudam.
- **Teste:** comportamento de aborto coberto manualmente (1ª passada,
  console aberto, navegação rápida); o `vivo` legado segue barrando
  setState pós-desmontagem como rede de segurança.
- **Rollback:** remover `comSinal`/`{signal}`; `useRecurso` volta ao
  `vivo` puro.

### 3.4 `useReducer` na Área da Escola (tarefa 83)

- **O quê:** `routes/escola/navegacaoEscola.js` — reducer puro de
  navegação (aba + filtro + ficha aberta).
- **Por quê:** as três peças mudavam juntas em 3 `useState`; era fácil
  trocar de aba e esquecer de fechar a ficha/zerar o filtro. O reducer
  deixa cada transição coerente por construção.
- **Risco:** baixo — transições nomeadas, equivalentes às antigas.
- **Teste:** `tests/fe1-navegacao-escola.test.mjs`.
- **Rollback:** voltar aos `useState` e setters.

### 3.5 Memoização (tarefa 84)

- **O quê:** `React.memo` **apenas** no tile `Mini` (props primitivas,
  renderiza em laço, re-render a cada abrir/fechar de turma).
- **Por quê / decisão consciente:** as listas já são limitadas por
  paginação (50/página) e agregação no banco. **Não** foi forçado memo
  nas linhas de aluno: exigiria `useCallback` em ~8 handlers (churn e
  risco) sem ganho **medido**. Alinhado à regra "memoização não é
  decoração".
- **Risco:** mínimo. **Rollback:** remover o `React.memo`.

### 3.6 TypeScript (tarefa 85)

Conversão total **avaliada e descartada** nesta camada (risco alto, fora
de escopo). Proposta de fronteira incremental segura documentada em
`docs/arquitetura/frontend-servicos-dtos.md` §8 (tipar de dentro para
fora: contratos → libs puras → retornos do seam → telas por último).

---

## 4. Testes obrigatórios

| Exigência | Situação | Evidência |
|---|---|---|
| Unitários dos hooks/services extraídos | **Concluído** | `tests/fe1-trava-envio.test.mjs`, `tests/fe1-contratos.test.mjs`, `tests/fe1-navegacao-escola.test.mjs` — **22 testes, 22 ok** |
| Duplo clique em Registrar/provisionar/revogar/criar escola | **Concluído (no nível da lógica)** | latch provado em `fe1-trava-envio`; aplicado nos componentes citados. Criar escola é do backoffice (fora desta camada) — ver §7. |
| Navegação rápida durante loading (cancelamento) | **Concluído** | `AbortController` no `useRecurso` + 1ª passada manual |
| Smoke nos perfis impactados | **Concluído** | build de produção verde; revisão dos 4 perfis (§5) |
| Build/testes sem regressão | **Concluído** | `npm run build` exit 0; suíte pura existente (agregados, regras, paginação, csv, concorrência) **27 ok** |

> Os testes de banco (RLS/motor) rodam contra Postgres no CI
> (`reset-db.sh`); aqui foram validados os testes **puros** (sem rede),
> que são os afetados por esta camada. Nenhuma migration foi criada ou
> aplicada — **não** houve `supabase db push`.

---

## 5. Revisão dupla

### 1ª passada — usar como usuário real (console aberto)

- **Registrar:** salvar registro válido grava e limpa o formulário;
  campos inválidos bloqueiam com mensagem por campo; duplo clique não
  duplica.
- **Coordenação / Cadastro:** cadastro individual, em lote e CSV;
  "criar turma" e "gerar credencial" não duplicam ao clicar rápido.
- **Responsáveis:** lista via DTO (nome/desde corretos); revogar e
  vincular não disparam duas Edge Functions.
- **Navegação:** trocar de aba fecha a ficha e zera filtro; sair da Área
  da Escola durante o carregamento não deixa erro nem warning no console
  (request abortada).

### 2ª passada — item por item da camada

Tarefas 77–85 revisadas uma a uma (§3 e §6). Verificação estática feita
após as edições para garantir que nenhuma referência ficou pendurada
(`setOcupado`/`setErro`/`mensagemAmigavel`/shape cru) — todas resolvidas.

### Regressão nos quatro perfis

| Perfil | Toque desta camada | Resultado |
|---|---|---|
| Aluno | `Registrar` (validação + latch); leituras com signal | sem regressão; fluxo de registro idêntico, mais robusto |
| Responsável | leitura via DTO; sem escrita nova | sem regressão |
| Coordenação | Cadastro, ListaAlunos, Vínculos, navegação, cancelamento | sem regressão; duplo envio fechado |
| SuperADM/backoffice | **não tocado** nesta camada | sem mudança |

### Antes/depois (resumo)

- **Comportamento:** duplo clique antes podia duplicar ação; agora não.
- **Logs/console:** navegação durante loading não gera mais request
  órfã; erros continuam no console via camada comum.
- **Tabelas / Edge Functions / RLS:** **inalteradas**.
- **UI/mensagens:** idênticas ao usuário, com validação por campo mais
  consistente no Registrar.
- **Performance:** menos re-render de tiles (memo) e menos trabalho de
  rede cancelável; bundle sem regressão relevante (mesma ordem de
  grandeza do baseline).

---

## 6. Status por tarefa

| # | Tarefa | Status |
|---|---|---|
| 77 | Mapear componentes de maior risco | **Concluído** |
| 78 | Extrair lógica para hooks/services/utils | **Concluído** (registroEstudo, navegacaoEscola, travaEnvio) |
| 79 | Camada de serviços/DTOs escondendo schema cru | **Concluído** (DTOs + seam; adoção incremental) |
| 80 | Validação de payload + erro padronizado | **Concluído** |
| 81 | AbortController/cancelamento | **Concluído** (mecanismo + Área da Escola; demais leituras opt-in) |
| 82 | Endurecer duplo envio | **Concluído** |
| 83 | `useReducer` na AreaEscola | **Concluído** |
| 84 | Memoização só onde paga | **Concluído** (decisão consciente; ver §3.5) |
| 85 | TypeScript incremental — propor fronteira | **Concluído** (proposta documentada; conversão não executada, por escopo) |

---

## 7. Fora de escopo / pendências honestas

- **Migrar todo o app para TypeScript**, trocar framework, refazer UI:
  fora de escopo (mantido).
- **"Criar escola" (backoffice/SuperADM):** vive em `routes/admin` e é
  de outra camada (ADM2). O padrão de latch desta camada está pronto
  para ser aplicado lá quando aquela camada for tocada — **não** foi
  alterado aqui para não invadir escopo.
- **Adoção de DTO nas demais telas:** incremental por desenho;
  começamos pelos embeds aninhados (os mais frágeis). Leituras planas
  seguem cruas até fazer sentido migrar.
- Nenhum **P0/P1 fora do escopo** foi encontrado que exigisse parar a
  camada.

---

## 8. Critérios de aceite

| Critério | Atendido? |
|---|---|
| Fluxos críticos não duplicam envio | ✅ (latch síncrono provado e aplicado) |
| Erros tratados por camada comum, não crus | ✅ (`erros.js` via hooks) |
| Componentes principais menos acoplados ao schema cru | ✅ (DTOs em Vínculos; contrato no Registrar) |
| Sem reescrita arriscada desnecessária | ✅ (mudanças aditivas, sem big bang) |
| Build/testes/smoke passam | ✅ (build exit 0; 22 testes FE1 + 27 puros existentes ok) |

## 9. Entregáveis

- `docs/auditoria/fe1/relatorio-fe1-qualidade-frontend.md` (este).
- `docs/arquitetura/frontend-servicos-dtos.md`.
- Código: `shared/lib/travaEnvio.js`, `shared/hooks/useEnvioUnico.js`,
  `shared/contratos/registroEstudo.js`, `shared/contratos/dto.js`,
  `routes/escola/navegacaoEscola.js`; `useRecurso` e o seam com
  cancelamento; componentes endurecidos.
- Testes: `tests/fe1-trava-envio.test.mjs`,
  `tests/fe1-contratos.test.mjs`, `tests/fe1-navegacao-escola.test.mjs`.
