# Relatório Final — Fase B-min: Performance da Coordenação para Piloto

## 1. Resumo executivo

A pergunta central desta fase era: **a coordenação consegue abrir, buscar,
filtrar, visualizar e operar uma base de 300–500 alunos sem travar, sem
carregar dados em excesso e sem prejudicar a experiência?** Depois do
trabalho abaixo, a resposta é **sim, para o primeiro piloto controlado**.

O trabalho foi de **diagnóstico primeiro, correção depois** — não houve
otimização especulativa. A maior parte da carga já estava bem resolvida de
fases anteriores: a função `resumo_escola()` (migration 0016) já agrega
registros e metas **no banco**, devolvendo uma linha por aluno, em vez de
o navegador baixar ~15 mil linhas e somar em laço O(n×m). Essa peça
central de B.4 **já existia e foi verificada, não reinventada**.

As correções desta fase fecharam quatro lacunas reais encontradas no
diagnóstico:
1. A lista de alunos jogava **todos** os 300–500 alunos no DOM de uma vez
   (sem paginação) — agora pagina 50 por vez.
2. O cadastro **em lote** gerava a meta de cada aluno numa fila
   estritamente sequencial (uma viagem de rede por aluno, somadas) — agora
   roda com um teto de chamadas em paralelo.
3. O painel de turmas recalculava o agregado de **todas** as turmas a cada
   render (inclusive ao só abrir/fechar uma) — agora é uma passada só,
   memoizada.
4. As 4 tabelas multi-tenant mais consultadas pela coordenação
   (`registros_estudo`, `metas`, `simulados`, `consentimentos`) **nunca
   tiveram índice em `escola_id`** — toda abertura da Área da Escola fazia
   varredura sequencial da tabela inteira do sistema (todas as escolas).
   Quatro índices justificados foram criados.

Nenhuma regra pedagógica mudou, nenhuma política de RLS foi enfraquecida,
nenhuma tela nova foi criada. Nada do que estava verde quebrou: **184/184
testes verdes**, build de produção verde.

## 2. Diagnóstico inicial encontrado

Mapeamento das telas/consultas da coordenação (`AreaEscola.jsx` e seus
módulos):

- **Carregamento inicial** (`useRecurso` em `AreaEscola.jsx`): um
  `Promise.all` de 8 consultas por montagem — `listarTurmas`,
  `listarAlunos`, `listarConsentimentos`, `listarLogsAcesso` (já capado em
  100), `trilhaPadrao`, `listarConcursos`, `resumoEscola` (RPC agregada),
  `listarSimuladosEscola`. **Avaliação:** correto. As listas são estreitas
  (poucas colunas) e o agregado pesado já vem pronto do banco.
  `resumoPorAluno` é calculado **uma vez** via `useMemo` e passado como
  prop para os 4 consumidores — bom desenho preexistente.

- **`resumo_escola()` (migration 0016):** já resolve B.4 — agrega
  `registros_estudo` e `metas` por aluno no servidor, `SECURITY DEFINER`
  com a matriz RLS replicada explicitamente no `WHERE`
  (`escola_id = app.tenant_id()` + papel), `search_path` fixo. **Porém**,
  as CTEs filtram `registros_estudo` e `metas` por `escola_id` **sem
  índice** nessa coluna → varredura sequencial da tabela multi-tenant
  inteira a cada chamada. Esse foi o achado de maior impacto (B.1/B.5).

- **`ListaAlunos.jsx`:** o filtro/busca já estava em `useMemo` (bom), mas
  a lista renderizava `filtrados.map(...)` **inteiro** — 300–500 cards no
  DOM de uma vez. Sem paginação (B.2/B.6).

- **`Turmas` (em `AreaEscola.jsx`):** `statsTurma(turmaId)` fazia
  `alunos.filter(...)` + `reduce(...)` **dentro do corpo do render**, para
  **todas** as turmas, a cada re-render — O(turmas × alunos) repetido sem
  necessidade, inclusive ao só abrir/fechar uma turma (B.6).

- **`CadastroAlunos.jsx` (`NovosAlunos.cadastrar`):** após cadastrar em
  lote, gerava a meta com `for (const a of alunos) await db.gerarMeta(...)`
  — uma chamada de Edge Function por aluno, **estritamente sequencial**.
  Para o cenário nomeado da própria spec (alunos importados em lote, 300+),
  são centenas de viagens de rede somadas (B.6).

- **`PainelGestao.jsx`, `ClassificacaoTurma.jsx`:** já recebem o resumo
  pronto e já são memoizados (indexação de simulados por `Map`). Sem
  alteração necessária — verificado, não tocado.

- **`select *`:** `listarConsentimentos()` usa `select *`, mas é tabela
  estreita (poucas colunas, sem dado pesado) e capada pela escola — aceito.
  `listarAlunos` traz colunas estreitas + a relação de turma; `select` de
  `simulados` é explícito e estreito. Nenhum `select *` problemático.

## 3. Arquivos alterados

**Novos:**
- `app/src/shared/lib/paginacao.js` — função pura `paginar(lista, pagina, porPagina)`.
- `app/src/shared/lib/concorrencia.js` — `comConcorrenciaLimitada(itens, limite, fn)`.
- `supabase/migrations/0023_indices_escala_coordenacao.sql` — 4 índices em `escola_id`.
- `supabase/seed-volume/massa_coordenacao.sql` — massa sintética de ~480 alunos (B.7).
- `docs/operacao/massa-volume-coordenacao.md` — como usar/limpar a massa, e por que fica fora de `supabase/seed/`.
- `tests/paginacao.test.mjs`, `tests/concorrencia.test.mjs` — testes das funções puras.
- `tests/volume-coordenacao-db.test.mjs` — teste de volume/isolamento/índices em escola descartável.
- `docs/relatorios/relatorio-fase-b-min.md` — este relatório.

**Modificados:**
- `app/src/modules/pessoas/ListaAlunos.jsx` — paginação (50/página) da lista renderizada, controles prev/próxima, reset de página ao filtrar.
- `app/src/routes/escola/AreaEscola.jsx` — `Turmas` agora memoiza o agregado por turma num `Map` (uma passada por `[turmas, alunos, porAluno]`).
- `app/src/modules/pessoas/CadastroAlunos.jsx` — geração de meta em lote com concorrência limitada (teto 10) em vez de laço sequencial.

Nenhum arquivo de regra pedagógica, RLS, gamificação ou backoffice foi
alterado.

## 4. Correções implementadas

### Paginação (B.2)
A lista de alunos (`ListaAlunos.jsx`) passou a paginar **a saída
renderizada** em 50 por página (`POR_PAGINA = 50`), com controles
"‹ Anterior / Próxima ›" e indicador "página X de Y" que só aparecem com
mais de uma página. O cabeçalho mantém a contagem total filtrada
(`N de M`). Trocar busca/turma/status reseta para a página 1 (via
`useEffect`), para a escola não "perder" a lista numa página vazia depois
de filtrar. O estado de filtro é preservado entre páginas.

**Decisão de arquitetura (importante):** a paginação é **em memória**, não
no banco. A consulta `listarAlunos()` continua trazendo a escola inteira —
de propósito: as abas Painel, Ranking e Turmas precisam do conjunto
**completo** de alunos+resumo para calcular KPIs e rankings da escola
toda; não dá para paginar a consulta sem quebrar essas abas. O array de
alunos é estreito e leve (~500 linhas de poucas colunas), então mantê-lo
em memória é barato; o que machucava era jogar tudo no DOM, e é isso que a
paginação resolve. Função pura isolada (`paginacao.js`) reutilizável, sem
lógica duplicada.

### Busca e filtros (B.3)
A busca por nome e os filtros (turma, status: sem credencial / sem
consentimento / sem atividade 7d / meta atrasada) já rodavam sobre o array
em memória dentro de um `useMemo` — adequado para a escala de uma escola
(≤500 alunos, dados leves) e justificado pela mesma razão da paginação (as
outras abas precisam do conjunto inteiro). É o caso de "tela simples e
justificada" que a própria spec admite. Não foi reescrito para o banco
porque isso exigiria uma API paginada paralela + duplicar a lógica de
filtros derivados no servidor, adicionando complexidade sem ganho real
nesta escala.

### Views/RPCs de resumo (B.4)
**Já satisfeito por `resumo_escola()` (migration 0016), verificado e
mantido.** A função agrega no banco (uma linha por aluno, com geral + 7d +
meta), é `SECURITY DEFINER` com a matriz RLS replicada explicitamente no
`WHERE` (tenant pelo JWT, não forjável; papel decide o alcance) e
`search_path` fixo. Não retorna dado pessoal desnecessário (só
`aluno_id` + métricas). Nenhuma RPC nova foi criada — criar seria
complexidade fora de escopo. A correção real ligada a essa RPC foi de
índice (abaixo), não de lógica.

### Índices (B.5)
Migration `0023_indices_escala_coordenacao.sql`, 4 índices, cada um com
justificativa amarrada a uma consulta real da coordenação:

| Índice | Tabela | Consulta que o justifica |
|---|---|---|
| `idx_registros_escola` | `registros_estudo (escola_id)` | CTE `reg` de `resumo_escola()`: `where r.escola_id = app.tenant_id()` |
| `idx_metas_escola_status` | `metas (escola_id, status)` | CTE `meta` de `resumo_escola()`: `where m.status='ativa' and m.escola_id = app.tenant_id()` |
| `idx_simulados_escola` | `simulados (escola_id)` | RLS `simulados_select` + `listarSimuladosEscola()` |
| `idx_consentimentos_escola` | `consentimentos (escola_id)` | RLS `consentimentos_coordenacao` + `listarConsentimentos()` |

Essas 4 tabelas tinham índice em `aluno_id` mas **nenhum** em `escola_id`.
Como `escola_id` é a coluna de tenant, toda consulta filtrada por escola
varria a tabela multi-tenant **inteira** (todas as escolas do sistema), um
defeito que cresce com o tamanho do SaaS, não só com os alunos de uma
escola. Confirmado por `EXPLAIN` que os índices cobrem exatamente esses
predicados (vide §5). **Decisão deliberada de NÃO criar** índice em
`alunos(escola_id, nome)`: já existe `idx_alunos_escola(escola_id)` e a
ordenação por nome em ≤500 linhas em memória é barata — criar seria
"índice aleatório" sem consulta lenta que o justifique.

### Front-end (B.6)
- **Turmas** (`AreaEscola.jsx`): agregado por turma agora é um `Map`
  construído **uma vez** via `useMemo([turmas, alunos, porAluno])`, com uma
  única passada pelos alunos distribuindo em buckets de turma. O render
  consome `porTurma.get(id)` em vez de refazer `alunos.filter()` por turma
  a cada render. Some o O(turmas × alunos) repetido.
- **Cadastro em lote** (`CadastroAlunos.jsx`): geração de meta com
  `comConcorrenciaLimitada(alunos, 10, ...)` — teto de 10 chamadas em
  paralelo, em vez de fila sequencial. A Edge Function `gerar-meta` é
  idempotente e independente por aluno (delega a `motor_gerar_meta`), então
  é seguro paralelizar; o teto evita disparar 300+ chamadas simultâneas que
  sobrecarregariam a função/banco. Estados de loading/erro/feito já
  existiam e foram preservados.
- **Paginação** (`ListaAlunos.jsx`): vide B.2.
- **Virtualização (react-window):** **não usada**, conforme a spec — a
  paginação resolve o problema do DOM sem adicionar complexidade.

### Seeds/scripts de volume (B.7)
`supabase/seed-volume/massa_coordenacao.sql`: ~480 alunos sintéticos em 6
turmas, dentro da escola de vitrine, **sem nenhum dado pessoal real** (só
"Aluno Volume NNN" e ids determinísticos). Variação determinística (não
`random()`) por aritmética de módulo: ~1 em 5 sem credencial, ~1 em 4 sem
consentimento, ~1 em 6 sem atividade, ~1 em 3 com simulado, parte das
metas com atividades concluídas (para "meta atrasada" no filtro). Meta
gerada pelo motor real (`app.gerar_meta`). **Idempotente de verdade:** ids
determinísticos + `on conflict do nothing` em todo insert — rodar N vezes
dá o mesmo resultado. Fica **fora** de `supabase/seed/` de propósito, para
não ser apanhado pelo glob `[0-9][0-9]_*.sql` do `tests/reset-db.sh` e
inflar a suíte padrão. Documentado em `docs/operacao/massa-volume-coordenacao.md`.

### Testes (B.8)
- `tests/paginacao.test.mjs` (5 casos), `tests/concorrencia.test.mjs`
  (5 casos): funções puras, sem banco.
- `tests/volume-coordenacao-db.test.mjs`: cria uma **escola descartável**
  com 150 alunos sintéticos via `comoServidor` (commit), valida que
  `resumo_escola()` devolve uma linha por aluno, não vaza para outra
  escola, que os 4 índices da 0023 existem, e que a latência fica num teto
  generoso; **limpa tudo** em `test.after` (delete cascade da escola).

### Documentação
`docs/operacao/massa-volume-coordenacao.md` (uso/idempotência/limpeza da massa) e
este relatório. `docs/operacao/operacao.md` da Fase A permanece válido.

## 5. Performance e volume

- **Massa de volume aplicada** ao banco de teste: 481 alunos, 7 turmas,
  2403 registros de estudo, 162 simulados, 361 consentimentos na escola de
  vitrine — dentro da faixa do piloto (300–500). Script rodado **duas
  vezes**, contagens idênticas (idempotência confirmada).
- **Índices em uso:** `EXPLAIN` confirma que, quando o filtro por escola é
  seletivo (cenário multi-tenant real, com muitas escolas na tabela), o
  planner usa `idx_registros_escola` (Index Scan) e
  `idx_consentimentos_escola` (Bitmap Index Scan) para o predicado
  `escola_id = ...`. No banco de teste atual, com quase tudo numa só
  escola, o seq scan ainda é o plano ótimo (a escola **é** a tabela
  inteira) — o ganho do índice aparece à medida que o sistema cresce em
  número de escolas, que é exatamente o defeito que ele previne.
- **Latência da consulta mais pesada** (`resumo_escola()` com ~150 alunos
  no teste de volume): ~15–95 ms — folgadamente dentro do teto de 3000 ms
  asserido pelo teste. Sem timeout, sem travamento.
- **DOM:** a lista de alunos nunca renderiza mais de 50 cards por vez,
  independentemente do tamanho da escola.

## 6. Segurança / RLS (B.9)

Checagem item a item das regras invioláveis:

- **`service_role` no front:** não introduzido. As mudanças do front são
  client-side puro (paginação/memo/concorrência); nenhuma chave nova.
- **RLS enfraquecida:** nenhuma política tocada. A migration 0023 é
  **só índices** — não altera política, não muda `using`/`with check`.
- **View/RPC que burle isolamento:** nenhuma criada. `resumo_escola()`
  (preexistente) mantém a matriz RLS no `WHERE` e o `search_path` fixo.
- **Coordenação acessar outra escola / responsável acessar aluno sem
  vínculo / aluno acessar outro aluno:** inalterado e **reconfirmado por
  teste** — `tests/painel-agregado-db.test.mjs` e o novo
  `tests/volume-coordenacao-db.test.mjs` provam isolamento; a suíte
  `tests/isolamento.test.mjs` segue verde (nenhuma tabela/coluna nova
  isolada foi introduzida, então sua lista não precisou mudar).
- **Dado sensível em log:** não introduzido. A massa sintética não tem
  dado pessoal real.
- **Dado pessoal desnecessário em resumo:** `resumo_escola()` retorna só
  `aluno_id` + métricas — inalterado.
- **Validações da Fase A:** nenhuma removida.
- **RPC `SECURITY DEFINER` nova:** nenhuma criada nesta fase.

## 7. Testes executados

- **Build de produção:** `cd app && npm run build` — ✓ verde (920 módulos;
  o aviso de chunk > 500 kB é preexistente e não relacionado a esta fase).
- **Migrations + seed:** `tests/reset-db.sh` do zero, aplicando
  `0001`…`0023` e o seed **duas vezes** (idempotência) — ✓ sem erro; a
  0023 aplica limpo nas duas passadas.
- **Suíte completa** (`tests/`, Postgres 16 local): `npm test` —
  **184/184 verdes** (170 da Fase A + 10 das novas funções puras + 4 do
  teste de volume/índices/isolamento). Rodada duas vezes (antes e depois do
  ajuste de `pool.end` no teardown do teste de volume).
- **Massa de volume:** `supabase/seed-volume/massa_coordenacao.sql`
  aplicada duas vezes contra o banco semeado — ✓ sem erro, contagens
  idênticas.
- **`EXPLAIN`** dos predicados por `escola_id` — confirma uso dos índices
  novos quando seletivos (§5).
- **E2E (Playwright):** **não executado nesta sessão** — mesma limitação da
  Fase A: o ambiente remoto bloqueia o download do binário do Chromium
  (`cdn.playwright.dev` fora da allowlist) e a instalação de dependências
  de sistema via apt. A suíte E2E roda no CI do GitHub a cada push;
  recomenda-se confirmar lá antes do merge/deploy, exercitando as abas da
  coordenação (Alunos com paginação, Turmas, Ranking) sob a massa de
  volume.
- **Manual (3 perfis, paginação real no navegador):** não executado por
  falta de browser no ambiente (mesma limitação). Mitigado por: build verde
  (valida sintaxe/módulos de todas as telas alteradas) + testes de banco
  que exercitam a agregação/isolamento sob volume. Recomenda-se rodar
  manualmente com a massa aplicada antes do go-live.

### Evidências
```
$ cd app && npm run build
✓ 920 modules transformed.
✓ built in 6.68s

$ cd tests && PGPORT=5432 ... npm test
1..184
# pass 184
# fail 0

$ psql ... -f supabase/seed-volume/massa_coordenacao.sql   (2x)
=== 1a execucao OK ===
=== 2a execucao OK (idempotente) ===
 alunos | turmas | sem_credencial | registros | simulados | consentimentos
    481 |      7 |             96 |      2403 |       162 |            361

$ EXPLAIN ... where escola_id = '...'   (filtro seletivo)
 Index Scan using idx_registros_escola on registros_estudo
 Bitmap Index Scan on idx_consentimentos_escola
```

## 8. Pendências (P0–P3)

| Prioridade | Pendência | Por que não foi resolvido agora | Onde |
|---|---|---|---|
| P2 | E2E e teste manual da paginação/turmas não rodados nesta sessão | ambiente sem browser (Chromium bloqueado na allowlist de rede) — igual à Fase A | §7; CI do GitHub |
| P2 | Carga real com 500 alunos + muitas escolas coexistindo não medida em produção | requer ambiente de staging com dados de várias escolas; o ganho dos índices só aparece nesse cenário | §5 |
| P3 | Filtro/busca segue client-side (não no banco) | justificado nesta escala (abas Painel/Ranking precisam do conjunto inteiro); virar DB-side exigiria API paralela + lógica duplicada | §4 (B.3) |
| P3 | `Turmas.renomear/excluir` ainda usa `window.prompt/confirm` sem trava de "ocupado" | herdado da Fase A (P3 de lá); fora do escopo mínimo de performance | `docs/relatorios/relatorio-fase-a.md` §5 |

Nenhuma pendência P0 ou P1 introduzida por esta fase.

## 9. Decisão de prontidão

**A coordenação está apta a operar uma base de 300–500 alunos no primeiro
piloto controlado.** As quatro lacunas de volume encontradas no
diagnóstico foram corrigidas (paginação, concorrência em lote, memoização
de turmas, índices de tenant), todas com justificativa amarrada a uma
consulta/tela real e sem adicionar complexidade especulativa. A peça mais
pesada (agregação no banco) já existia e foi verificada. Build verde,
184/184 testes verdes, isolamento entre escolas reconfirmado por teste sob
volume, segurança/RLS intactas.

Recomendação antes do go-live real: (a) rodar a suíte E2E no CI com a massa
de volume aplicada; (b) validar manualmente a paginação e as abas da
coordenação no navegador com 300–500 alunos; (c) confirmar em staging, com
múltiplas escolas, o ganho dos índices da 0023 sob carga. Nenhuma dessas é
bloqueante de código — são confirmações de ambiente, na mesma linha das
pendências de infra já registradas na Fase A.
