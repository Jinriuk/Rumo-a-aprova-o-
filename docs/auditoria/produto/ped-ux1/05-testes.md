# 05 — Testes: Fluxos Obrigatórios PED-UX1
**Fase:** PED-UX1 | **Data:** 2026-06-24

---

## 1. Build

```
npm run build
```

**Resultado:** ✅ Build passou sem erros. Apenas aviso pré-existente de chunk size (>500KB), sem relação com esta fase.

---

## 2. Fluxos verificados por inspeção de código

| # | Fluxo | Status | Observação |
|---|---|---|---|
| 1 | Aluno entra | ✅ | AreaAluno.jsx intacto |
| 2 | Aluno abre Hoje | ✅ | gap aumentado, breathing melhorado |
| 3 | Aluno abre Plano | ✅ | "Missão X" → "Semana X", sem quebra de lógica |
| 4 | Aluno abre Trilha sem erro | ✅ | TrilhaConcurso com estados claros |
| 5 | Aluno abre Desempenho | ✅ | separadores de seção adicionados |
| 6 | Aluno abre Simulados | ✅ | sem alterações |
| 7 | Aluno abre Conquistas | ✅ | sem alterações |
| 8 | Aluno abre Histórico | ✅ | sem alterações |
| 9 | Responsável entra | ✅ | sem alterações em área do responsável |
| 10 | Coordenação entra | ✅ | AreaEscola.jsx intacto |
| 11 | Coordenação filtra alunos por turma | ✅ | ListaAlunos sem alteração de lógica |
| 12 | Coordenação vê ranking | ✅ | ClassificacaoTurma sem alterações |
| 13 | Coordenação abre turmas | ✅ | sem alterações |
| 14 | Escola suspensa bloqueia | ✅ | App.jsx não tocado |

---

## 3. Casos de borda verificados

### 3.1 Aluno sem trilha_id
**Antes:** `useTrilha` definia `erro: "aluno sem trilha"` → tela mostrava `<Erro>aluno sem trilha</Erro>` (texto técnico em vermelho)
**Depois:** `useTrilha` define `erro: null, trilha: null` → `VisaoEstudo` renderiza empty state amigável ("Trilha ainda não configurada pela coordenação")

### 3.2 Aluno sem concurso-alvo (examTag null)
**Antes:** `TrilhaConcurso` já tratava — mostrava "Sem concurso-alvo definido"
**Depois:** comportamento mantido ✅

### 3.3 Erro de rede real na Trilha
**Antes:** `<Erro>Sua conexão parece instável...</Erro>` — aparecia em qualquer erro, incluindo dados ausentes
**Depois:** distingue "falha de conexão" vs "trilha indisponível temporariamente", mostra ícone e texto apropriado

### 3.4 missoes_escola com join falhando
**Antes:** `carregarMissoesEscola` lançava erro quando a tabela não existia ou o join falhava — derrubava a tela inteira
**Depois:** degrada graciosamente, retorna `[]` e loga warning no console

### 3.5 Semana 100% concluída
**Antes:** nenhum feedback especial
**Depois:** card de parabenização com sugestões de próximos passos (revisar desempenho, etc.)

### 3.6 StatusBadge neutro em fundo escuro
**Antes:** texto `T.sub` (cinza médio) em fundo escuro — contraste marginal
**Depois:** texto `T.ink` (claro) — contraste superior

---

## 4. Responsividade

Verificado por inspeção de estilos:
- gap do container Hoje: 14 → 16px ✅
- paddingTop do container Hoje: 0 → 4px ✅
- Botão "Registrar estudo": minHeight 50 → 52px, padding 14px → 16px ✅
- Grids de desempenho: `auto-fit minmax(220px/150px, 1fr)` — funciona em 375px a 1080px ✅
- Trilho vertical do Plano: posição absoluta, funciona mobile ✅

---

## 5. Testes unitários/e2e disponíveis

```bash
ls app/e2e/
```

Os testes e2e existentes não cobrem as abas Trilha/Plano especificamente. Os fluxos verificados foram por inspeção estática de código + build.

**Pendência para QA2:** criar testes e2e para:
- Fluxo aluno sem trilha_id (empty state amigável)
- Fluxo TrilhaConcurso com examTag válido vs inválido vs null
- Fluxo MetaSemana com semana 100% (card de parabenização)
