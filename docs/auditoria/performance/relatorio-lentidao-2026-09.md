# Auditoria de lentidão — set/2026

Diagnóstico do travamento relatado na entrada do sistema e durante o uso.
Nenhum código foi alterado nesta auditoria: este documento é só o diagnóstico
e a lista priorizada.

Base: commit atual de `claude/system-performance-analysis-0exixe`.
Build medido localmente (Vite 8.2.2, 1.126 módulos, 1,29 s).
Contagens de linha lidas direto do projeto Supabase `bdjkgrzfzoamchdpobbl`.
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
| 4 | Rede de dados (quantas viagens, em que ordem) | **Culpado nº 1** |
| 5 | Banco (Postgres, RLS, índices) | **Inocente hoje** |

## 2. O que descarta cada suspeita

- **Não é a Vercel.** O deploy é HTML + JS estático na CDN de borda. Não há
  função serverless, SSR nem cold start de função no caminho da entrada.
  O único defeito de entrega encontrado é falta de cache imutável em `/assets/*`.
- **Não é volume de dados.** No banco de produção: `alunos` = 1 linha,
  `usuarios` = 2, `registros_estudo` = 1, `aluno_eventos_progresso` = 1.
- **Não é RLS mal escrita.** O advisor não acusou `auth_rls_initplan` nem
  `multiple_permissive_policies` — a migration 0029 resolveu isso.
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
| Banco em `us-east-1` | sim | ~150 ms por viagem do Brasil, × 12 camadas |
| Organização no plano **free** | sim | CPU compartilhada: bcrypt do login e PostgREST disputam recurso |
| Projeto free pausa após 7 dias sem uso | política | Primeiro acesso da semana pode levar dezenas de segundos |
| Produção aponta para o projeto de demo/vitrine | sim | `app/.env.production` → `bdjkgrzfzoamchdpobbl` |
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
