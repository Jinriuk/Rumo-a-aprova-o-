# Auditoria de lentidão — set/2026

Diagnóstico do travamento relatado na entrada do sistema e durante o uso.
Nenhum código foi alterado nesta auditoria: este documento é só o diagnóstico
e a lista priorizada.

Base: commit atual de `claude/system-performance-analysis-0exixe`.
Build medido localmente (Vite 8.2.2, 1.126 módulos, 1,29 s).
Contagens de linha lidas do projeto de PRODUÇÃO `zckyhihxjjbnqjqilymn` (sa-east-1).
Advisors de performance do Supabase consultados em 11/09/2026.

---

## 1. Método

O caminho inteiro foi separado em cinco camadas independentes, cada uma
testada contra evidência (build real, banco real, advisor real):

| # | Camada | Veredito |
|---|--------|----------|
| 1 | Entrega (Vercel, CDN, headers, cache) | **Inocente** — 1 defeito menor |
| 2 | Bundle (o que o navegador baixa e executa) | **Culpado** |
| 3 | Renderização (custo de pintura na tela) | **Culpado nº 1** |
| 4 | Rede de dados (quantas viagens, em que ordem) | **Culpado** — ~165 ms por viagem, medido |
| 5 | Banco (Postgres, RLS, índices) | **Inocente hoje** |

## 2. O que descarta cada suspeita

- **Não é a Vercel.** O deploy é HTML + JS estático na CDN de borda. Não há
  função serverless, SSR nem cold start de função no caminho da entrada.
  O único defeito de entrega encontrado é falta de cache imutável em `/assets/*`.
- **Não é volume de dados** *(confirmado no banco de produção — ver §8 sobre a
  contagem errada que esta linha trazia antes)*. Em `zckyhihxjjbnqjqilymn`:
  `alunos` = 1, `registros_estudo` = 0, `simulados` = 0,
  `aluno_eventos_progresso` = 0.
- **Não é RLS mal escrita** *(no banco medido)*. O advisor não acusou
  `auth_rls_initplan` nem `multiple_permissive_policies` — a migration 0029
  resolveu isso.
- **É a soma de latência com desenho de carregamento.** Muitas viagens, uma
  esperando a outra, contra um servidor longe e num plano compartilhado.

## 3. A escada de boot (aluno)

Cada degrau só começa quando o anterior termina. Estimativa a 150 ms por
viagem (latência típica Brasil → `us-east-1`).

| # | Degrau | ms |
|---|--------|----|
| 01 | HTML + `index.js` 449 kB + `motion` 82 kB + CSS 39 kB | ~400 |
| 02 | React renderiza e só então injeta o `@import` das fontes | ~300 |
| 03 | `signInWithPassword` — DNS + TLS + bcrypt, sem preconnect | ~250 |
| 04 | `souSuperAdmin()` (RPC) | ~150 |
| 05 | `meuPerfil()` → `usuarios`, depois `escolas` (2 em fila) | ~300 |
| 06 | **`INITIAL_SESSION` refaz 04–05** | ~300 |
| 07 | Download do chunk `AreaAluno` (82 kB) | ~180 |
| 08 | `meuAluno()` | ~150 |
| 09 | `carregarTrilha()` — 4 queries | ~200 |
| 10 | `listarConcursos()` — baixa todos pra achar um | ~150 |
| 11 | `carregarOnboarding()` | ~150 |
| 12 | **`useTrilha` chama `carregarTrilha()` de novo** + metas/registros/simulados/XP/missões | ~350 |

**~22 requisições, ~2,9 s só de espera de rede, com o servidor quente.**
Os degraus 06 e parte do 12 são trabalho repetido.

## 4. Achados, por ganho ÷ esforço

### 01 — Cena do login anima 25 elementos infinitos sobre blur de 74 px
`src/routes/publico/PortalLogin.jsx` + `src/shared/ui/experiencia.css`
**Renderização · ~1 dia · crítico**

Em loop infinito: 14 estrelas (`opacity` + `scale`), duas auroras de até 880 px
com `filter: blur(74px)` e `mix-blend-mode: screen` animando escala, uma grade
animando `backgroundPosition`, três pontos animando `boxShadow`, um traço SVG
animando `strokeDashoffset`, dois anéis girando e uma faixa de luz varrendo
260 vw. O comentário do arquivo afirma que "Motion cuida apenas de
transform/opacity/pathLength" — três dessas propriedades forçam repintura de
tela cheia a cada quadro.

Agravante: `.login-card` tem `backdrop-filter: blur(24px) saturate(118%)` por
cima das auroras em movimento, obrigando o navegador a recalcular o desfoque do
fundo do cartão em todo quadro.

Correção: `efeitos = false` por padrão em tela estreita e `(pointer: coarse)`;
`backgroundPosition` → `translate3d`; remover `mix-blend-mode` e a animação de
`scale` das auroras; `boxShadow` pulsante → `opacity` em pseudo-elemento;
carregar a cena com `lazy()` depois do formulário ficar interativo.

### 02 — `carregarTrilha()` roda duas vezes por entrada de aluno
`src/routes/aluno/AreaAluno.jsx` + `src/modules/conteudo/useTrilha.js`
**Rede · ~2 h · crítico**

`AreaAluno` chama `db.carregarTrilha(a.trilha_id)` só para pegar `semanas`.
`VisaoEstudo` monta e `useTrilha` chama de novo com o mesmo id. São 4 queries
duplicadas, a mais pesada sendo `atividades_modelo` com `select("*")`.

Correção: carregar num lugar só e passar por prop, ou promover `useTrilha` a
fonte única.

### 03 — O perfil é carregado duas vezes em todo boot
`src/shared/hooks/useSessao.js`
**Rede · ~1 h · crítico**

`useSessao` faz `db.sessaoAtual().then(carregarPerfil)` *e* assina
`aoMudarSessao`. O supabase-js v2 emite `INITIAL_SESSION` logo após a
assinatura, então `carregarPerfil` roda duas vezes em paralelo — 6 requisições
onde bastavam 3. O ciclo se repete a cada refresh de token e ao voltar para a
aba, e cada volta cria um `perfil` novo que re-renderiza a árvore inteira.

Correção: deixar `onAuthStateChange` como única entrada, ou ignorar eventos
cujo `access_token` seja igual ao já resolvido.

### 04 — Fontes só começam a baixar depois do React renderizar
`src/shared/ui/tema.js` (`FONTES_CSS`), injetado em 5 componentes
**Bundle · ~15 min**

`@import` de fonts.googleapis.com dentro de um `<style>` injetado em runtime.
O navegador só descobre que precisa das fontes depois de baixar, analisar e
executar 449 kB de JS. Duas viagens extras em série + salto de texto visível.

Correção: `<link rel="stylesheet">` no `index.html` + `preconnect` para
`fonts.gstatic.com`. O CSP já permite ambos os domínios.

### 05 — Falta `preconnect` para o Supabase
`app/index.html`
**Entrega · ~5 min**

DNS + TCP + TLS só começam na primeira chamada do JS. Uma linha antecipa o
handshake e tira 200–300 ms do login.

### 06 — `/assets/*` sem cache imutável
`vercel.json`
**Entrega · ~10 min**

Headers de segurança existem para `/(.*)`, mas nenhum `Cache-Control`. Com
`framework: null`, estáticos caem no padrão `max-age=0, must-revalidate` — toda
recarga revalida os 10 chunks, que têm hash no nome e nunca mudam.

Correção: bloco extra com `source: "/assets/(.*)"` e
`Cache-Control: public, max-age=31536000, immutable`.

### 07 — `realtime-js` e `storage-js` no bundle sem uso
`src/lib/supabase.js`
**Bundle · ~meio dia**

O chunk principal tem 23 referências a `realtime`. Zero uso de `.channel()` ou
`.subscribe()` em todo o `src/`. O `supabase-js` é pacote guarda-chuva e sempre
arrasta realtime, storage e functions.

Correção: usar `@supabase/auth-js` + `@supabase/postgrest-js` diretos, com
`functions-js` só onde há Edge Function. O seam de dados já isola isso num
arquivo — a troca não vaza para nenhuma tela.

### 08 — Coordenação espera 8 leituras para ver qualquer aba
`src/routes/escola/AreaEscola.jsx`
**Rede · ~meio dia**

`Promise.all` com turmas, alunos, consentimentos, 100 logs de acesso,
concursos, resumo agregado, todos os simulados da escola e trilhas. A aba
Painel precisa de 2 das 8. Logs só servem à aba LGPD; simulados, à aba Ranking.

Correção: duas ondas — alunos + resumo desbloqueiam o Painel; o resto sob
demanda por aba. `useRecurso` já suporta.

### 09 — `listarConcursos()` baixa o catálogo inteiro para achar um item
`src/routes/aluno/AreaAluno.jsx`
**Rede · ~10 min**

`select("*")` + `.find(x => x.id === a.concurso_id)` no cliente. Há 34
ocorrências de `select("*")` no seam; a maioria é inofensiva hoje, esta tem
substituição direta: `.eq("id", ...).maybeSingle()`.

### 10 — `meuPerfil()` gasta duas viagens
`src/shared/data/index.js`
**Rede · ~2 h**

Lê `usuarios` e só depois `escolas`. Como o perfil recarrega a cada refresh de
token, as duas viagens em fila reaparecem o dia todo.

Correção: embed do PostgREST —
`select("id, papel, nome, must_change_password, escolas(id, nome, slug, logo_url, cor_acento, status, plano)")` —
uma viagem, mesma RLS.

### 11 — Contexto de marca re-renderiza tudo
`src/shared/branding/BrandingContext.jsx`
**Renderização · ~30 min**

`value={{ escola, tema, aplicarMarca }}` é literal novo em toda renderização.
`useTema()` aparece 92 vezes em 36 arquivos. É por isso que o `React.memo` do
componente `Mini` em `AreaEscola` não segura nada.

Correção: `useMemo` no value e `useCallback` no `aplicarMarca`. O projeto tem
43 `useMemo` e só 6 `useCallback` — o desequilíbrio aponta para este ponto.

### 12 — `carregarXpPersistido` lê o ledger inteiro
`src/shared/data/index.js`
**Rede · ~2 h**

Sem `limit`, sem agregação: traz todos os eventos e faz `reduce` no navegador,
em toda recarga da tela de estudo. Invisível com 1 linha; caro com um ano de uso.

Correção: RPC que devolva o total somado no banco, no padrão de `resumo_escola`
(migration 0016).

## 5. Infraestrutura — o multiplicador

| Fato | Verificado | Efeito |
|------|-----------|--------|
| Banco **de teste** em `us-east-1` | sim | ~150 ms por viagem do Brasil, × 12 camadas |
| Organização no plano **free** | sim | CPU compartilhada: bcrypt do login e PostgREST disputam recurso |
| Projeto free pausa após 7 dias sem uso | política | Primeiro acesso da semana pode levar dezenas de segundos |
| `app/.env.production` → projeto de demo/vitrine | sim | Mas `VITE_SUPABASE_URL` no Vercel sobrescreve: o Vite prioriza `process.env` |
| Banco de **produção** em `sa-east-1` | **não** | Informado pelo dono; fora do alcance desta auditoria — ver §7 |
| 19 FKs sem índice de cobertura | sim | Irrelevante com 1 aluno; dói a partir de centenas |
| Projeto Vercel não apareceu na conta conectada | **não** | `list_projects` voltou vazio — sem acesso a logs/analytics |

Migrar região exige recriar o projeto e restaurar dump — não é ajuste de
painel. Antes de pagar esse custo, executar os achados 01–06: eles cortam o
número de viagens, que é justamente o que a distância multiplica.

## 6. Medir antes de mexer

A saída de rede do ambiente desta auditoria para o Supabase está bloqueada por
política, então a latência real não foi medida. Três medições no aparelho de
quem usa resolvem isso:

1. **Latência de base** — DevTools → Network, filtrar `supabase.co`, olhar a
   coluna Waiting (TTFB). Mínimo ≥ 150 ms confirma a distância.
2. **Custo de pintura do login** — DevTools → Performance, gravar 5 s parado na
   tela de login sem tocar em nada. FPS abaixo de 60, ou barras largas de
   Rendering/Painting, confirmam o achado 01.
3. **Contagem de viagens** — Network com "Preserve log", fazer login, contar as
   linhas até o painel. Mais de 20 confirma a escada. `usuarios` ou `escolas`
   aparecendo duas vezes confirma o achado 03.

---

---

## 7. Fechamento — o que foi medido em produção e corrigido

Esta seção substitui a revisão anterior sobre região, que partia de premissa
errada. O sistema de produção foi aberto no Chrome e medido em
`app.trilivaedu.com.br`; os números abaixo vêm de lá.

### Ambiente real

Produção é `zckyhihxjjbnqjqilymn`, **sa-east-1**, org `eerbpzacxolwlwsltynb`,
criado em 03/09/2026. A auditoria original concluiu "não existe projeto de
produção" a partir de uma listagem que só enxerga a organização do token —
`get_project` por ref funciona fora dela. Conclusão retirada.

Catálogo cheio, tenant vazio: `subassuntos` 354, `questoes_prova` 203,
`atividades_modelo` 159, `trilha_plano_missoes` 99, `concursos` 6; `alunos` 1,
`simulados` 0, `registros_estudo` 0, `aluno_eventos_progresso` 0.
Advisor de produção limpo de RLS, e as mesmas 19 FKs sem índice.

### Três correções ao diagnóstico original

**1. Região não dividiu nada.** Medido do navegador: **~165 ms por requisição**
ao banco de produção em sa-east-1. A escada de 12 degraus custa o que a
auditoria estimou. Os achados de rede valem mais, não menos.

**2. O banco não é o gargalo, e o plano free não compraria isso.**
`EXPLAIN ANALYZE` em produção: `atividades_modelo` executa em 3,485 ms,
`concursos` em 1,291 ms. O Postgres é 2–9 ms dos 165. O resto é rede, TLS,
Kong e PostgREST. Só **remover viagens** corta esse tempo.

**3. O achado 01 tinha o mecanismo errado.** A tela de login rodava a 9 fps
**com os efeitos pausados**, ou seja, sem nada animando. A causa não era
animação: era composição estática. O código explica — `Login.jsx` põe
`data-effects` no shell, mas nenhuma regra de CSS usa esse atributo; ele só
alimenta o `MotionConfig`. O botão nunca alcançou a pilha de blur, que é CSS
incondicional. A correção originalmente proposta (`efeitos = false` no mobile)
compraria zero.

Custo isolado por eliminação: 9 fps como estava → 33 sem as `.portal-aurora`
(`blur(74px)` + `mix-blend-mode: screen`) → 57 sem o `backdrop-filter` do
`.login-card` → 58 sem nenhum blur.

### O que foi corrigido

| Onda | O que entrou | Resultado |
|---|---|---|
| 1 | `preconnect` (Supabase + fontes), cache imutável em `/assets/*`, fontes no `index.html`, `concursoPorId` filtrando no banco | ~900 ms medidos |
| 2 | Removida a pilha de blur do login: `blur(74px)` e `mix-blend-mode` das auroras, os dois `backdrop-filter`, `blur(38px)` do glow, `box-shadow: inset` de 180 px da vinheta | **6 → 59 fps**, A/B na mesma máquina |
| 3 | Boot duplicado do perfil, trilha carregada uma vez só, embed do PostgREST em `meuPerfil`, concurso e onboarding em paralelo | 4 viagens a menos × ~165 ms |

A Onda 2 saiu visualmente muito mais barata que o previsto: comparadas as
capturas antes/depois em 1440×900 e 390×844, o layout é idêntico e a cena
segue legível. O `backdrop-filter` do cartão era invisível de qualquer forma —
o fundo próprio dele já é ~90% opaco.

### O que ficou pendente, e por quê

- **Onda 2b (fase visual)** — fundo de imagem + ícones, na linha do portal de
  referência. Nasce sobre uma composição que já não custa nada. Regra que vem
  junto: zero `blur`, zero `backdrop-filter`, zero `mix-blend-mode`, e
  orçamento de **uma imagem ≤150 kB** (a referência gasta 4,7 MB — é mais leve
  de pintar e mais pesada de baixar; copiar só a disciplina de composição).
- **Onda 4 (tirar `realtime` do bundle)** — adiada e condicionada. O
  `supabase-js` é quem propaga o access token do auth-js para o PostgREST; ao
  montar os clientes à mão essa fiação vira código nosso, e num sistema com
  isolamento por RLS um bug ali sai como requisição com token velho, sem erro
  visível. O ganho encolheu para dezenas de ms de *parse*. Só executar se uma
  medição em celular real mostrar que o bundle ainda é gargalo.
- **Onda 5** — pré-requisito: `VACUUM ANALYZE` em produção. `concursos` e
  `alunos` têm `reltuples = -1` com `last_analyze` e `last_autoanalyze` nulos:
  **nunca foram analisadas**. O autovacuum só dispara com 50 linhas + 10%,
  limiar que tabela pequena nunca atinge — é condição permanente, não
  estatística velha. Sem isso os 19 índices de FK entram num planner sem
  estatística para decidir usá-los. Repetir depois da primeira escola real.
- **Pause de 7 dias do plano free** — decisão de negócio: fica no free durante
  a prospecção. Seguro proposto: workflow agendado no GitHub Actions batendo no
  REST a cada 3 dias (`pg_cron` não serve, o contador olha requisição de API).
  Atenção: workflow agendado é desativado após 60 dias sem atividade no repo.

### Limites desta verificação

- Os FPS foram medidos em renderização por software (Basic Render Driver no
  Chrome do dono; Chromium headless aqui). O ranking está confirmado por duas
  medições independentes, mas **nenhuma foi em celular** — que é o aparelho do
  aluno e onde blur de raio grande dói mais.
- A suíte **E2E não pôde ser executada** no ambiente da correção: o proxy de
  egresso bloqueia `supabase.co` (`net::ERR_CONNECTION_RESET`). O que dependia
  dela — os fluxos de login dos quatro papéis após a Onda 3 — foi verificado
  estaticamente (FK e colunas do embed conferidas no banco real, garantia de
  `INITIAL_SESSION` lida no auth-js instalado, consumidores do perfil
  auditados), mas não exercitado ponta a ponta.

---

## 8. Correção — as contagens do banco de TESTE estavam erradas

Registrado em 11/09, depois do fechamento do §7.

As contagens do projeto de teste/demo `bdjkgrzfzoamchdpobbl` que apareciam no §2
deste relatório (`alunos` = 1, `usuarios` = 2, `registros_estudo` = 1) **estavam
erradas**. Elas vieram de `pg_stat_user_tables.n_live_tup`, que é alimentado
pelo coletor de estatísticas — e este relatório mesmo descobriu, no §7, que
essas tabelas **nunca foram analisadas**. Sem `ANALYZE`, esse campo lê zero (ou
quase) mesmo com a tabela cheia. Usei um número de estatística como se fosse
contagem.

Contado com `count(*)` em 11/09:

| Tabela | Demo (`bdjkgrzfzoamchdpobbl`) | Produção (`zckyhihxjjbnqjqilymn`) |
|---|---:|---:|
| escolas | 4 | 1 |
| usuarios | 78 | 1 |
| alunos | 69 | 1 |
| turmas | 8 | 1 |
| registros_estudo | 457 | 0 |
| simulados | 53 | 0 |
| metas | 547 | 2 |
| meta_atividades | 3.056 | — |
| aluno_eventos_progresso | 1.003 | 0 |
| consentimentos | 19 | 1 |
| vinculos_responsaveis | 4 | 0 |
| logs_acesso | 1.010 | 0 |

### O que muda, e o que não muda

**Não muda nenhuma conclusão de performance.** As conclusões do §7 são sobre
PRODUÇÃO, e produção está mesmo vazia — a contagem real confirma (1 aluno, 0
registros, 0 simulados, 0 eventos). Os achados 08 e 12, rebaixados por falta de
dado de tenant, seguem rebaixados.

**Muda a leitura do ambiente de demo.** O demo não é um banco vazio: tem a
escola de vitrine "Matriz Educação RM" com 60 alunos fictícios, 4 turmas, 430
registros e 51 simulados. É o ambiente certo para qualquer varredura visual ou
de UX — produção mostraria estado vazio em toda tela.

**Lição de método:** `n_live_tup` e `reltuples` são estimativas do planner, não
contagem. Num banco que nunca rodou `ANALYZE`, eles mentem. Para decidir
qualquer coisa com base em volume, usar `count(*)`.

### Achado colateral

O projeto de demo está no **plano free**, igual ao de produção — ou seja,
**também pausa após 7 dias sem uso**. O workflow `manter-banco-acordado.yml`
(PR #98) cobre só produção. Como a vitrine é a peça de apresentação para
escolas, ela pode estar dormindo na hora de uma demonstração. O mesmo workflow
resolve, com um segundo par de secrets apontando para o ref do demo.
