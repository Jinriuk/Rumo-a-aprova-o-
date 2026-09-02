# Mapeamento de marca — "Rumo à Aprovação" → "Triliva"

**Data:** 2026-09-02 (revisão 3 — a troca foi executada)
**Autor:** levantamento técnico (Claude Code), a pedido de Gabriel
**Natureza deste documento:** mapeamento de ocorrências + o registro da troca de nome
executada em 02/09/2026. Não altera schema e não compra domínio.

## ⚠️ A troca foi feita com as três checagens ainda pendentes

Gabriel autorizou explicitamente a troca **antes** de qualquer uma das checagens, após a
ressalva ter sido levantada. Fica registrado que continuam abertas:

- [ ] INPI — classes de software e educação, incluindo colisão fonética com **Trillia** (marca
      nova da B3, 2026) e **Trillio** (plataforma de treinamento corporativo usada por
      Nubank/Mercedes-Benz/Leroy Merlin).
- [ ] registro.br — disponibilidade de `triliva.com.br`.
- [ ] Teste de pronúncia com 10 pessoas.

O risco que motivou este mapeamento (adotar nome que colide com marca de terceiro) **não foi
eliminado, apenas transferido para o novo nome**. Se o INPI apontar colisão com Trillia/Trillio,
a reversão é barata pelo desenho da §1.1 (uma linha em `marca.js` + os textos da §1.6), mas
material comercial já distribuído com "Triliva" não volta atrás.

---

## 0. O que a revisão 2 corrigiu na revisão 1

A primeira versão deste documento tinha quatro afirmações que a auditoria contra o código e
contra as regras do próprio repositório derrubou ou reduziu. Ficam registradas para não
serem repetidas:

| Afirmação da rev. 1 | O que a evidência mostrou | Efeito |
|---|---|---|
| "Trocar o domínio exige editar 4 arquivos de Edge Function" — criticidade ALTA | A origem de produção (`ALLOWED_ORIGINS`) e o redirect de senha (`PASSWORD_RESET_REDIRECT_URL`) **já eram** secrets, desde SEG2/PROD1 (`docs/operacao/migracao-producao-dedicada.md` §4). Só o regex de preview da Vercel estava hardcoded. | Criticidade rebaixada para BAIXA. O resíduo (regex de preview) virou secret `VERCEL_PREVIEW_PREFIX` — ver §1.5. |
| "`MenuPrincipal.jsx:134` é bug de white-label" | O white-label é **leve por decisão** (`docs/fundacao/06-arquitetura-fechada.md` §1.2): marca da escola *por cima* de um design fixo, e o rodapé é a "assinatura discreta da plataforma" (comentário no próprio arquivo). A segunda linha é intencional. | O defeito real é menor: sem escola (ou quando a "escola" é a própria plataforma, no fluxo de recuperação), as duas linhas repetiam o mesmo texto. Corrigido — ver §1.1. |
| "`docs/operacao/` é histórico, mesma categoria de `backlog/`/`adr/`" | `docs/README.md` diz o oposto: `fundacao/` e `operacao/` são **referência viva**; histórico é `auditoria/` (fases) e `auditoria/antigos/`. | Reclassificado em §1.7/§1.8. `operacao/` **entrou** na troca de marca. |
| "Supabase: só o nome do projeto carrega a marca" | A org também ("Central de projetos - Rumo ao Milhão com SaaS") e o nome já planejado do projeto de produção ("Rumo à Aprovação — PRODUÇÃO"). | Adicionados em §2. |
| "Vercel: o projeto existe em outra conta" (rev. 2) | O Vercel GitHub App comentou no PR #88 com o projeto `rumo-a-aprova-o` no time `jinriuk-s-projects` — o mesmo time que a API desta sessão lista vazio. É falta de permissão do token, não conta diferente. | Corrigido em §3. |
| "O mapeamento cobriu tudo que carrega a marca na home" (rev. 1 e 2) | A busca procurou o **literal** "Rumo à Aprovação" e a composição visual, e por isso não pegou o **trocadilho conceitual** em texto de marketing: "PREPARAÇÃO MILITAR COM DIREÇÃO" e "o edital vira rota". Achado só quando Gabriel mandou a screenshot da home. | Nova §1.6. |

---

## 1. Repositório (`Jinriuk/Rumo-a-aprova-o-`)

### 1.1 Código-fonte — strings de UI (agora centralizadas)

**Antes:** 5 literais independentes em 4 arquivos, sem constante central.
**Agora:** fonte única em `app/src/shared/branding/marca.js` (`NOME_PLATAFORMA`,
`ORIGEM_PRODUCAO`); os 4 arquivos importam de lá. `NOME_PLATAFORMA` = **"Triliva"**.

`ORIGEM_PRODUCAO` **não** mudou e continua `https://rumo-a-aprova-o.vercel.app`: é o domínio
real em produção, não a marca. Só muda quando o projeto for renomeado no painel da Vercel — e
trocar essa string antes disso quebra o redirect de redefinição de senha.

| Arquivo | O que exibe | Estado |
|---|---|---|
| `app/src/shared/branding/marca.js` | `NOME_PLATAFORMA`, `ORIGEM_PRODUCAO` | **Único lugar** com o literal |
| `app/src/routes/publico/PortalLogin.jsx` (`MarcaPortal`) | wordmark do login | importa `NOME_PLATAFORMA` |
| `app/src/App.jsx` (fluxo de recuperação de senha) | tenant-fallback do `BrandingProvider` | importa `NOME_PLATAFORMA` |
| `app/src/shared/ui/MenuPrincipal.jsx` (rodapé da sidebar) | nome da escola + assinatura da plataforma | importa `NOME_PLATAFORMA`; assinatura só aparece quando o nome exibido **difere** da plataforma (antes repetia o mesmo texto em duas linhas quando não havia escola) |
| `app/src/shared/data/index.js` (`recuperarSenha`) | fallback de origem quando não há `window` | importa `ORIGEM_PRODUCAO` |

Uma troca de nome do produto passa a ser **uma linha** em `marca.js`. Fora disso, o `<title>`
em `app/index.html` já era genérico ("Painel de Estudos") e não muda.

### 1.2 `package.json` / `package-lock.json`

| Arquivo | Antes | Agora |
|---|---|---|
| `app/package.json` (+ espelho em `package-lock.json`) | `rumo-aprovacao-app` | `triliva-app` |
| `tests/package.json` (+ lockfile) | `rumo-aprovacao-tests` | `triliva-tests` |

Os lockfiles foram editados **só nos dois campos `name`**, não regenerados: o npm local
(10.9.7) remove campos `libc` de pacotes opcionais do rollup, ruído sem relação com o rename
que poderia afetar instalação em musl. `npm ci` foi rodado do zero nos dois pacotes para provar
que `package.json` e lockfile não divergiram — é o modo que o CI usa e que falha se divergirem.

### 1.3 `README.md` (raiz — referência viva)

| Linha | Conteúdo |
|---|---|
| 1 | `# Triliva — sistema multi-tenant de acompanhamento de estudos` (era "Rumo à Aprovação") |
| 4 | menção a **"Rumo ao Naval"** — nome **anterior e distinto** (o painel de uma escola só do qual o sistema nasceu; `docs/fundacao/01-visao-geral.md:5` conta a mesma origem). Uma troca da marca atual não decide sozinha se essa referência de origem fica. Pergunta em aberto para Gabriel. |
| 28 | `rumo_teste` — nome do banco local de testes (também em `tests/reset-db.sh`, `.github/workflows/ci.yml:52`, `.env.example:27`) |

### 1.4 CI / configuração

| Arquivo | Ocorrência | Observação |
|---|---|---|
| `.github/workflows/ci.yml:52` | `PGDATABASE: rumo_teste` | nome técnico do banco efêmero de CI, não é marca visível |
| `.env.example:27` | `PGDATABASE=rumo_teste` | idem |
| `vercel.json` | nenhuma | config genérica (build, headers, rewrites) |
| `app/.env.production` | nenhuma | só URL/anon key do projeto `bdjkgrzfzoamchdpobbl` (ref técnico) |

### 1.5 Supabase Edge Functions — CORS / redirect (criticidade corrigida: BAIXA)

Todos os pontos em que o domínio aparece já são, ou passaram a ser, **configuráveis por secret**
sem editar código:

| O quê | Secret | Existia? |
|---|---|---|
| Lista de origens permitidas (produção) | `ALLOWED_ORIGINS` (CSV, substitui o default) | Sim (SEG2 / E-1) |
| Destino do link de redefinição de senha | `PASSWORD_RESET_REDIRECT_URL` | Sim (PROD1) |
| Slug do projeto na Vercel, para liberar previews `<slug>-*.vercel.app` | `VERCEL_PREVIEW_PREFIX` | **Não — adicionado nesta revisão** (só aceita `[a-z0-9-]`; valor inválido cai no default; testado com 9 casos, incluindo tentativa de metacaractere e slug alheio) |

Os **defaults** (`rumo-a-aprova-o.vercel.app`, `rumo-a-aprova-o`) continuam em 4 arquivos:
`_shared/cors.ts` (canônico) e cópias próprias em `backoffice-coordenador`,
`revogar-responsavel` e `provisionar-aluno`. Isso é **deliberado e anterior a esta tarefa**
("cópia mínima de propósito, para não depender do bundler de `_shared/`" — comentário nos
próprios arquivos; o deploy via MCP `deploy_edge_function` é caminho oficial em
`docs/operacao/rollback.md`). Consolidar as cópias num import quebraria esse caminho de
deploy, então **não foi feito**. As funções `lgpd-titular`, `gerar-meta` e `virar-semana`
importam o canônico via `_shared/contexto.ts` e não duplicam nada.

Consequência prática: trocar domínio/slug na Vercel = definir até 3 secrets. Editar os 4
arquivos só é necessário se alguém quiser mudar o *default* (o que só faz sentido num rename
definitivo).

**Atenção operacional:** as 4 funções foram alteradas no repositório e **não foram
redeployadas**. O comportamento sem o secret é idêntico ao anterior, então não há urgência;
mas o código deployado fica atrás do repositório até o próximo deploy (runbook em
`docs/operacao/rollback.md`).

### 1.6 Copy conceitual — o trocadilho com "Rumo" em texto (achado tardio)

As rev. 1 e 2 procuraram o **literal** "Rumo à Aprovação" e descreveram a composição visual do
login, mas não pegaram o texto de marketing que joga com o **sentido** da palavra "rumo"
(direção, rota). Só apareceu quando Gabriel mandou a screenshot da home:

| Arquivo:linha | Texto | Onde aparece |
|---|---|---|
| `app/src/routes/publico/Login.jsx:474` | "PREPARAÇÃO MILITAR COM **DIREÇÃO**" | tarja acima do título da home |
| `app/src/routes/publico/PortalLogin.jsx:12` | "Plano — o edital vira **rota**" | primeiro marco do mapa da missão |

**Não foram alterados**, por dois motivos: (a) não são o nome da marca, e (b) "Triliva" evoca
*trilha*, que é a mesma família semântica de rota/caminho — o gancho continua de pé, e o
sistema já usa "Trilha" como termo de produto (`trilhas_missoes`, aba "Trilha"). Se a marca
final for outra, sem sentido de percurso, essas duas linhas perdem o sentido e viram trabalho
de copy.

Lição para o método: uma busca por marca precisa cobrir o **campo semântico** do nome, não só
o literal. Se "Triliva" for adotado em definitivo, o equivalente aqui seria procurar por
"trilha/percurso/caminho" em texto de UI antes de qualquer nova troca.

### 1.7 Documentação viva (atualizada na troca)

Classificação pela regra do próprio `docs/README.md` ("`fundacao/` e `operacao/` são
referência viva; `auditoria/` registra o que foi feito em cada fase; `antigos/` é histórico").

| Local | Arquivos | O que foi feito |
|---|---|---|
| `README.md` (raiz) | 1 | título → "Triliva" |
| `docs/README.md` | 1 | título do índice → "Triliva" |
| `docs/auditoria/README.md` | 1 | linha de abertura → "Triliva" |
| `docs/00-indices/` | 3 | títulos de mapa geral, linha do tempo e plano set–dez; mais 4 menções ao produto no plano |
| `docs/arquitetura/` | 1 | menção ao produto |
| `docs/operacao/` | 7 | 3 arquivos com menção ao produto trocados; os demais só citam a URL/`rumo_teste`, que não mudam |
| `docs/fundacao/` | 0 | só cita "Rumo ao Naval" (origem) — intocado |

**Deliberadamente não trocados** (trocar faria o doc mentir sobre um fato):

- `docs/00-indices/02-linha-do-tempo.md:93` — a branch `claude/rumo-aprovacao-100-codigo-yb1tfa`
  existiu com esse nome; renomear no doc apontaria para uma branch inexistente.
- `docs/operacao/migracao-producao-dedicada.md:107` — o projeto Supabase **ainda se chama**
  "Rumo à Aprovação — Teste e Vitrine" no painel. A linha foi reescrita para dizer isso e
  apontar o alvo ("Triliva — Teste e Vitrine" / "Triliva — PRODUÇÃO"), em vez de fingir que o
  rename do painel já aconteceu.
- Toda ocorrência de `rumo-a-aprova-o.vercel.app` e de `rumo_teste`: domínio real e nome de
  banco técnico, não marca.

### 1.8 Registro histórico (não alterar — regra confirmada e ampliada)

| Local | Arquivos | Regra |
|---|---|---|
| `docs/backlog/` | 3 | instrução explícita desta tarefa: não alterar |
| `docs/adr/` | 0 | idem (pasta existe, sem ocorrência) |
| `docs/auditoria/` (fases: seg1/seg2/s1/db1/d1a…/av2 etc., sem `antigos/` e sem o README) | 50 | histórico por definição do `docs/README.md` |
| `docs/auditoria/antigos/` | 16 | histórico explícito |
| `docs/fases/` | 1 | histórico de build |
| **Total histórico** | **70** | |

A rev. 1 dizia "~85 arquivos em auditoria/operacao, provavelmente todos históricos". Estava
errado nos dois números e na categoria: são 70 históricos (deixar como estão) e 14 vivos
(entram no rename). Recomendação: tratar a regra "não alterar histórico" como cobrindo
`auditoria/` (fases + antigos), `fases/`, `backlog/` e `adr/`; nada mais precisa de confirmação
de Gabriel além disso.

---

## 2. Supabase (verificado ao vivo, somente leitura)

| Item | Valor atual | Onde aparece | Criticidade |
|---|---|---|---|
| Nome do projeto `bdjkgrzfzoamchdpobbl` | "Rumo à Aprovação — Teste e Vitrine" | painel (metadado); o `ref` da URL é imutável e já dissociado | Baixa — rename de painel, sem migration |
| Nome da organização `ddsfpmyxbitaghvhadov` | "Central de projetos - Rumo ao Milhão com SaaS" | painel; contém "Rumo", mas é outra expressão ("Rumo ao Milhão"), não a marca do produto | Baixa — só se quiser coerência de painel |
| Nome **planejado** do projeto de produção | "Rumo à Aprovação — PRODUÇÃO" (`docs/operacao/migracao-producao-dedicada.md:107`) | ainda não criado | Nenhuma ação agora; ajustar o nome no checklist quando a marca fechar |
| Bucket de Storage | `Logos-escolas` (público) — único bucket | `storage.buckets` | Sem marca |
| Valores em `public.escolas` (`nome`/`slug`/`logo_url`) | 4 escolas, **0** com "rumo" no valor | banco | Sem marca |
| Seed (`supabase/seed/`) | 0 valores com a marca; único hit é um comentário de proveniência em `trilha-cn-v1.json:2` ("importada do Rumo ao Naval") | arquivo | Sem ação |
| Nomes de tabela (`trilhas_missoes` etc.) | modelagem, não marca | — | fora de escopo (confirmado) |

---

## 3. Vercel — painel **não verificável a partir desta sessão**

O que foi possível confirmar (pelo comentário automático do Vercel GitHub App no PR #88, não
pela API):

- Projeto **`rumo-a-aprova-o`** (id `prj_Q7tcLOOTptRgdTrfIUoDFWJDx0oO`) no time
  **`jinriuk-s-projects`** — o mesmo time que a integração desta sessão enxerga.
- O preview do PR saiu como `rumo-a-aprova-o-git-claude-brand-mapp-…-jinriuk-s-projects.vercel.app`,
  que **casa com o default** do regex de preview (§1.5) — validação real do padrão.

O que **não** foi possível:

- `list_projects` nesse time via API: **0 projetos**; `get_project` pelo slug **e** pelo id:
  **404**. O token Vercel conectado a esta sessão não tem visibilidade sobre o projeto, mesmo
  estando no time certo (a rev. 2 dizia "existe em outra conta" — estava errado; é falta de
  permissão do token, não conta diferente).
- `curl https://rumo-a-aprova-o.vercel.app`: bloqueado pela política de rede do ambiente (proxy
  403), não pelo site.

Logo, nome de exibição, domínios anexados e env vars do painel continuam sem verificação
direta. Tudo que se sabe além do acima vem do repositório:

- Projeto/domínio: `rumo-a-aprova-o` → `rumo-a-aprova-o.vercel.app`, sem domínio próprio
  (`docs/auditoria/seguranca/seg2/10-dominio-urls-finais.md`: compra adiada).
- Env vars documentadas: só `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e a opcional
  `VITE_ERROR_REPORT_URL` (`docs/operacao/ambientes-e-variaveis.md`) — nenhuma contém a marca
  em texto.

O que Gabriel (ou quem tem a conta) precisa confirmar no painel: nome do projeto, domínios
anexados, e se há alguma env var além das três acima. Este documento não pôde fazer isso.

Criticidade: trocar o **nome de exibição** não quebra nada. Trocar o **slug** muda a URL
`*.vercel.app` e, com o §1.5 aplicado, se resolve com os 3 secrets das Edge Functions + 1
linha em `marca.js` (`ORIGEM_PRODUCAO`).

---

## 4. Identidade visual

Não há **nenhum arquivo de imagem versionado** (`*.svg`, `*.png`, `*.ico`, `*.webp` fora de
`node_modules`: zero). Toda a identidade é gerada em código. Não existe "arquivo de logo" para
substituir — existem componentes React.

| Elemento | Onde | O que representa visualmente |
|---|---|---|
| **Favicon** | `app/index.html:11` (SVG inline, data-URI) | quadrado navy arredondado com emoji **"⚓"** dourado. O `<title>` já é genérico ("Painel de Estudos"). |
| **Selo padrão do tenant** (`MarcaEscola`) | `app/src/shared/branding/BrandingContext.jsx:37-54` | quando a escola não tem logo: quadrado com gradiente dourado e o mesmo "⚓". É o *fallback* de white-label de qualquer tenant; com logo, usa `escola.nome` no `alt`. |
| **Ícone "ancora"** | `app/src/shared/ui/Icones.jsx:7` (SVG: círculo + haste + travessa curva — uma âncora náutica) | reusado no rodapé da sidebar (`MenuPrincipal.jsx`), no item "Hoje" (`VisaoEstudo.jsx:256`) e no grupo de conquistas "Missões" (`Conquistas.jsx:35-37`). |
| **Wordmark do login** (`MarcaPortal`) | `app/src/routes/publico/PortalLogin.jsx:50-67` | ícone SVG (dois círculos concêntricos + cruz de mira + um check) ao lado do texto `NOME_PLATAFORMA` + subtítulo "Central de preparação". |
| **"Mapa da missão"** (`MapaDaMissao`) | `app/src/routes/publico/PortalLogin.jsx:69-126` | composição inteira da tela de login: rota SVG chamada `rota-dourada`, sinal se movendo pelo trajeto, 3 marcos (Plano → Prática → Domínio) sobre a rota, núcleo com anéis girando rotulado "SEU SISTEMA / EM MISSÃO". |

### Genérico vs. amarrado ao conceito "Rumo" (Gabriel decide)

- **Favicon** e **selo do tenant**: genéricos; nenhum desenha seta/direção nem cita "Rumo".
- **Ícone de âncora**: amarrado ao **nicho** (concursos militares/navais, herdado do "Rumo ao
  Naval"), não ao **nome** do produto. Se o nicho continua, o ícone não precisa de trabalho.
- **Ícone de mira/alvo do wordmark**: genérico; só o texto ao lado troca (e agora troca por
  `marca.js`).
- **"Mapa da missão" (rota dourada)**: o elemento **mais amarrado ao conceito "Rumo"** — não
  por escrever a palavra, mas porque a metáfora (rota/caminho até um alvo, com marcos de
  progresso) foi concebida em torno de "rumo". A narrativa "jornada até a aprovação" funciona
  com qualquer nome; é só a peça que mais justifica uma segunda olhada de design.

Seção descritiva, não prescritiva.

---

## 5. Histórico de alterações

### Rev. 2 — preparo (sem trocar a marca)

| Arquivo | Mudança |
|---|---|
| `app/src/shared/branding/marca.js` (novo) | `NOME_PLATAFORMA`, `ORIGEM_PRODUCAO` — fonte única |
| `app/src/App.jsx`, `routes/publico/PortalLogin.jsx`, `shared/data/index.js` | importam de `marca.js` |
| `app/src/shared/ui/MenuPrincipal.jsx` | importa de `marca.js`; assinatura da plataforma só quando difere do nome exibido |
| `supabase/functions/_shared/cors.ts` + 3 cópias | regex de preview lido de `VERCEL_PREVIEW_PREFIX` |
| `docs/operacao/ambientes-e-variaveis.md` | documenta os 3 secrets das Edge Functions |

### Rev. 3 — a troca "Rumo à Aprovação" → "Triliva"

| Arquivo | Mudança |
|---|---|
| `app/src/shared/branding/marca.js` | `NOME_PLATAFORMA` = "Triliva"; comentário travando `ORIGEM_PRODUCAO` no domínio real |
| `app/package.json` + lockfile | `rumo-aprovacao-app` → `triliva-app` |
| `tests/package.json` + lockfile | `rumo-aprovacao-tests` → `triliva-tests` |
| `README.md`, `docs/README.md`, `docs/auditoria/README.md` | títulos/aberturas |
| `docs/00-indices/` (3 arquivos) | títulos + 4 menções ao produto no plano set–dez |
| `docs/arquitetura/frontend-servicos-dtos.md` | menção ao produto |
| `docs/operacao/` (3 arquivos) | runbook de migrations, leaked-password, migração de produção |

Por rename **não** feito e por quê: ver §1.6 (copy conceitual), §1.7 (o que ficou de propósito)
e §6 (o que depende de painel).

**Validação da rev. 3:** `npm ci` do zero nos dois pacotes (é o modo do CI e falha se
`package.json` e lockfile divergirem) — OK; `npm run build` (Vite) — OK; suíte `tests/` completa
contra Postgres 16 local com migrations + seeds 2× — **579/579**, 0 puladas. Nenhum teste
dependia do literal da marca. Edge Functions **não** foram redeployadas.

## 6. Pendências de painel (fora do alcance desta sessão)

A troca no repositório não renomeia nada que viva em painel de terceiro. Continuam com o nome
antigo até alguém agir manualmente:

| Onde | Nome atual | Ação |
|---|---|---|
| Supabase — projeto `bdjkgrzfzoamchdpobbl` | "Rumo à Aprovação — Teste e Vitrine" | Project Settings → General |
| Supabase — organização | "Central de projetos - Rumo ao Milhão com SaaS" | opcional (é outra expressão, não a marca) |
| Vercel — projeto e domínio | `rumo-a-aprova-o` / `rumo-a-aprova-o.vercel.app` | renomear muda a URL: exige `ALLOWED_ORIGINS`, `PASSWORD_RESET_REDIRECT_URL`, `VERCEL_PREVIEW_PREFIX` e `ORIGEM_PRODUCAO` em `marca.js` |
| GitHub — repositório | `Jinriuk/Rumo-a-aprova-o-` | opcional; o GitHub mantém redirect do nome antigo |
| Domínio próprio | não comprado | depende do registro.br, ainda não checado |

## Resumo de criticidade (revisado)

| Sistema | Ocorrências | Centralizado? | Criticidade para trocar |
|---|---|---|---|
| Código-fonte (UI) | 1 literal em `marca.js` | **Sim** | Baixa — trocado |
| `package.json`/lockfiles | 4 campos em 4 arquivos | não (identificadores) | Baixa — trocados |
| README.md + docs vivos | 14 arquivos | não | Média — trocados, menos 2 fatos históricos (§1.7) |
| Copy conceitual ("direção", "rota") | 2 linhas | não | Baixa hoje ("Triliva" ≈ trilha); vira trabalho de copy se a marca final não for de percurso (§1.6) |
| CI/config (`rumo_teste`) | 3 | mesmo valor | Baixa — nome técnico |
| Edge Functions (domínio) | 4 arquivos com defaults | defaults duplicados **por design**; operação por 3 secrets | **Baixa** (era "Alta" na rev. 1) |
| Supabase (painel) | projeto + org + nome planejado de prod | metadados | Baixa |
| Vercel | não verificável daqui | — | depende do slug; resolvido por secrets + `marca.js` |
| Identidade visual | 5 elementos em código | — | Baixa nos 4 genéricos; média na composição "mapa da missão" |
| Docs históricos | 70 arquivos | — | **Não tocar** |

## Fora de escopo (nada feito)

- Materiais comerciais (CRM, pitch, one-pager) — não estão no repositório. **Carregam o nome
  antigo e não foram tocados**; a troca aqui é só do produto no repositório.
- Nenhuma migration, nenhuma compra de domínio, nenhum redeploy de Edge Function, nenhum
  rename em painel (Supabase/Vercel/GitHub — ver §6).
- Identidade visual não foi redesenhada: o wordmark agora escreve "Triliva", mas o ícone de
  mira, a âncora e a composição "mapa da missão" continuam como estavam (§4).
- **INPI, registro.br e teste de pronúncia continuam pendentes.** "Triliva" foi adotado no
  código por decisão de Gabriel, não por ter passado nas checagens.
