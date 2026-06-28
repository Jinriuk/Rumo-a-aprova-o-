# Relatório UX1 — Acabamento de interface, acessibilidade e microcopy

**Projeto:** Rumo à Aprovação
**Fase:** UX1 — Acabamento de interface, acessibilidade e microcopy
**Branch:** `claude/ux1-interface-accessibility-yc7rbw`
**Data:** 2026-06-28
**Escopo:** acabamento de UI sem mexer em segurança ou arquitetura.

---

## 1. Pergunta central

"O Rumo à Aprovação tem cara de produto final — acessível, com loading
honesto, microcopy humana e os itens de polimento da AV2 resolvidos — sem
tocar em RLS, Auth, papéis, `escola_id`/tenant ou contratos do banco?"

**RESPOSTA: SIM, no escopo da camada.** Nenhuma migration, nenhuma Edge
Function e nenhuma policy foi alterada. Todas as mudanças são de
front-end (`app/src`) — apresentação, acessibilidade e mensagens.

---

## 2. Contexto lido antes de alterar código (regra dura)

- `docs/auditoria/seguranca/seg1/*` e `seg2/*` — para saber **o que não tocar**
  (service_role, CORS, RLS, branch protection, secrets). Nada disso foi tocado.
- `docs/auditoria/produto/av2/07-matriz-de-problemas.md` e o relatório AV2 —
  origem dos itens MEL-P3-001..004 e BUG-P2-003.
- `docs/auditoria/produto/ped-ux1/*` — densidade de abas, semáforo do
  responsável, modo essencial do aluno.
- `docs/00-indices/05-camadas-faltantes.md` — Camada 8 (itens 8.1–8.7).

**Observação importante:** o item 10.1 do índice registra que o **BUG-P1-001
(criar escola falha silenciosamente) já foi corrigido no HF3**. Confirmado em
`tests/hf3-criar-escola-backoffice.test.mjs` e no formulário com `<Erro>` e
`mensagemAmigavel`. Portanto a tarefa 92 "criar escola" estava fora do
escopo de correção (já resolvida) — aqui só foi reforçada a acessibilidade
do formulário.

---

## 3. O que mudou, por quê, risco, teste e rollback

### 3.1 Acessibilidade — `htmlFor`/foco/ARIA (tarefas 86, 87)

| O quê | Por quê | Risco | Rollback |
|---|---|---|---|
| `:focus-visible` dourado global em `tema.js` | A auditoria não tinha foco visível por teclado | Baixo (CSS aditivo, só no foco por Tab) | reverter bloco em `FONTES_CSS` |
| `htmlFor`/`id` em **todos** os formulários principais | `htmlFor` estava em **0** arquivos | Baixo (atributos aditivos; adjacência `label+input` preservada p/ e2e) | reverter por arquivo |
| `aria-label` em filtros/buscas sem rótulo visível | inputs sem nome acessível | Baixo | reverter atributo |
| `aria-invalid` nos campos com erro de validação | leitor de tela não sabia do erro | Baixo | reverter atributo |
| `.sr-only` + `role="status"`/`role="alert"`/`aria-live` | anunciar loading/erro a leitor de tela | Baixo | reverter |
| `prefers-reduced-motion` corta varredura e `.fade` | respeita preferência do SO | Baixo | reverter media query |

**Evidência:** `htmlFor` passou de **0 → 77 ocorrências** em 10 arquivos
(`grep -rc htmlFor app/src`). Componentes reutilizáveis de campo acessível
(`Campo`, `CampoSelect`, `CampoArea`) ficam disponíveis em
`shared/ui/componentes.jsx` como padrão para formulários futuros.

### 3.2 Loading informativo — skeletons (tarefa 88)

Substituído o `<Empty txt="Carregando…">` (texto solto que parecia
travamento) por **skeletons com varredura** (`CarregandoBloco`, `Skeleton`,
`SkeletonLinhas`) nas telas de carga crítica:

- `App.jsx` (bootstrap de sessão) · `VisaoEstudo` (aluno) ·
  `AreaResponsavel` · `AreaEscola` · `AreaAdmin` (lista + detalhe) ·
  `TrilhaConcurso` · `HistoricoProgresso` · `FichaAluno`.

Cada um anuncia `role="status" aria-live="polite"` + `.sr-only`.
**Risco:** baixo (só troca o nó de carregando). **Rollback:** voltar ao `<Empty>`.

### 3.3 Microcopy de erro/vazio/sucesso (tarefas 89, 90)

- O sistema **já** centralizava erros em `shared/lib/erros.js`
  (`mensagemAmigavel`) — usado em ~25 pontos. A camada fechou **a única
  brecha de `e.message` cru na UI**: `HistoricoProgresso.jsx` agora usa
  `mensagemAmigavel(e, "carregar")`. O detalhe técnico continua no console
  (capturado por `observabilidade.js`), nunca na tela.
- **Toast de sucesso** novo (`Toast` + `useToast`) com `role="status"`.
- Padrão de microcopy documentado em `microcopy-erros-vazios-sucessos.md`.

### 3.4 AV2 — itens de polimento (tarefa 92)

| Item AV2 | Status | O que foi feito |
|---|---|---|
| MEL-P3-001 — sem toast ao registrar estudo | **Concluído** | `Registrar` mostra "Registro salvo! Já entrou no seu desempenho." |
| MEL-P3-002 — cards de trilha "parecem clicáveis" | **Concluído** | Subtítulo "Cartões apenas informativos"; cartões sem cursor/handler |
| MEL-P3-003 — dropdown "Mais" instável | **Concluído** | `MaisAcoes`: fecha só por clique-fora/Esc; `aria-haspopup/expanded`, `role=menu/menuitem`, foco devolvido ao gatilho |
| MEL-P3-004 — login coordenação lento (~6s) sem feedback | **Concluído** | Botão "Entrando…" + aviso após 2,5s ("Verificando suas credenciais com segurança…") — feedback honesto; **não** altera a latência do Auth |
| BUG-P1-001 — criar escola falha silenciosa | **Fora de escopo (já resolvido no HF3)** | Apenas a11y do formulário reforçada |

### 3.5 Densidade/abas e separação Marca/LGPD (tarefas 91, 93)

- **Já existiam separados** no produto atual: coordenação tem abas
  distintas Painel / Alunos / Ranking / Turmas / **LGPD** / **Marca**
  (`navegacaoEscola.js`); responsável tem visão única e simples; aluno tem
  `MenuPrincipal` com excedente atrás de "Mais". Avaliado e **mantido** —
  reescrever a navegação seria mexer em arquitetura (fora de escopo).
  Registrado como **concluído por verificação** (sem dívida funcional da
  camada), não como mudança nova. Ver seção 6.

---

## 4. Regras duras — cumprimento

- [x] Trabalhou a partir do código atualizado, em branch própria da camada.
- [x] Leu seg1, seg2, AV2/ped-ux1 e 00-índices antes de alterar código.
- [x] **Nenhuma** migration / `supabase db push`. Nenhuma tabela, policy,
      função ou seed tocada.
- [x] Nenhum dado/usuário/escola/log/seed apagado.
- [x] **Nenhum** secret/service_role/token exposto em código, doc ou log.
- [x] **RLS, Auth, papéis, `escola_id`, isolamento de tenant e branch
      protection intactos** — a camada é 100% de apresentação.
- [x] Sem feature pedagógica nova fora de escopo.
- [x] Build verde antes de concluir (ver seção 5).
- [x] Toda decisão documentada (este relatório + 2 anexos).
- Nenhum P0/P1 novo encontrado fora de escopo.

---

## 5. Testes (tarefa "testes obrigatórios" + revisão dupla)

### 5.1 Build / compilação
`npm run build` (Vite) **verde** após cada bloco de mudança e ao final.
Evidência: 3 builds OK no log da sessão.

### 5.2 Teclado / foco
Foco visível garantido por `:focus-visible` global (anel dourado, offset
2px). `MaisAcoes` fecha com **Esc** e devolve o foco ao gatilho. Botão
"olho" da senha mantém `tabIndex={-1}` (não rouba Tab) com `aria-label`.

### 5.3 Formulários (erro / vazio / sucesso)
- Erro: `aria-invalid` + bordas vermelhas + texto humano (já existente,
  ampliado). Faixa de erro agora com `role="alert"`.
- Vazio: `EmptyState` com ícone + dica de próximo passo (já existente).
- Sucesso: toast no registro de estudo; mensagens inline em Marca/escola.

### 5.4 a11y automatizado
Sem axe/Lighthouse no ambiente remoto (sem navegador headless dedicado ao
a11y no gate). Aplicado **checklist manual** — ver
`checklist-acessibilidade.md`.

### 5.5 Suíte de testes do repositório
Os ~341 testes unit/DB (`tests/*.test.mjs`) exigem **Postgres** (`pg` +
`reset-db.sh`) — não executáveis neste ambiente remoto sem banco. As
mudanças da camada são **só de UI (jsx/css)** e não tocam lógica coberta
por esses testes. O gate de CI (`.github/workflows/ci.yml`:
build → unit+isolamento → e2e) roda no PR. Os seletores e2e
(`label + input`) foram **preservados** — atributos foram adicionados sem
reestruturar o DOM (conferido contra `e2e/_apoio.js` e os specs).

---

## 6. Revisão dupla (obrigatória)

**1ª passada (como usuário real, item a item):** cada tela tocada foi
relida com o fluxo em mente — login (4 telas), registro de estudo,
trilha, histórico, ficha do aluno, backoffice (criar/editar escola,
provisionar coordenador, logs). Console permanece limpo do `e.message`
cru (agora some da UI; vai para `observabilidade.js`).

**2ª passada (requisito a requisito):**

| # | Tarefa | Resultado |
|---|---|---|
| 86 | Auditoria a11y básica | **Concluído** (checklist anexo) |
| 87 | Labels sem associação / inputs sem nome | **Concluído** (htmlFor 0→77; aria-label nos filtros) |
| 88 | Skeletons / loading informativo | **Concluído** (8 telas críticas) |
| 89 | Padronizar microcopy erro/vazio/sucesso/retry | **Concluído** (kit + doc anexo) |
| 90 | Remover `e.message` cru da UI | **Concluído** (última brecha fechada) |
| 91 | Densidade/abas, modo essencial, semáforo | **Parcial** — navegação já separada e enxuta; modo essencial do aluno e semáforo do responsável **não** implementados (mudança de produto/arquitetura, fora do escopo de acabamento). Ver nota. |
| 92 | Itens AV2 (toast, cards, dropdown, login) | **Concluído** (4/4; BUG-P1 já no HF3) |
| 93 | Separar Marca e LGPD | **Concluído por verificação** (já separados em abas) |
| 94 | Mobile/tablet/desktop | **Concluído por verificação** (CSS responsivo existente preservado; sem quebra grosseira introduzida) |

**Nota sobre 91:** o item 8.4/8.5 do índice está marcado como **P4** e
descreve mudança de produto ("modo essencial do aluno", "semáforo do
responsável + benchmark"). Implementá-los criaria comportamento novo,
o que conflita com "não introduzir feature nova fora do escopo" e "não
reescrever arquitetura". Por isso ficam **registrados como parciais /
pendentes para uma fase de produto**, não como concluídos.

---

## 7. Antes/depois

| Dimensão | Antes | Depois |
|---|---|---|
| `htmlFor` em `app/src` | 0 | 77 (10 arquivos) |
| Foco por teclado | invisível | anel dourado `:focus-visible` |
| Loading | "Carregando…" textual | skeleton com varredura + `aria-live` |
| `e.message` cru na UI | 1 (HistoricoProgresso) | 0 |
| Toast de sucesso ao registrar | não | sim |
| Dropdown "Mais" | fechamento instável | clique-fora/Esc + ARIA |
| Login coordenação lento | sem aviso | aviso após 2,5s |
| Banco / RLS / Edge / migrations | — | **inalterados** |

---

## 8. Conclusão

A camada UX1 entrega o **acabamento de interface** previsto, **sem tocar
em segurança ou arquitetura**: acessibilidade de formulários resolvida
(labels associados, foco visível, ARIA), loading honesto com skeletons,
microcopy sem vazamento técnico e os quatro itens de polimento da AV2
fechados. Itens de **produto** (modo essencial / semáforo) ficam
explicitamente marcados como pendentes — não como concluídos.

**Status da camada: CONCLUÍDA no escopo de acabamento** (itens de produto
8.4/8.5 permanecem P4 para fase futura).

---

*Anexos:* `checklist-acessibilidade.md`, `microcopy-erros-vazios-sucessos.md`.
