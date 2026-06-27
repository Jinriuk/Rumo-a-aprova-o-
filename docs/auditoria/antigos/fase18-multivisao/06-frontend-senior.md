# Auditoria — Persona 6: FRONTEND SÊNIOR

> Auditoria por desenvolvedor front-end sênior (React, Vite, estado, performance, arquitetura
> de interface). Base: `app/src/` (~6.200 linhas), com foco em estrutura de componentes,
> estado, data fetching, memoização, reuso e prontidão para escala.

---

## 1. Nota geral de maturidade da área: **70/100**

O front é limpo, organizado por domínio e disciplinado em pontos que costumam ser frágeis:
todo acesso a dados passa por um único seam (`shared/data/index.js`), os `useEffect`
assíncronos têm flag de cleanup (`vivo`), e há componentes de UI compartilhados de verdade.
A arquitetura é coerente e legível. Perde pontos por não estar preparada para listas grandes
(sem paginação/virtualização/`React.memo`), por concentrar lógica de negócio dentro de
componentes, pela ausência de TypeScript e de travas contra duplo envio.

## 2. O que está forte

- **Seam de dados único.** `shared/data/index.js` é o ÚNICO ponto que fala com o Supabase;
  nenhuma tela importa o cliente direto. Toda função devolve dado ou lança erro com contexto.
  Isso é arquitetura de interface madura e facilita troca de backend/teste.
- **Cleanup assíncrono consistente.** Padrão `let vivo = true; … return () => { vivo = false }`
  em todos os carregamentos — evita setState após desmontar e a maioria das race conditions de
  navegação.
- **Reuso real de UI.** `componentes.jsx` (Card, SectionCard, StatCard, EmptyState,
  StatusBadge, BarraXP, Tabs, MaisAcoes) é usado em todo o app. `agregarEscola()` é função
  pura compartilhada por Painel/Ranking/Lista — sem três cópias.
- **Roteamento simples por papel** (`App.jsx`, 71 linhas) sem monólito; mapa de áreas por
  `perfil.usuario.papel`.
- **Estado de sessão isolado em hook** (`useSessao.js`) com listener do Supabase.
- **Cálculos pesados memoizados** (`useMemo` para métricas, ranking, agregações).

## 3. O que está fraco

- **Lógica de negócio dentro dos componentes.** Cálculo de métricas, ranking, agregação,
  catálogo de conquistas — tudo inline nas telas (`VisaoEstudo`, `Conquistas`, `PainelGestao`),
  não extraído para hooks/utilitários testáveis. Acopla regra a render.
- **Componentes grandes.** `VisaoEstudo.jsx` (245 linhas, 7 abas), `Progresso.jsx` (~308),
  `AreaEscola.jsx` (245, 6 abas + Turmas inline), `Conquistas.jsx` (224). Dá para quebrar.
- **Sem preparo para listas grandes.** `ListaAlunos`/`ClassificacaoTurma` renderizam todos os
  alunos; `AreaEscola` carrega tudo num `Promise.all`. Sem paginação, sem virtualização, sem
  `React.memo` nos filhos — re-render do pai cascateia.
- **Sem TypeScript nem JSDoc de schema.** O objeto `perfil`/`dados` circula sem tipo; refator
  fica arriscado.

## 4. O que está confuso / risco de regressão

- **Estado assíncrono de `AreaEscola`** com várias variáveis independentes (`dados`,
  `credencial`, `alunoAberto`, `versao`) em vez de um `useReducer`: falha parcial de carga
  pode deixar estado inconsistente.
- **Memoização potencialmente furada:** `useMemo` depende de arrays que o servidor devolve
  como nova instância a cada fetch; o memo só ajuda dentro do mesmo conjunto de dados, não
  entre recargas — fácil de assumir ganho que não existe.

## 5. O que pode quebrar com uso real

- **Duplo envio:** `Registrar` e `definirEstadoAtividade` disparam mutação sem trava/debounce
  → cliques rápidos geram registros/atualizações duplicados.
- **Sem AbortController:** requests de telas abandonadas continuam (a flag `vivo` evita o
  setState, mas a requisição não é cancelada).
- **Performance em 300+ alunos:** render completo da lista + agregação no cliente = jank.

## 6. Problemas críticos

- Nenhum bug crítico evidente. O "crítico" aqui é de **escalabilidade do front**: o modelo
  carregar-tudo + renderizar-tudo + agregar-no-cliente não sustenta escolas grandes.

## 7. Problemas importantes (impacto × complexidade)

| Problema | Impacto | Complexidade |
|----------|---------|--------------|
| Sem paginação/virtualização em listas | Alto | Média |
| Agregação pesada no cliente (deveria ser RPC) | Alto | Média |
| Lógica de negócio dentro de componentes | Médio | Média |
| Sem trava de duplo envio | Médio | Baixa |
| Ausência de TypeScript | Médio | Alta |
| `AreaEscola` com muitos `useState` soltos | Médio | Baixa (useReducer) |

## 8. Melhorias desejáveis

- Extrair regra para hooks/utils puros (`useMetricasAluno`, `useResumoEscola`) — testáveis.
- `React.memo` + virtualização (react-window) nas listas grandes.
- `useReducer` em `AreaEscola`; Error Boundary global.
- Hook genérico `useAsync`/`useRecurso` para padronizar fetch + loading + erro + abort.
- Adoção incremental de TypeScript (ao menos no seam de dados).

## 9. O que não precisa mexer

- O seam de dados único (manter como princípio).
- O padrão de cleanup `vivo`.
- A biblioteca de componentes compartilhados.
- O roteamento por papel.

## 10. O que falta para considerar fechado (visão frontend)

1. Estratégia de listas grandes (paginação + virtualização + memo).
2. Mover agregação para o servidor (RPC), consumir no cliente.
3. Extrair lógica de negócio dos componentes para hooks/utils.
4. Travas de duplo envio e Error Boundary.

## 11. Lista objetiva de recomendações

| # | Recomendação | Esforço | Prioridade |
|---|--------------|---------|------------|
| 1 | Paginação + virtualização + `React.memo` nas listas | Médio | Crítica (escala) |
| 2 | RPC de agregação; cliente só renderiza | Médio | Alta |
| 3 | Hook `useAsync` genérico (fetch/loading/erro/abort) | Médio | Alta |
| 4 | Debounce/trava em mutações | Baixo | Alta |
| 5 | Extrair regras para utils testáveis | Médio | Média |
| 6 | TypeScript incremental | Alto | Média |
| 7 | `useReducer` em AreaEscola + Error Boundary | Baixo | Média |

## 12. Veredito final

**Aprovado com ressalvas.** O front é bem arquitetado e legível, com decisões maduras (seam
único, cleanup, reuso). Está pronto para escolas pequenas/médias. Para declarar fechado é
preciso resolver a escala (listas grandes, agregação no servidor) e endurecer mutações
(duplo envio, abort, boundary). Feitas essas mudanças, a área vai para a faixa de 86.
