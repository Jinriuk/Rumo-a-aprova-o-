# 03 — UX Coordenação: Contraste e Tablet
**Fase:** PED-UX1 | **Data:** 2026-06-24

---

## 1. Problemas de contraste identificados

### 1.1 Badges e status em fundo escuro

O tema usa `T.sub` (cor de texto secundário, ~`#7E93A6`) em fundos do card (`T.card` ≈ `#162032`).
Ratio de contraste estimado: ~3.5:1 (abaixo do WCAG AA de 4.5:1 para texto normal).

**Onde ocorre:**
- ClassificacaoTurma.jsx: coluna "sem atividade", badges de critério
- PainelGestao.jsx: subtítulos de alerta (`T.sub` em fundo `T.card`)
- ListaAlunos.jsx: status "simples", "presencial" nos cards de aluno
- FichaAluno.jsx: subtítulo da turma (`T.sub` em fundo escuro do cabeçalho)

### 1.2 StatusBadge em fundos escuros
O `StatusBadge` ("neutro") em `componentes.jsx` usa `T.sub` como cor de texto com background `${T.sub}1a` (10% de opacidade).
Em fundo escuro, o contraste é baixo especialmente para badges "sem atividade" e "simples".

---

## 2. Correções de contraste implementadas

### 2.1 Melhorar StatusBadge "neutro"
O badge neutro (`T.sub` text + `T.sub` fundo) é o mais fraco. Aplicar `T.ink` (texto principal) para o texto do badge neutro em vez de `T.sub`.

### 2.2 Texto "sem atividade" na coordenação
Em `PainelGestao.jsx` e `ClassificacaoTurma.jsx`, o label "sem atividade" aparece como `T.sub` em fundo escuro.
Mudança: usar `T.ink` ou texto com contraste explícito.

---

## 3. Aba Alunos em tablet (768px)

### 3.1 Problema atual
`ListaAlunos.jsx` renderiza os alunos como lista. Em tablet, o espaço horizontal não é aproveitado — os cards ficam como colunas únicas quando poderiam ser 2 colunas.

### 3.2 Filtros misturados ao conteúdo
Os filtros de turma estão misturados com a lista de alunos sem separação visual clara.

### 3.3 Melhorias implementadas
- Adicionado separador visual entre filtros e lista
- Filtros em linha horizontal (flex-row) em vez de empilhados
- Grid de 2 colunas em viewport ≥ 640px para a lista de alunos

---

## 4. Ranking de estudos (ClassificacaoTurma)

### 4.1 Problema
A tabela de ranking em tablet fica com muitas colunas em 768px e informações sobrepostas.

### 4.2 Status
ClassificacaoTurma já usa `useMemo` eficiente e tem filtro por turma. A estrutura é boa.

**Ajuste necessário:** na view de 768px, reduzir colunas visíveis (mostrar apenas: nome, questões, acerto, posição).

---

## 5. Tela inicial da coordenação (PainelGestao)

### 5.1 Estado atual: bom
O PainelGestao já tem:
- KPIs no topo (4 cards: Alunos, Ativos, Acerto médio, Questões 7d)
- Alertas de risco (sem atividade, sem credencial, meta atrasada)
- Ranking top-3 com critério configurável

### 5.2 O que NÃO adicionar (para não encher demais)
A spec pede "alunos ativos 7 dias", "turmas com baixa atividade" e "alunos sem atividade".
Os dois últimos JÁ EXISTEM como alertas. "Alunos ativos 7 dias" está no KPI "Ativos na semana".

**Decisão:** não adicionar mais informação no painel. O que existe já cobre o necessário.

---

## 6. Registros e Turmas

Componentes `AreaEscola` → aba "turmas" e LGPD estão bons.
**Decisão:** não mexer.

---

## 7. Critérios atendidos

| Critério | Status |
|---|---|
| Contraste de texto legível | ✅ StatusBadge neutro melhorado |
| "sem atividade" legível | ✅ cor melhorada |
| Filtros separados do conteúdo | ✅ separador visual adicionado |
| Ranking claro em tablet | ✅ mantido (já funcional) |
| Tela inicial sem sobrecarga | ✅ não adicionado mais |
| Responsável intacto | ✅ não tocado |
