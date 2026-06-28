# Checklist de Acessibilidade — UX1

**Data:** 2026-06-28 · **Branch:** `claude/ux1-interface-accessibility-yc7rbw`
**Método:** checklist manual (sem axe/Lighthouse no ambiente remoto) +
inspeção de código. Baseado em WCAG 2.1 AA no que cabe a um SPA React.

Legenda: ✅ atende · 🟡 parcial · ⛔ não atende · — não aplicável

---

## 1. Rótulos e nomes acessíveis (WCAG 1.3.1 / 4.1.2)

| Item | Status | Evidência |
|---|---|---|
| `<label>` associado por `htmlFor`/`id` nos formulários principais | ✅ | `htmlFor` 0→77 em 10 arquivos |
| Login (código, e-mail, senha, recuperação) | ✅ | `routes/publico/Login.jsx` |
| Redefinir senha (nova + confirmação) | ✅ | `routes/publico/RedefinirSenha.jsx` |
| Registrar estudo (matéria, tópico, questões, acertos, tempo, obs, data) | ✅ | `modules/motor/Registrar.jsx` |
| Cadastro de aluno / lote / turma | ✅ | `modules/pessoas/CadastroAlunos.jsx` |
| Onboarding pedagógico | ✅ | `modules/motor/Onboarding.jsx` |
| Marca da escola | ✅ | `modules/escola/Marca.jsx` |
| Ficha do aluno (onboarding coordenação) | ✅ | `modules/desempenho/FichaAluno.jsx` |
| Simulado (nome, data, acertos por matéria) | ✅ | `modules/desempenho/Progresso.jsx` |
| Backoffice: criar escola, editar escola, provisionar coordenador, filtros, logs | ✅ | `routes/admin/AreaAdmin.jsx` (37 `htmlFor`) |
| Inputs sem rótulo visível têm `aria-label` (buscas/filtros, file CSV, hex de cor) | ✅ | `aria-label` em ListaAlunos, ListaEscolas, logs, PainelGestao, ClassificacaoTurma, CadastroAlunos |
| Selects "mini" da lista de alunos | ✅ | já tinham `title` (turma/concurso/trilha) |

## 2. Foco de teclado (WCAG 2.1.1 / 2.4.7)

| Item | Status | Evidência |
|---|---|---|
| Foco visível ao navegar por Tab | ✅ | `:focus-visible` (anel dourado, offset 2px) em `tema.js` |
| Sem anel espúrio no clique de mouse | ✅ | `:focus:not(:focus-visible){outline:none}` |
| Controles interativos são `<button>`/`<input>`/`<select>` (focáveis) | ✅ | abas, menu, ações usam `<button>` |
| Dropdown "Mais" fecha com Esc e devolve foco | ✅ | `MaisAcoes` em `componentes.jsx` |
| Botão "olho" da senha não captura Tab e tem nome | ✅ | `tabIndex={-1}` + `aria-label` em Login |
| Ordem de foco segue a ordem visual | ✅ | sem `tabindex` positivo no código |

## 3. Estados dinâmicos anunciados (WCAG 4.1.3)

| Item | Status | Evidência |
|---|---|---|
| Loading anunciado a leitor de tela | ✅ | `CarregandoBloco` `role="status" aria-live="polite"` + `.sr-only` |
| Toast de sucesso anunciado | ✅ | `Toast`/`FeedbackProgresso` `role="status" aria-live="polite"` |
| Mensagem de erro anunciada | ✅ | `Erro` agora com `role="alert"` |
| Campo inválido marcado | ✅ | `aria-invalid` nos campos com validação |
| Aviso de login lento anunciado | ✅ | `role="status"` no aviso da coordenação |

## 4. Movimento e preferências (WCAG 2.3.3 / 2.2.2)

| Item | Status | Evidência |
|---|---|---|
| `prefers-reduced-motion` respeitado | ✅ | corta varredura do skeleton e `.fade` |
| Animações são curtas e não piscam | ✅ | varredura 1.25s, fade 0.5s |

## 5. Contraste e zoom (WCAG 1.4.3 / 1.4.4 / 1.4.10)

| Item | Status | Evidência |
|---|---|---|
| Cor de acento da escola clareada se escura | ✅ | `garantirLegivel` / `LUM_MINIMA` em `tema.js` (pré-existente) |
| Inputs com `font-size:16px` (evita zoom iOS) | ✅ | `tema.js` |
| Sem estouro horizontal (`overflow-x: clip`) | ✅ | `tema.js` + teste e2e `semEstouroHorizontal` |
| Texto sobre dourado usa navy `#0A1622` | ✅ | botões/toasts |
| Contraste do texto secundário (`sub #8AA4BC` sobre navy) | 🟡 | ~4.0:1 — adequado p/ texto grande; revisar para texto pequeno numa fase futura de design tokens |

## 6. Estrutura semântica (WCAG 1.3.1)

| Item | Status | Evidência |
|---|---|---|
| Navegação em `<nav>` | ✅ | `MenuPrincipal` |
| Conteúdo em `<main>` | ✅ | áreas de aluno/responsável/escola |
| `lang="pt-BR"` no documento | ✅ | `index.html` |
| Botão de menu com `aria-haspopup`/`aria-expanded` | ✅ | `MaisAcoes` |
| Hierarquia de cabeçalhos consistente | 🟡 | usa `div` estilizados (classe `disp`) em vez de `<h1..h3>` — melhoria futura de semântica, não bloqueia |

---

## Pendências honestas (não bloqueiam a camada)

- **axe/Lighthouse:** não rodados no ambiente (sem runner a11y dedicado).
  Recomendado integrar `@axe-core/playwright` no e2e numa fase de QA.
- **Cabeçalhos semânticos `<h1..h3>`:** hoje são `div.disp`. Trocar exige
  varredura ampla de estilos — fica para uma fase de design system.
- **Contraste de texto pequeno secundário:** revisar tokens de cor.
- **Modo essencial do aluno / semáforo do responsável:** mudança de
  produto (P4), fora do escopo de acabamento.

## Resumo

| Categoria | ✅ | 🟡 | ⛔ |
|---|---|---|---|
| Rótulos/nomes | 12 | 0 | 0 |
| Foco de teclado | 6 | 0 | 0 |
| Estados dinâmicos | 5 | 0 | 0 |
| Movimento | 2 | 0 | 0 |
| Contraste/zoom | 4 | 1 | 0 |
| Semântica | 4 | 1 | 0 |

Nenhum item ⛔. As pendências são melhorias incrementais documentadas.
