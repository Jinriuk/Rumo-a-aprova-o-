# RC1 — Bugs e Regressões (matriz de correções)

**Data:** 2026-06-27 · **Branch:** `claude/rc1-functional-sweep-foc0wb`

Classificação: **P0** (quebra/segurança, bloqueia release) · **P1** (alto, fluxo
crítico) · **P2** (médio) · **P3** (baixo/cosmético) · **UX** · **Infra** · **Futuro**.

Cada achado tem **dono/fase**. Nenhum P0/P1 ficou sem destino.

---

## Resumo executivo

| ID | Título | Sev. | Estado | Dono/Fase |
|----|--------|------|--------|-----------|
| BUG-RC1-001 | E2E: seletor do login por código quebrado (placeholder defasado) | P2 | ✅ **Corrigido** | RC1 |
| BUG-RC1-002 | Favicon ausente → 404 no console; filtro de ruído E2E inócuo | P3 | ✅ **Corrigido** | RC1 |
| OBS-RC1-003 | Falhas de login/dados logam mensagem técnica no console | UX/P3 | 📝 Documentado | FIX1 |
| OBS-RC1-004 | Responsável só enxerga 1 aluno (`.limit(1)`), sem seletor | P2 | 📝 Documentado | FIX1 (+produto) |
| OBS-RC1-005 | `useSessao`: branch `ESCOLA_SUSPENSA` é código morto | P3 | 📝 Documentado | FIX1 |
| OBS-RC1-006 | Bundle único 1.09 MB sem code-splitting (warning de build) | P3/Perf | 📝 Documentado | Futuro |
| OBS-RC1-007 | Varredura runtime bloqueada (rede Supabase + build Chromium) | Infra | 📝 Registrado | Infra/E2E isolado |
| OBS-RC1-008 | `mensagemAmigavel` com contextos sem entrada caem no genérico | P3/UX | 📝 Documentado | FIX1 |

**Nenhum P0/P1 funcional novo** foi encontrado — consistente com o status pós-SEG2.

---

## Corrigidos nesta fase (P2/P3 simples e isolados)

### BUG-RC1-001 — E2E: login por código não localiza o campo (P2) ✅

- **Sintoma:** o helper `loginPorCodigo` (`e2e/_apoio.js`) e o teste de código
  inválido (`e2e/auth.spec.js`) selecionavam o campo por
  `getByPlaceholder("XXXX-XXXX-XXXX")`, mas o placeholder real do `Login.jsx`
  é `Ex.: LUCASDEMO2026`. O seletor **não casa** → `fill()` estoura por timeout.
- **Impacto:** **todo** login por código falha na suíte — quebra `auth` (3),
  `aluno` (6), `responsavel` (2), `mobile` (3) e `motor-progresso` (5), nos
  projetos desktop **e** mobile. A suíte E2E não conseguia validar aluno nem
  responsável. Latente porque o job `e2e` no CI é **pulado** sem projeto
  isolado (`E2E_SUPABASE_*`), então a regressão não aparecia no gate.
- **Causa:** o placeholder mudou (commits D1B/D1C de login/recuperação) e os
  seletores E2E não acompanharam.
- **Correção:** trocar o seletor por **rótulo** — `campo(page, "Código de
  acesso")` (helper já existente, baseado em `label + input`), que sobrevive a
  mudanças de placeholder. Arquivos: `e2e/_apoio.js`, `e2e/auth.spec.js`.
- **Risco:** nulo — mudança **só de teste**, não toca app/RLS/Auth.
- **Teste:** `auth.spec.js › código inválido é rejeitado` passou (reproduzido
  offline: erro de rede → mensagem amigável "Código não reconhecido"). O seletor
  agora resolve e preenche o campo.
- **Rollback:** reverter as 2 linhas dos arquivos de teste.

### BUG-RC1-002 — Favicon ausente: 404 no console (P3) ✅

- **Sintoma:** sem `<link rel="icon">` e sem `public/favicon.ico`, o navegador
  pede `/favicon.ico` automaticamente. No `vite preview`/local isso retorna
  **404** e o console registra `Failed to load resource: ... 404 (Not Found)`.
- **Impacto:** console sujo em **toda** tela no preview/local; e o filtro de
  ruído da E2E (`/favicon/i` em `_apoio.js`) **não funciona** porque a mensagem
  do Chromium para o 404 **não contém a palavra "favicon"** (o URL fica em
  `msg.location()`, não em `msg.text()`). Resultado: o 1º teste E2E
  (`tela de login aparece`, que asserta console vazio) **falhava** por esse 404.
- **Produção:** o `vercel.json` reescreve `/(.*)` → `/index.html`, então em
  produção `/favicon.ico` devolve HTML (200), não 404 — o sintoma é
  preview/local. Ainda assim, evitar o request é mais limpo nos dois mundos.
- **Correção:** `<link rel="icon" href="data:image/svg+xml,...">` inline no
  `index.html` (âncora ⚓ dourada sobre navy). SVG inline é permitido pela CSP
  (`img-src ... data:`). O browser passa a usar o ícone embutido e **não pede**
  mais `/favicon.ico`.
- **Risco:** nulo — só `index.html`; CSP já cobre `data:` em `img-src`.
- **Teste:** `auth.spec.js › tela de login aparece` passou — console **limpo**.
- **Rollback:** remover a linha do `<link rel="icon">`.

---

## Documentados para FIX1 (não corrigidos nesta fase)

### OBS-RC1-003 — Mensagem técnica no console em falhas (UX/P3) 📝

- **Onde:** `shared/data/index.js` (`falha()` faz `console.error`) e
  `shared/lib/erros.js` (`mensagemAmigavel()` faz `console.error(erro)`).
- **Comportamento:** em **toda** falha (login com credencial errada, "Failed to
  fetch", RLS negada), a UI mostra a mensagem amigável **correta**, mas o
  console recebe a linha técnica — ex.: `Error: login por código: Invalid login
  credentials` ou `login por código: Failed to fetch` (reproduzido neste
  ambiente). É a origem do sintoma relatado "mensagens técnicas no console".
- **Avaliação:** **por design** (observabilidade) e **não** vaza para o usuário.
  Não é bug funcional. Porém polui o console e, no caso de falha de **login
  esperada** (código/senha errados), é ruído previsível, não um erro de sistema.
- **Recomendação (FIX1):** rebaixar falhas de auth **esperadas** para
  `console.warn` (ou silenciar em produção via `observabilidade.js`), mantendo
  `console.error` para falhas inesperadas. **Não** alterar a mensagem ao usuário.
- **Risco se mexer:** baixo, mas toca o seam de dados — fazer com teste.

### OBS-RC1-004 — Responsável vê apenas 1 aluno (P2) 📝

- **Onde:** `shared/data/index.js › alunoVinculado()` faz
  `vinculos_responsaveis ... .limit(1)`; `AreaResponsavel.jsx` consome um único
  aluno, **sem seletor**.
- **Impacto:** responsável vinculado a 2+ alunos (irmãos) só enxerga um — e qual
  aparece é indeterminado (primeira linha). A tarefa RC1 pede explicitamente
  "seleção de aluno" para o responsável. **Gap funcional**, não cosmético.
- **Por que não corrigir agora:** exige **decisão de produto** (UI de troca de
  aluno) + mudança de query (listar todos os vínculos) + ajuste de `registrarAcesso`
  por aluno selecionado + testes. Fora do "P1 simples e isolado".
- **Recomendação (FIX1):** `listarVinculosDoResponsavel()` → seletor quando >1.
- **Risco:** médio (toca leitura do responsável); precisa de regressão.

### OBS-RC1-005 — `useSessao`: branch de suspensão morto (P3) 📝

- **Onde:** `shared/hooks/useSessao.js` trata `e?.code === "ESCOLA_SUSPENSA"` e
  devolve `suspensa`, mas `meuPerfil()` **nunca** lança esse código (a suspensão
  é tratada em `App.jsx` via `escolaOperacional(perfil.escola)`). O campo
  `suspensa` retornado **não é lido** pelo `App.jsx`.
- **Impacto:** nenhum em runtime — apenas **código morto**/confuso para quem lê.
- **Recomendação (FIX1):** remover o branch e o campo `suspensa`, ou implementar
  o lançamento de `ESCOLA_SUSPENSA` em `meuPerfil()` e consumir no `App`. A
  proteção real continua na RLS — esta é só limpeza.

### OBS-RC1-006 — Bundle único grande (P3/Perf) 📝

- **Sintoma:** `vite build` avisa: `dist/assets/index-*.js` **1.092 MB**
  (gzip 301 KB), sem code-splitting (chunks > 500 KB).
- **Impacto:** primeiro carregamento mais pesado, sobretudo no **celular do
  aluno** (público-alvo). Não quebra nada; é performance.
- **Recomendação (Futuro):** `import()` dinâmico por área (aluno/escola/admin) e
  lazy do `recharts`. Fora do escopo RC1 (sem refatoração grande).

### OBS-RC1-007 — Varredura runtime bloqueada no ambiente (Infra) 📝

- **(a) Rede:** sandbox **sem saída** para `bdjkgrzfzoamchdpobbl.supabase.co`
  (`curl` → HTTP 000; E2E → `net::ERR_TUNNEL_CONNECTION_FAILED`). Todo fluxo com
  dado real é **inexecutável aqui**.
- **(b) Browser:** Chromium pré-instalado é build **1194**; o
  `@playwright/test@1.61.1` do projeto espera **1228** → launch falha por padrão.
  Contornado nesta auditoria apontando `executablePath` para o chromium 1194
  (render/console rodaram); não é solução permanente.
- **Impacto:** a parte "como usuário real" da varredura ficou restrita ao que
  não depende de banco (render, console, caminhos de erro offline).
- **Recomendação:** rodar a suíte E2E no **ambiente isolado** já previsto no
  `ci.yml` (`e2e-guard` + secrets `E2E_SUPABASE_URL/ANON_KEY`), que instala o
  Chromium correto (`npx playwright install`). Validar lá os itens **BLQ** da
  matriz.

### OBS-RC1-008 — Contextos sem entrada em `mensagemAmigavel` (P3/UX) 📝

- **Onde:** `VinculosResponsavel.jsx` chama `mensagemAmigavel(e, "revogar")`,
  `"vincular responsável"`, `"carregar responsáveis"`, mas `erros.js › MENSAGENS`
  não tem essas chaves → cai no genérico `"Não foi possível concluir a ação."`.
- **Impacto:** mensagens menos específicas que poderiam ser (ex.: "Não foi
  possível revogar o acesso agora."). Sem quebra.
- **Recomendação (FIX1):** adicionar as chaves a `MENSAGENS`.

---

## Regressão entre perfis (revisão cruzada)

Como as correções desta fase tocam **só** `index.html` (favicon) e arquivos de
**teste E2E**, **não há** alteração de comportamento de runtime para nenhum dos
quatro perfis. O seam de dados, RLS, Auth, Edge Functions e UI de aluno/
responsável/coordenação/superadmin permanecem **idênticos** ao pós-SEG2.
