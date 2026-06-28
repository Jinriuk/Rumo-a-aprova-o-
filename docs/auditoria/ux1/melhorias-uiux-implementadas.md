# UX1.2 — Melhorias de UI/UX implementadas (aba a aba)

**Projeto:** Rumo à Aprovação
**Branch:** `claude/ux1-interface-accessibility-yc7rbw`
**Data:** 2026-06-28
**Escopo:** acabamento de interface (UI/UX) sem tocar em segurança ou
arquitetura. Continuação da fase UX1, a partir do diagnóstico priorizado
aba a aba.

> **Regra de ouro respeitada:** nenhuma migration, Edge Function, policy
> RLS, regra de Auth, `escola_id`/tenant ou contrato de banco foi alterada.
> Tudo é front-end (`app/src`). `npm run build` (Vite) **verde** após cada
> bloco e ao final. Contratos de teste e2e (`label+input`, nomes de botões/
> abas, textos de conteúdo) foram **preservados** — nada foi reestruturado
> a ponto de quebrar seletor.

---

## 1. Visão geral do que foi feito

| # | Melhoria | Prioridade | Status |
|---|---|:--:|:--:|
| 1 | Sistema de **modais** (confirmar/prompt) substituindo `window.prompt/confirm/alert` | 🔴 P1 | ✅ |
| 2 | **Cabeçalhos semânticos** (`<h1>`/`<h2>`/`<h3>`) | 🔴 P1 | ✅ |
| 3 | **Retry** ("tentar de novo") nas telas de erro dos 4 perfis | 🟡 P2 | ✅ |
| 4 | Aluno: **modo essencial** na aba Hoje | 🔴 P1 | ✅ |
| 5 | Aluno: **cronômetro contextual** (só Hoje/Registrar) | 🟡 P2 | ✅ |
| 6 | Aluno: **índice de navegação** na aba Desempenho | 🔴 P1 | ✅ |
| 7 | Aluno: clareza do campo obrigatório **Tópico** | 🟡 P2 | ✅ |
| 8 | Responsável: **semáforo "está indo bem?"** + benchmark | 🔴 P1 | ✅ |
| 9 | Coordenação: **cadastro colapsável** (não empurra a lista) | 🟡 P2 | ✅ |
| 10 | Coordenação: filtros com mais respiro + **tabela com scroll** no mobile | 🟢 P3 | ✅ |
| 11 | Superadmin: **abas** (Visão / Escolas / Logs) | 🔴 P1 | ✅ |
| 12 | Superadmin: **paginação** dos logs | 🟡 P2 | ✅ |
| — | Migração completa de ícones emoji→SVG | 🟡 | ⏸ deferido (ver §6) |
| — | Refatorar `body { zoom }` → escala `rem` | 🟡 | ⏸ deferido (ver §6) |
| — | Contraste do texto secundário | 🟢 | ✔ não era problema (medido 7:1, AAA) |

---

## 2. Novos componentes do design system

Em `app/src/shared/ui/componentes.jsx`:

- **`Modal`** — overlay acessível: `role="dialog"`, `aria-modal`, fecha com
  **Esc** e clique-fora, **trava o scroll do corpo**, devolve o foco a quem
  abriu, borda dourada e sombra (mesma identidade do tema).
- **`useDialogo()`** — hook imperativo que substitui os diálogos nativos
  mantendo o fluxo `async/await`:
  - `confirmar(opts) → Promise<boolean>`
  - `prompt(opts) → Promise<string|null>` (com `validar` inline)
  - `elemento` — renderizado uma vez por tela.
- **`ErroComRetry`** — caixa de erro humana com botão **"↻ Tentar de novo"**.

> Por que imperativo: `const ok = await dialogo.confirmar({…})` lê como o
> antigo `window.confirm`, então a troca foi 1‑para‑1, sem espalhar estado
> de modal por cada componente.

---

## 3. Detalhe por perfil / aba

### 3.1 Transversal
- **Modais** no lugar de `prompt/confirm/alert` em: Turmas (renomear/
  excluir), Registro de estudo (remover registro), Lista de alunos
  (renomear, gerar credencial de responsável, registrar consentimento e
  **exclusão LGPD** — esta com botão de perigo). Antes: caixas nativas do
  navegador, feias e ruins no celular.
- **Semântica de cabeçalho**: `SectionCard` agora emite `<h3>`, o
  `Cabecalho` (nome da escola) emite `<h1>` e o Backoffice emite `<h1>` —
  hierarquia real para leitor de tela, sem mudar o visual.
- **Retry** em toda falha de carregamento de tela inteira.

### 3.2 Aluno (`VisaoEstudo`)
- **Modo essencial** (aba Hoje): botão em pílula que recolhe os extras de
  gamificação (missões persistidas e conquistas recentes), deixando o
  núcleo "o que faço agora" — faixa, missão, meta e registrar. Preferência
  **persistida** em `localStorage`; **padrão desligado** (não muda a
  experiência de quem não optar).
- **Cronômetro contextual**: aparece só nas abas Hoje e Registrar (antes
  ocupava espaço no topo de todas as abas, inclusive Desempenho e Plano).
- **Desempenho — índice de navegação**: barra de atalhos
  (Resumo · Por matéria · Histórico) que rola até a seção, reduzindo a
  sensação de "parede de blocos" **sem esconder conteúdo**.
- **Tópico (obrigatório)**: `aria-required`, dica de obrigatoriedade no
  placeholder e `title` no asterisco.

### 3.3 Responsável (`ResumoResponsavel`)
- **Semáforo "está indo bem?"** no topo: leitura única (Indo bem /
  No caminho / Vale acompanhar / Precisa de atenção) com cor e frase,
  derivada de limiares **honestos e alinhados ao resto da tela**
  (70% de acerto = bom; 5+ dias = rotina forte; 0 dia = atenção).
- **Benchmark textual** nos indicadores-chave: "Acerto geral" e "Dias
  ativos" agora dizem se o número é bom ("bom nível", "ótima rotina",
  "precisa de reforço"…), respondendo ao "isso é bom?".
- **Retry** no erro de carga.

### 3.4 Coordenação (`AreaEscola`)
- **Cadastro de alunos colapsável** (padrão fechado): o formulário não
  empurra mais a **lista** de alunos para baixo. Quem só consulta vê a
  lista direto; quem cadastra expande.
- **Turmas**: renomear e excluir agora em **modal** (com proteção: turma
  com alunos não exclui, e exclusão pede confirmação de perigo).
- **Filtros** da lista com busca flexível no mobile.

### 3.5 Superadmin (`AreaAdmin`)
- **Abas** Visão geral / Escolas / Logs (com contadores) no lugar de uma
  página única e longa. Cada aba isola seu bloco.
- **Logs paginados** (30 por vez, "Ver mais"), em vez de despejar até 200
  linhas de uma só vez; volta a 30 ao trocar o filtro.
- **Tabela de importação CSV** com scroll horizontal no mobile.

---

## 4. Arquivos alterados

```
app/src/shared/ui/componentes.jsx     Modal, useDialogo, ErroComRetry, SectionCard h3
app/src/shared/ui/Cabecalho.jsx       nome da escola como <h1>
app/src/modules/conteudo/useTrilha.js recarregar() para retry
app/src/routes/aluno/VisaoEstudo.jsx  modo essencial, cronômetro contextual, índice Desempenho, retry
app/src/modules/motor/Registrar.jsx   remover registro via modal; Tópico obrigatório claro
app/src/modules/desempenho/ResumoResponsavel.jsx  semáforo + benchmark
app/src/routes/responsavel/AreaResponsavel.jsx    retry
app/src/routes/escola/AreaEscola.jsx  Turmas via modal; retry
app/src/modules/pessoas/CadastroAlunos.jsx        cadastro colapsável; tabela CSV scroll
app/src/modules/pessoas/ListaAlunos.jsx           ações via modal (incl. LGPD); busca flexível
app/src/routes/admin/AreaAdmin.jsx    abas Visão/Escolas/Logs; paginação de logs; retry; h1
```

---

## 5. Testes e segurança de regressão

- **Build Vite**: verde em todas as etapas (≥7 builds na sessão).
- **Contratos e2e preservados** (conferidos contra `app/e2e/`):
  - `label + input` (helper `campo`) intacto — só atributos adicionados.
  - Nomes de botões/abas e textos de conteúdo inalterados ("Hoje",
    "Entrar", "Sair", "Painel de gestão", "Alunos da escola",
    "Atividades da semana", "Radar de bordo|Eficiência por setor|…",
    "Evolução nos simulados", etc.).
  - **Modo essencial padrão desligado** → a aba Hoje e a Desempenho
    continuam mostrando todo o conteúdo que os testes esperam.
  - **Cronômetro** permanece na aba Hoje (onde os testes o acionam).
  - Responsável **continua sem** botões de edição (semáforo é leitura;
    não adiciona `Concluir/Adiar/Registrar/Iniciar estudo`).
  - Modais só disparam por ação do usuário fora dos caminhos felizes dos
    testes → não introduzem erro de console (os testes exigem console
    limpo).
- **Acessibilidade**: modais com foco/Esc/aria; `aria-required` no Tópico;
  `role="status"` no semáforo; cabeçalhos semânticos.
- **Suíte unit/DB** (`tests/*.test.mjs`) exige Postgres — não executável
  neste ambiente remoto; as mudanças são de UI e não tocam a lógica
  coberta. O gate de CI roda no PR (build → unit+isolamento → e2e).

### Revisão dupla
- **1ª passada (uso real):** percorri login, registro/remoção, Turmas
  (renomear/excluir), lista de alunos (renomear/credencial/consentimento/
  exclusão LGPD), responsável, backoffice (abas, logs, criar/editar
  escola). Diálogos abrem/fecham por Esc, clique-fora e botões; o foco
  volta ao gatilho.
- **2ª passada (item a item):** os 12 itens da tabela §1 conferidos no
  código e via `grep` (3 `dialogo.elemento` renderizados; 5 telas com
  `ErroComRetry`; `<h1>/<h3>` presentes; zero `window.prompt/confirm/alert`
  fora de comentários).

---

## 6. Deferidos (com justificativa)

Dois itens do diagnóstico **não** foram implementados de propósito, por
caírem na fronteira "não reescrever o design system / não mexer em
arquitetura" e exigirem QA visual amplo que extrapola o acabamento:

1. **Migração completa de ícones emoji → SVG.** A base mistura emojis
   (✦ ◷ ◎ ⚓) com SVG (`Icones.jsx`). Padronizar é desejável, mas é uma
   troca extensa e subjetiva (centenas de ocorrências) que merece uma fase
   própria de design, com revisão visual. Risco de regressão alto para
   ganho estético incremental.
2. **Refatorar `body { zoom }` (desktop) para escala `rem`.** `zoom` é
   não‑padrão (instável no Firefox). Trocar exige reescalar tipografia e
   espaçamentos e revalidar todos os breakpoints — fora do escopo de
   acabamento pontual.

E um item se mostrou **falso problema** na verificação:

3. **Contraste do texto secundário** (`sub #8AA4BC` sobre `#0A1622`):
   medido em ≈ **7:1** (AAA para texto normal). Nenhuma mudança necessária.
   (Corrige a estimativa preliminar do diagnóstico.)

---

## 7. Conclusão

As melhorias de UI/UX priorizadas aba a aba foram implementadas e
revisadas, deixando o produto mais coeso e profissional: diálogos nativos
substituídos por modais do design system, navegação do backoffice em abas,
densidade do aluno controlável (modo essencial), leitura do responsável
com semáforo e benchmark, e caminhos de recuperação (retry) em toda falha
de carga — **sem nenhuma alteração de segurança, banco ou arquitetura**.

Os dois itens deferidos estão documentados como fase futura de design, não
como pendência de acabamento.

*Anexos da fase UX1:* `relatorio-ux1-acabamento.md`,
`checklist-acessibilidade.md`, `microcopy-erros-vazios-sucessos.md`.
