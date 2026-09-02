# Mapeamento de marca — "Rumo à Aprovação" → candidato "Triliva"

**Data:** 2026-09-02
**Autor:** levantamento técnico (Claude Code), a pedido de Gabriel
**Natureza deste documento:** mapeamento de ocorrências. **Não é** um PR de rename, não altera
schema, não compra domínio e não decide nada sozinho.

## Checklists ainda pendentes (nenhuma foi feita)

- [ ] INPI — classes de software e educação, incluindo colisão fonética com **Trillia** (marca
      nova da B3, 2026) e **Trillio** (plataforma de treinamento corporativo usada por
      Nubank/Mercedes-Benz/Leroy Merlin).
- [ ] registro.br — disponibilidade de `triliva.com.br`.
- [ ] Teste de pronúncia com 10 pessoas.

Nada abaixo constitui aprovação do nome "Triliva" — é só o inventário de onde "Rumo à
Aprovação"/"Rumo" aparece hoje, para dimensionar o custo de uma eventual troca.

---

## 1. Repositório (`Jinriuk/Rumo-a-aprova-o-`)

### 1.1 Código-fonte — strings de UI (todas hardcoded, nenhuma central)

| Arquivo:linha | Conteúdo | Hardcoded ou config central? |
|---|---|---|
| `app/src/routes/publico/PortalLogin.jsx:61` | `<strong>Rumo à Aprovação</strong>` — wordmark da tela de login (`MarcaPortal`) | Hardcoded, literal único no componente |
| `app/src/App.jsx:54` | `escola: { nome: "Rumo à Aprovação", ... }` — tenant-fallback passado ao `BrandingProvider` no fluxo de recuperação de senha | Hardcoded |
| `app/src/shared/ui/MenuPrincipal.jsx:133` | `escola?.nome ?? "Rumo à Aprovação"` — fallback do nome no rodapé da sidebar | Hardcoded (fallback) |
| `app/src/shared/ui/MenuPrincipal.jsx:134` | `Rumo à Aprovação` — subtítulo do rodapé da sidebar | Hardcoded, **incondicional** (ver nota abaixo) |
| `app/src/shared/data/index.js:663` | `"https://rumo-a-aprova-o.vercel.app"` — fallback de origem de redirect quando `window` não existe | Hardcoded |

**Nota sobre `MenuPrincipal.jsx:133-134`:** a linha 133 usa `escola?.nome` com fallback — ou
seja, para uma escola-tenant com nome próprio configurado, o nome dela aparece. Mas a linha 134
(subtítulo) escreve "Rumo à Aprovação" **sempre**, sem checar `escola?.nome`. Isso já é uma
inconsistência do white-label atual, independente da troca de marca: hoje qualquer escola-tenant
vê "Rumo à Aprovação" fixo como segunda linha no rodapé da sidebar, mesmo tendo nome próprio na
primeira linha. Vale registrar como achado à parte, não só como "ocorrência de marca".

Não existe nenhuma constante `APP_NAME`/`BRAND` central no código — são 5 literais
independentes em 4 arquivos. **Troca espalhada, não centralizada.**

### 1.2 `package.json` / `package-lock.json`

| Arquivo:linha | Conteúdo | Criticidade |
|---|---|---|
| `app/package.json:2,8` | `"name": "rumo-aprovacao-app"` | Baixa — identificador interno do npm, não é exibido ao usuário; nenhum script/CI referencia pelo nome (só por caminho) |
| `tests/package.json:2` | `"name": "rumo-aprovacao-tests"` | Baixa, idem |
| `app/package-lock.json` (mesmas linhas) | espelha `package.json` | Regenerado automaticamente por `npm install`, não precisa edição manual |

### 1.3 `README.md`

| Linha | Conteúdo |
|---|---|
| 1 | `# Rumo à Aprovação — sistema multi-tenant de acompanhamento de estudos` (título) |
| 4 | menção a **"Rumo ao Naval"** — atenção: é um nome **diferente e anterior**, o painel de uma escola só do qual este sistema multi-tenant nasceu. Não é o mesmo texto que "Rumo à Aprovação" e a troca de marca do produto atual não decide sozinha se essa referência de origem histórica deve mudar. Fica como pergunta em aberto para Gabriel. |
| 28 | `rumo_teste` — nome do banco usado no exemplo de comando `reset-db.sh` |

### 1.4 CI / configuração

| Arquivo:linha | Conteúdo | Observação |
|---|---|---|
| `.github/workflows/ci.yml:52` | `PGDATABASE: rumo_teste` | Nome de banco Postgres efêmero em CI, não é texto de marca visível a usuário |
| `.env.example:27` | `PGDATABASE=rumo_teste` | Idem, template local |
| `vercel.json` | — | **Nenhuma ocorrência.** Config só tem `buildCommand`/`headers`/`rewrites`, genéricos |
| `app/.env.production` | — | Nenhuma ocorrência de "Rumo"; só `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do projeto `bdjkgrzfzoamchdpobbl` (ref técnico, não é a palavra marca) |

### 1.5 Supabase Edge Functions — CORS / redirect (o ponto mais espalhado do repositório)

| Arquivo:linha | Conteúdo |
|---|---|
| `supabase/functions/_shared/cors.ts:25,32,36` | Lista de origens + regex de preview, **versão canônica** |
| `supabase/functions/backoffice-coordenador/index.ts:38,43,66` | Cópia própria (comentário no arquivo: *"versão canônica em `_shared/cors.ts`; cópia mínima de propósito"*) |
| `supabase/functions/revogar-responsavel/index.ts:26,31` | Cópia própria, mesmo padrão |
| `supabase/functions/provisionar-aluno/index.ts:29,34` | Cópia própria, mesmo padrão |

As funções `lgpd-titular`, `gerar-meta` e `virar-semana` importam `corsHeaders` de
`_shared/contexto.ts`, que reexporta `_shared/cors.ts` — essas três **não duplicam** a string,
uma edição em `_shared/cors.ts` basta para elas.

**Criticidade: ALTA / espalhada.** Trocar o domínio `rumo-a-aprova-o.vercel.app` (não só o nome,
o domínio) exige editar **4 arquivos manualmente** (`_shared/cors.ts` + as 3 cópias
deliberadas), porque o time já decidiu, antes desta tarefa, não compartilhar esse código entre
todas as Edge Functions. Isso é um custo pré-existente de qualquer troca de domínio, com ou sem
troca de marca.

### 1.6 `docs/backlog/` e `docs/adr/` — fora do escopo, conforme instrução

A busca encontrou 2 arquivos em `docs/backlog/` (`00-indice.md`,
`prompt-execucao-bkl004-005.md`) citando "Rumo". Por instrução explícita desta tarefa, **não
foram abertos nem alterados** — permanecem como registro histórico de decisões tomadas sob o
nome anterior.

### 1.7 Achado fora do pedido original: `docs/auditoria/**` e `docs/operacao/**` (~85 arquivos)

A varredura ampla por "Rumo"/"rumo" também retornou cerca de 85 arquivos em
`docs/auditoria/` e `docs/operacao/` — relatórios de segurança (S1, SEG1, SEG2), banco (DB1),
operacional (D1A-C, HF1-2), produto (AV2) e auditorias antigas. **Isso não estava no escopo
literal do pedido** (que citava código-fonte, `package.json`, `README.md`, config e CI) e por
isso não abri nem alterei nenhum desses arquivos. Mas sinalizo a inconsistência: pela mesma
lógica dada para `docs/backlog/`/`docs/adr/` ("registro histórico de decisões tomadas sob o nome
anterior"), esses ~85 arquivos são exatamente a mesma categoria de coisa — relatórios de fases já
fechadas, escritos sob o nome atual. Vale Gabriel confirmar explicitamente se a regra de "não
alterar" cobre só backlog/adr ou se `auditoria/`/`operacao/` entram também, porque do jeito que
estão escritos hoje, parecem históricos da mesma forma.

---

## 2. Supabase

- **Nome do projeto** (`bdjkgrzfzoamchdpobbl`): **"Rumo à Aprovação — Teste e Vitrine"**
  (confirmado via API/MCP `list_projects` nesta sessão). Aparece só no painel de administração do
  Supabase — é metadado de exibição, não afeta schema, RLS ou nome de tabela. Renomear no painel
  não tem custo técnico e não muda o `ref` do projeto (`bdjkgrzfzoamchdpobbl.supabase.co`, que já
  é dissociado do nome de exibição).
- **Seed (`supabase/seed/`):** nenhuma ocorrência de "Rumo à Aprovação" em **valores** de dado
  semente. O único hit textual é um **comentário de proveniência** dentro de
  `supabase/seed/trilha-cn-v1.json:2`, citando que a trilha foi *"IMPORTADA da versão atual
  (`src/App.jsx` do Rumo ao Naval)"* — é uma nota sobre a origem do conteúdo pedagógico (mesma
  ressalva da seção 1.3), não um valor de marca do produto atual.
- **Storage/buckets:** não encontrei, no repositório (código ou migrations), nenhuma criação de
  bucket com nome ou valor de marca.
- Nomes de tabela em português (`trilhas_missoes` etc.) confirmadamente fora de escopo — são
  modelagem de domínio, não marca.

**Criticidade: BAIXA.** Rename de metadado de painel, sem migration.

---

## 3. Vercel

**Limitação desta sessão:** a integração MCP da Vercel conectada aqui não retornou nenhum
projeto sob o time acessível (`Jinriuk's projects`, 0 projetos). Não consegui confirmar ao vivo,
pelo painel, o nome do projeto/domínio/variáveis de ambiente — o que segue é reconstruído a
partir do próprio repositório, não de uma consulta direta ao painel Vercel.

- Pelos documentos do repositório (`docs/auditoria/seguranca/seg2/10-dominio-urls-finais.md`) e
  pelas origens hardcoded no CORS (seção 1.5), o projeto/domínio ativo é **`rumo-a-aprova-o`** →
  **`rumo-a-aprova-o.vercel.app`**, sem domínio próprio configurado (decisão registrada no mesmo
  doc: compra de domínio adiada, "item de julho").
- **Variáveis de ambiente:** não pude inspecionar as configuradas no painel Vercel (ficam fora do
  repositório). O único candidato documentado no repo é `VITE_ERROR_REPORT_URL` (opcional, ainda
  não setada) — é uma URL técnica de um coletor de erro (tipo Sentry), não contém a marca em
  texto.
- Recomendo confirmar diretamente no painel Vercel (Gabriel ou quem tiver acesso): nome do
  projeto, domínios anexados, env vars atuais — este documento não pôde verificar isso ao vivo.

**Criticidade:** depende do que for trocado. Trocar só o *nome de exibição* do projeto na Vercel
não quebra nada. Trocar o **domínio** (`*.vercel.app` ou customizado) tem efeito cascata nos 4
arquivos de CORS da seção 1.5 e no fallback de `app/src/shared/data/index.js:663` — ou seja,
mesmo sem tocar no Supabase, só o domínio já afeta 5 arquivos de código.

---

## 4. Identidade visual

Não há **nenhum arquivo de imagem versionado** no repositório (busquei `*.svg`, `*.png`, `*.ico`,
`*.webp` fora de `node_modules` — zero resultados). Toda a identidade visual atual é gerada em
código: SVG inline, emoji Unicode e gradiente CSS. Não existe "arquivo de logo" para substituir —
existem componentes React.

| Elemento | Onde | O que representa visualmente |
|---|---|---|
| **Favicon** | `app/index.html:11` (SVG inline, data-URI) | Quadrado navy arredondado com emoji **"⚓" (âncora)** dourado no centro. O `<title>` da aba já é genérico ("Painel de Estudos"), sem "Rumo". |
| **Selo padrão do tenant** (`MarcaEscola`) | `app/src/shared/branding/BrandingContext.jsx:37-54` | Quando a escola-tenant não tem logo próprio: quadrado com gradiente dourado e o mesmo emoji "⚓". É o *fallback* de white-label de qualquer tenant, não é exclusivo da marca do produto — quando há logo, usa `escola.nome` dinamicamente no `alt`. |
| **Ícone "ancora" do sistema de ícones** | `app/src/shared/ui/Icones.jsx:7` (definição SVG: círculo + haste + travessa curva — uma âncora náutica de fato) | Reusado em 3 lugares: rodapé da sidebar (`MenuPrincipal.jsx:130`), item de navegação "Hoje" (`VisaoEstudo.jsx:256`) e ícone do grupo de conquistas "Missões" (`Conquistas.jsx:35-37`). |
| **Wordmark do login** (`MarcaPortal`) | `app/src/routes/publico/PortalLogin.jsx:49-66` | Ícone SVG (dois círculos concêntricos + cruz tipo mira + um check) ao lado do texto hardcoded **"Rumo à Aprovação"** + subtítulo "Central de preparação". |
| **"Mapa da missão"** (`MapaDaMissao`) | `app/src/routes/publico/PortalLogin.jsx:68-125` | Composição inteira da tela de login: uma rota SVG chamada internamente `rota-dourada` ("golden route"), um ponto de sinal se movendo ao longo do trajeto, 3 marcos numerados (Plano → Prática → Domínio) plotados sobre a rota, e um núcleo central com anéis girando rotulado "SEU SISTEMA / EM MISSÃO". |

### Sinalização — genérico vs. amarrado ao conceito "Rumo" (para Gabriel decidir)

- **Favicon** e **selo padrão do tenant**: genéricos o bastante para reaproveitar. Nenhum dos dois
  desenha uma seta/direção nem cita "Rumo" — é âncora + gradiente.
- **Ícone de âncora** (sistema de ícones): amarrado ao **nicho** do produto (concursos
  militares/navais, herdado do "Rumo ao Naval" — ver seção 1.3), não ao **nome** "Rumo à
  Aprovação". Não desenha seta nem joga com a palavra "rumo" — é literalmente uma âncora. Se o
  produto continuar mirando concursos militares/policiais sob "Triliva", este ícone não precisa
  de trabalho.
- **Ícone da mira/alvo no wordmark do login**: o desenho em si (mira + check) é genérico, não
  precisa refazer — só o texto ao lado é literal e precisaria trocar.
- **"Mapa da missão" (rota dourada)**: este é o elemento **mais amarrado ao conceito "Rumo"** —
  não porque escreva a palavra, mas porque a metáfora inteira (caminho/rota/direção até um alvo,
  com pontos de progresso ao longo do trajeto) foi desenhada em torno da ideia de rota/rumo
  especificamente. A narrativa "jornada até a aprovação" funcionaria com qualquer nome, mas é a
  peça que mais justifica uma segunda olhada de design se a marca mudar — não uma simples troca
  de texto.

Esta seção é descritiva, não prescritiva: a decisão de manter ou refazer cada peça é do Gabriel.

---

## Resumo de criticidade

| Sistema | Ocorrências mapeadas | Centralizado? | Criticidade para trocar |
|---|---|---|---|
| Código-fonte (strings de UI) | 5, em 4 arquivos | Não — nenhuma constante central | Média — poucos arquivos, mas edição manual em cada um |
| `package.json`/lockfiles | 3, em 3 arquivos | Não, mas baixo impacto (não é exibido) | Baixa |
| README.md | 3 linhas | — | Baixa, mas com pergunta em aberto sobre "Rumo ao Naval" |
| CI/config (`ci.yml`, `.env.example`) | 2 | Mesmo valor (`rumo_teste`) nos dois | Baixa — nome técnico interno |
| `vercel.json` / `app/.env.production` | 0 | — | N/A |
| Edge Functions (CORS/domínio) | 4 arquivos com duplicação deliberada + 1 canônico | Não — 3 cópias por decisão de design pré-existente | **Alta** se o domínio mudar |
| Supabase (nome do projeto) | 1 (painel) | Sim (é um único metadado) | Baixa |
| Vercel (nome/domínio do projeto) | Não verificado ao vivo (ver seção 3) | — | Depende — domínio custom afeta 5 arquivos de código |
| Identidade visual | 5 elementos, nenhum é arquivo de imagem | Componentes de código | Baixa nos 4 genéricos; média/alta na composição "mapa da missão" |

## Fora de escopo (confirmado, nada feito aqui)

- Materiais comerciais (CRM, pitch, one-pager) — não estão no repositório.
- Nenhuma migration.
- Nenhum PR de rename.
- Nenhuma compra de domínio.
- Nenhuma das 3 checagens pendentes (INPI, registro.br, teste de pronúncia) foi realizada — o
  nome "Triliva" continua **não aprovado**.
