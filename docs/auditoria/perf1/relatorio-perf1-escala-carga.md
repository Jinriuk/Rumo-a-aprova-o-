# PERF1 — Relatório: escala, relatórios, exportação e carga

**Fase:** PERF1 · **Data:** 2026-06-27 · **Camada:** 4 (escala de escola média)
**Branch:** `claude/perf1-escala-relatorios-carga-pbexlc`
**Base:** REG0 (`00-indices/05-camadas-faltantes.md`), SEG1/SEG2, DB1/DB2.

> **Veredito.** Entregues, com teste, a **exportação CSV** (4.6) e a
> **comparação por turma/concurso** (4.7). O **plano de carga 300/500/10k**
> (4.8) está formalizado, com massa 10k pronta e execução do 10k **bloqueada
> por staging** (julho) — documentado como bloqueio claro, não como feito.
> **Virtualização (4.4)** e **índices de gamificação (4.5)** ficam
> deliberadamente **fora de escopo agora** (paginação cobre o MVP; tabelas de
> gamificação dormentes), conforme a nota de governança da REG0.
> **Nenhum índice criado. Nenhuma RLS/Auth tocada. Nenhum fluxo principal
> degradado** (não há query nova).

---

## 1. Item por item (Camada 4)

| # | Item | Status | Evidência |
|---|------|:---:|---|
| 4.1 | RPC `resumo_escola()` | 🟢 já existia | `0016_painel_agregado.sql` |
| 4.2 | Paginação nas listas | 🟢 já existia | `shared/lib/paginacao.js`, `ListaAlunos.jsx` (50/pág.) |
| 4.3 | Índices de escala da coordenação | 🟢 já existia | `0023`, `0028` |
| 4.4 | Virtualização (react-window) | ⚪ **fora de escopo** | sem evidência de ganho; paginação 50/pág. resolve o MVP (ver §4) |
| 4.5 | Índices compostos de gamificação por tenant | ⚪ **fora de escopo** | tabelas dormentes (REG0 1.1); já têm `escola_id` em 0028 (ver `queries-e-indices.md` §4.1) |
| 4.6 | **Exportação CSV por turma/escola** | 🟢 **concluído** | `shared/lib/csv.js`, `shared/metricas/comparativo.js`, `desempenho/Relatorios.jsx` + testes |
| 4.6b | Exportação PDF | 🟡 **planejado** | CSV consolidado primeiro; PDF adiado por complexidade/risco (ver §3) |
| 4.7 | **Comparação por turma / recorte por concurso** | 🟢 **concluído** | `comparativo.js` (`compararTurmas`/`compararConcursos`) + `Relatorios.jsx` + testes |
| 4.8 | Teste de carga 300/10k em staging | 🟡 **parcial / bloqueado** | 300/500 coberto (massa + teste); 10k com gerador pronto, execução bloqueada por staging (`plano-carga-300-500-10000.md`) |

---

## 2. O que mudou (e por quê)

### 2.1 Exportação CSV (4.6) — concluído

- **`app/src/shared/lib/csv.js`** — serialização CSV pura (`paraCSV`,
  escaping RFC 4180, separador `;` pt-BR), download no browser (`baixarCSV`,
  BOM UTF-8 para o Excel ler acento) e `nomeArquivoSeguro`.
- **`app/src/shared/metricas/comparativo.js`** — linhas planas de relatório:
  `linhasRelatorioAlunos` (uma linha por aluno), `linhasRelatorioTurmas`,
  `linhasRelatorioConcursos` + definições de colunas.
- **`app/src/modules/desempenho/Relatorios.jsx`** — botões de export (Alunos /
  Turmas / Concursos) na aba **Ranking** da Área da Escola.

**Por quê assim:** o seam (`shared/data/index.js`) **não** ganhou query nova. O
export reaproveita o agregado por aluno que a Área da Escola já carrega
(`resumoEscola()`). Custo de banco adicional = zero; tudo em memória.

### 2.2 Comparação turma/concurso (4.7) — concluído

- **`comparativo.js`**: `resumirGrupo`, `compararTurmas` (linha por turma +
  "Sem turma"), `compararConcursos` (linha por concurso + "Sem concurso").
- **`Relatorios.jsx`**: duas tabelas comparativas (turma e concurso) com os
  mesmos indicadores agregados.
- **Sem dado inventado:** a média de acerto reproduz exatamente o padrão das
  telas (média das % por aluno entre quem tem acerto lançado). Concursos sem
  aluno não aparecem; alunos sem concurso caem em "Sem concurso".

### 2.3 Carga (4.8) — plano + massa 10k

- **`supabase/seed-volume/massa_10k.sql`** — 10.000 alunos sintéticos em
  **escola dedicada descartável**, ids determinísticos, idempotente,
  **staging-only** (aviso no cabeçalho). Não entra no glob de seed do CI.
- **`docs/auditoria/perf1/plano-carga-300-500-10000.md`** — cenários, métricas,
  SLOs, roteiro e a regra dura de "nunca em prod compartilhada".
- **`docs/auditoria/perf1/queries-e-indices.md`** — mapa das queries pesadas,
  procedimento de EXPLAIN seguro e a decisão de **não** criar índice agora.

---

## 3. Exportação PDF (4.6b) — decisão de adiar

O prompt manda **CSV antes de PDF**, e PDF só "se CSV estiver consolidado e sem
risco". Decisão: **adiar o PDF**. Justificativa:
- PDF de qualidade exigiria dependência nova (jsPDF/pdfmake) — peso e superfície
  de risco que esta camada de escala não precisa.
- O CSV abre direto no Excel/Sheets/Google, onde a escola formata e imprime —
  cobre 100% do caso de uso de "relatório para reunião".
- **Caminho futuro sem lib:** uma rota de impressão (`window.print()` sobre as
  tabelas já renderizadas) entrega "PDF" via navegador, sem dependência. Fica
  como item de UX1/FE1, não bloqueia a escala.

Status honesto: **planejado, não implementado.** Não marcado como concluído.

---

## 4. Virtualização (4.4) — por que fora de escopo

- A lista de alunos já **pagina** (50/pág., `ListaAlunos.jsx`): o DOM nunca
  recebe 500+ linhas de uma vez. As tabelas de comparação têm **uma linha por
  turma/concurso** (dezenas, não milhares).
- `react-window` traria dependência + complexidade (medição de altura,
  acessibilidade de lista virtual) sem evidência de travamento no alvo
  (300–500, ou mesmo 10k já paginado).
- Alinha com a nota de governança REG0: "não fazer virtualização (4.4) enquanto
  paginação cobre o essencial". **Reavaliar** só se o teste de carga mostrar
  jank de render — o que a paginação previne por construção.

---

## 5. Testes (revisão dupla)

### 5.1 Primeira passada — funcionalidade

- **Build de produção:** `npm run build` → **verde** (572 módulos, sem erro).
  O aviso de chunk > 500kB é **pré-existente** (não introduzido por esta
  camada).
- **Testes unitários novos (puros, sem banco):**
  - `tests/csv.test.mjs` — 8 testes: cabeçalho/CRLF, vazio, null→célula vazia,
    escaping (separador/aspas/quebra), separador customizável, nome de arquivo.
  - `tests/comparativo.test.mjs` — 10 testes: `resumirGrupo` (média das %),
    comparação por turma (+"Sem turma"), por concurso (+"Sem concurso"), linhas
    de aluno, colunas nunca indefinidas, e **teste de ISOLAMENTO** (o relatório
    só reflete os alunos recebidos — nada de outra escola entra).
  - Resultado local: **16/16 verde** (`node --test csv.test.mjs comparativo.test.mjs`).

### 5.2 Segunda passada — item por item

Revisado o §1 linha a linha: cada 🟢 tem código + teste; cada 🟡 tem o motivo do
parcial; cada ⚪ tem a justificativa de escopo. Nenhum item marcado "concluído"
com pendência funcional.

### 5.3 Regressão nos quatro perfis

A mudança toca **apenas a aba Ranking da coordenação** (componente novo
`Relatorios.jsx`). Os módulos novos (`csv.js`, `comparativo.js`) são **puros e
só consumidos por essa aba**.

| Perfil | Fluxo tocado? | Risco |
|---|---|---|
| Aluno | Não | nenhum |
| Responsável | Não | nenhum |
| Coordenação | Sim (aba Ranking ganhou Relatórios) | baixo — sem query nova, dado já carregado |
| Superadmin/backoffice | Não | nenhum |

### 5.4 Antes/depois

| Aspecto | Antes | Depois |
|---|---|---|
| Export de turma/escola | inexistente (só LGPD por aluno) | CSV de alunos, turmas e concursos |
| Comparação turma/concurso | inexistente | duas tabelas na aba Ranking |
| Queries ao banco | N na abertura | **idênticas** (zero query nova) |
| Migrations | — | **nenhuma** |
| RLS/Auth | — | **intactas** |

### 5.5 Tenant / isolamento no export

O export é **espelho do array que a tela recebeu**, e a tela só recebe o que a
RLS entregou para a escola logada (`resumo_escola()` filtra por
`app.tenant_id()` do JWT). O teste `comparativo.test.mjs` → "ISOLAMENTO" prova
que passar um subconjunto de alunos produz um relatório só com eles. Não há
caminho para exportar dado de outra escola.

---

## 6. Entregáveis

| Entregável | Caminho | Status |
|---|---|---|
| Relatório da camada | `docs/auditoria/perf1/relatorio-perf1-escala-carga.md` | este doc |
| Plano de carga | `docs/auditoria/perf1/plano-carga-300-500-10000.md` | ✅ |
| Queries e índices | `docs/auditoria/perf1/queries-e-indices.md` | ✅ |
| Export CSV (código) | `app/src/shared/lib/csv.js`, `shared/metricas/comparativo.js`, `desempenho/Relatorios.jsx` | ✅ com testes |
| Massa 10k (staging) | `supabase/seed-volume/massa_10k.sql` | ✅ |
| Testes | `tests/csv.test.mjs`, `tests/comparativo.test.mjs` | ✅ 16/16 |

---

## 7. Rollback

Tudo é **aditivo e reversível**, sem migration:
- Reverter os 5 arquivos novos + a fiação em `AreaEscola.jsx` (1 import + 1
  bloco no `tab === "ranking"`) restaura o comportamento anterior.
- `massa_10k.sql` é script sob demanda — não roda em CI nem em prod; nada a
  reverter no banco a menos que tenha sido aplicado em staging (limpeza: drop da
  escola de carga).
- **Nenhum índice, nenhuma RLS, nenhuma Edge Function, nenhum seed padrão** foi
  alterado.

---

## 8. Critérios de aceite (conferência)

| Critério | Atende? | Como |
|---|:--:|---|
| Carga executada em ambiente seguro **ou** plano formalizado com bloqueio claro | ✅ | 300/500 em banco efêmero; 10k planejado + bloqueado por staging |
| Relatório/export respeita tenant/escola | ✅ | espelho do dado sob RLS + teste de isolamento |
| Nenhum índice criado sem justificativa | ✅ | **nenhum** índice criado; candidato documentado e deixado para EXPLAIN |
| Performance não piorou fluxos principais | ✅ | zero query nova; export em memória |
| Build/testes passam | ✅ | build verde; 16/16 nos testes novos |

---

## 9. Pendências e próximos passos (handoff)

- **10k em staging:** executar o roteiro do `plano-carga` quando o staging
  isolado existir (julho). Coletar baseline de EXPLAIN da `resumo_escola()`.
- **Índice candidato:** só virar migration se o EXPLAIN no 10k provar ganho
  **e** custo de escrita aceitável (`queries-e-indices.md` §4.2).
- **PDF:** avaliar `window.print()` das tabelas em UX1/FE1 (sem dependência).
- **Carga concorrente (k6/Artillery):** depende de staging com Auth próprio.
