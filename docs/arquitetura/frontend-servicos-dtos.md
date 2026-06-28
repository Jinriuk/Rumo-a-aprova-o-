# Frontend — camada de serviços, contratos/DTOs e fluxo seguro

> Camada **FE1**. Descreve como o front do Rumo à Aprovação separa
> lógica de negócio das telas, fala com o Supabase por um seam único,
> esconde o schema cru atrás de contratos e impede duplo envio /
> requisições órfãs. Não é um redesenho: é a fronteira que já existia,
> agora explicitada e endurecida nos pontos frágeis.

## 1. Princípio: a tela não decide dado, nem fala SQL

Três camadas, de fora para dentro:

```
  Componentes (.jsx)            ← só UI + estado de tela
        │  importam
        ▼
  Hooks / Contratos / Utils     ← lógica de negócio PURA e testável
        │  pedem dado a
        ▼
  Seam de dados (shared/data)   ← ÚNICO ponto que importa o supabase
        │
        ▼
  Supabase (RLS + Edge Functions)  ← onde mora a SEGURANÇA de verdade
```

Regra dura, herdada e mantida: **nenhuma tela importa `supabase`
diretamente.** Quem fala com o banco é `shared/data/index.js`. A
segurança nunca esteve no front e continua não estando — a RLS, os
checks de papel/escola_id e as Edge Functions decidem o que sai e o que
entra. O front só pede com educação e trata o retorno.

## 2. Seam de dados (`app/src/shared/data/index.js`)

Herdeiro do antigo objeto `db`. Cada função:

- devolve dado **ou lança** erro com contexto (`falha(contexto, error)`);
  nada de engolir exceção;
- nunca recebe `escola_id` por parâmetro para "escolher" tenant — a RLS
  já restringe ao tenant do usuário logado;
- isola Edge Functions atrás de `invocar(fn, body)`, que extrai a
  mensagem segura do corpo e relança traduzida.

### Cancelamento (`AbortController`)

As leituras mais pesadas aceitam um `signal` opcional:

```js
export async function listarAlunos({ signal } = {}) {
  const { data, error } = await comSinal(
    supabase.from("alunos").select("*, alunos_turmas(...)").order("nome"),
    signal,
  );
  ...
}
```

`comSinal(query, signal)` aplica `.abortSignal(signal)` **só quando há
signal** — quem chama sem signal (a maioria) não muda. A adoção é
incremental (opt-in), sem big bang: hoje as 9 leituras paralelas da
Área da Escola repassam o signal; as demais seguem cruas até fazer
sentido migrar.

## 3. Contratos / DTOs (`app/src/shared/contratos/`)

O PostgREST devolve a linha com os JOINs aninhados crus
(`vinculo.usuarios?.nome`). Cada tela que lê isso fica acoplada ao nome
da tabela e ao formato do embed; trocar o select quebra a tela em
silêncio (vira `undefined`). Os **DTOs** cortam esse acoplamento.

| Módulo | Papel |
|---|---|
| `contratos/dto.js` | mapeadores puros: `vinculoDTO`, `vinculosDTO`, `responsavelDTO`, `responsaveisDTO`, `dataCurtaBR`. Recebem a linha crua, devolvem objeto de domínio estável (`responsavelNome`, `desde`…). |
| `contratos/registroEstudo.js` | `parseTempo` + `validarRegistroEstudo(form)`: validação de payload de escrita, extraída do componente `Registrar`. Devolve `{ ok, erros, campos }` — a tela nunca monta o objeto de banco na mão. |

DTO **não é segurança nem cache** — é contrato de forma. Continua sendo
a RLS que decide *quais* linhas chegam; o DTO só estabiliza o *formato*
de cada linha para a tela.

Adoção incremental: começamos pelos embeds aninhados (os mais frágeis —
`VinculosResponsavel`). Leituras planas seguem cruas onde o acoplamento
é baixo.

## 4. Hooks de fluxo

| Hook | Responsabilidade |
|---|---|
| `shared/hooks/useRecurso.js` | carregamento assíncrono: `carregando`/`erro`/`recarregar`, stale-while-revalidate, guarda de desmontagem **e** `AbortController` (aborta a viagem em curso ao desmontar/recarregar; `AbortError` não vira erro de tela). |
| `shared/hooks/useEnvioUnico.js` | envio sensível com **duplo envio impossível**: latch síncrono + estado `ocupado` (só UI) + guarda de desmontagem + erro padronizado (`mensagemAmigavel`). |
| `shared/hooks/useSessao.js` | sessão + papel a partir do token (mesma fonte da RLS). |

### Por que o latch síncrono (`shared/lib/travaEnvio.js`)

O padrão antigo `if (ocupado) return; setOcupado(true)` lê **estado do
React**, que só atualiza no próximo render. Dois disparos no mesmo tick
(duplo clique, clique + Enter, toque fantasma no mobile) leem
`ocupado === false` os dois e executam a ação **duas vezes**. O
`disabled` do botão também só vale depois do render.

`criarTrava()` é um latch em memória (não estado de render): a segunda
entrada é recusada no mesmo tick, antes de qualquer re-render. É a peça
que torna o duplo envio impossível; o `ocupado` fica só para o texto
"Salvando…" e o disable visual.

```js
const { ocupado, erro, enviar } = useEnvioUnico("salvar");
<Botao disabled={!pronto || ocupado} onClick={() => enviar(async () => {
  await db.cadastrarAlunos(...);
  aoMudar?.();
})}>{ocupado ? "Cadastrando…" : "Cadastrar"}</Botao>
<Erro>{erro}</Erro>
```

A **idempotência de verdade** (não criar duas linhas se a *rede* repetir
o pacote) continua sendo do banco/Edge Function; o latch elimina a causa
mais comum no cliente, que é o clique humano repetido.

## 5. Tratamento de erro — camada comum

`shared/lib/erros.js` (`mensagemAmigavel`) traduz erro técnico em texto
que o usuário entende; o detalhe vai para o console / observabilidade,
nunca para a tela. `useEnvioUnico` e `useRecurso` já passam por ele —
as telas não repetem `try/catch` nem decidem texto de erro.
`shared/lib/observabilidade.js` é o ponto de extensão (Sentry etc.),
sem dado pessoal no relato.

## 6. Estado coordenado — `useReducer` onde paga

`routes/escola/navegacaoEscola.js` concentra a navegação da Área da
Escola (aba + filtro + ficha aberta), que sempre muda junta. Reducer
puro, transições nomeadas (`ir`, `irFiltrado`, `abrirAluno`,
`fecharAluno`): cada ação deixa o estado coerente por construção —
acaba o bug de trocar de aba sem fechar a ficha. **Não** foi aplicado
"useReducer por decoração": o resto do estado (modal de credencial,
dados carregados) é independente e segue em `useState`/`useRecurso`.

## 7. Memoização — só onde paga

Listas já são limitadas por **paginação** (`ListaAlunos`, 50/página) e
por agregação **no banco** (`resumo_escola`), com `useMemo` nos mapas
derivados. `React.memo` foi aplicado **apenas** ao tile `Mini` (props
primitivas, renderiza em laço, re-renderiza a cada abrir/fechar de
turma) — caso seguro e com ganho real. Não foi forçado memo nas linhas
de aluno: exigiria `useCallback` em ~8 handlers (churn e risco) sem
ganho **medido**; a paginação já limita o custo. Decisão consciente,
alinhada à regra "memoização não é decoração".

## 8. TypeScript — fronteira proposta (não adotado nesta camada)

Conversão total foi avaliada e **descartada** para esta camada (risco
alto, fora de escopo). A fronteira segura para um próximo passo
incremental, se desejado, é tipar **de dentro para fora**, começando
pelos módulos puros que já têm contrato e teste:

1. `shared/contratos/*` (DTOs e validadores) — entrada/saída já bem
   definidas; ganham `.d.ts` ou conversão para `.ts` sem tocar React.
2. `shared/lib/travaEnvio.js`, `shared/metricas/*`, `shared/regras/*`.
3. Tipos de retorno do seam (`shared/data`) a partir dos
   `generate_typescript_types` do Supabase, expostos via DTO.

As telas `.jsx` ficam por último. Isso evita o big bang e mantém o
build atual (Vite + React 19) funcionando sem `tsc` no caminho crítico.
