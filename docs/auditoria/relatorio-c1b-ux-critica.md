# Relatório C1B — UX Crítica

**Data:** 2026-06-19  
**Branch:** `claude/c1b-ux-critica`  
**Escola demo:** Matriz Educação RM (`11111111-1111-4111-8111-111111111111`)

---

## Resumo executivo

Seis frentes de UX crítica foram corrigidas. Todas as mudanças são pequenas, reversíveis e mobile-first. Nenhuma alteração de RLS, service_role, dados reais ou motor C0.

---

## C1B.1 — Aba Hoje: estados da missão com CTAs

**Causa raiz:** `MissaoAtual` exibia apenas dois estados implícitos (pendentes > 0 / pendentes = 0) sem CTAs. O aluno não sabia o que fazer a seguir.

**Correção:** `app/src/modules/motor/MetaHero.jsx`

Adicionado prop `aoAvancar` e detecção de `atrasada = pendentes > 0 && String(meta.fim) < todayISO()`.

**Quatro estados com feedback visual e CTA:**

| Estado | Condição | Badge | CTA |
|--------|----------|-------|-----|
| Em andamento | `pendentes > 0` e `!atrasada` | dourado "⊚ alvo atual" | "✎ Registrar estudo" → aba Registrar |
| Concluída | `pendentes === 0` | dourado "✓ concluída" | "Ver próxima missão" → Plano · "✎ Revisar missão" → Registrar |
| Atrasada | `pendentes > 0 && fim < hoje` | vermelho "⚠ atrasada" | "Concluir pendências" → Registrar |
| Próxima bloqueada | Bloco separado abaixo | — | Explicação dinâmica: missão concluída → data de desbloqueio; pendentes → "Complete os objetivos" |

**Propagação:** `app/src/routes/aluno/VisaoEstudo.jsx` linha 103 — adicionado `aoAvancar={podeEditar ? irAba : undefined}` (CTAs visíveis apenas ao aluno, não à coordenação em modo leitura).

---

## C1B.2 — Registro: "Ver mais" (limite inicial 7)

**Causa raiz:** `Registrar.jsx` linha 83 exibia `registros.slice(0, 12)` — limite fixo no código, sem controle do usuário. Em mobile com muitos registros, rolagem desnecessária.

**Correção:** `app/src/modules/motor/Registrar.jsx`

- `useState(7)` → `limiteRecentes` (inicial 7, amigável em iPhone)
- Botão "Ver mais (N registros)" abaixo da lista expande para todos os registros
- Idempotente: ao adicionar novo registro, `recarregar()` chama `setVersao`, mas `limiteRecentes` fica estável (o usuário não perde o contexto de expansão por uma recarga de dados)

---

## C1B.3 — Desempenho: hierarquia e linguagem conservadora

**Causa raiz (hierarquia):** `NiveisPorMateria` aparecia antes de `Progresso` e `RadarDesempenho`. Nível por matéria é uma inferência — deve vir depois das evidências primárias.

**Nova ordem na aba Desempenho** (`app/src/routes/aluno/VisaoEstudo.jsx`):
1. InsightsDesempenho (visão geral — permanece no topo)
2. **Progresso** (simulados — evidência direta)
3. RadarDesempenho (distribuição por matéria)
4. **NiveisPorMateria** (inferência — movida para baixo)
5. Acumulado (histórico)

**Causa raiz (linguagem):** título "Níveis por matéria" sugeria precisão absoluta. O componente já recusava classificar com menos de 20 questões, mas o título não comunicava isso.

**Correção:** `app/src/modules/desempenho/Niveis.jsx` — dois títulos alterados:
- `"Níveis por matéria"` → `"Estimativa de nível por matéria"` (estado vazio e estado com dados)

---

## C1B.4 — Simulados: truncamento de nome longo

**Causa raiz:** Linha do histórico de simulados em `Progresso.jsx` (linha 296) usava um único `<div>` com nome + data sem `overflow: hidden`. Nomes longos quebravam o layout mobile.

**Correção:** `app/src/modules/desempenho/Progresso.jsx`

Substituído por um `<div>` flexbox com:
- `<span>` de nome: `overflow: hidden / textOverflow: ellipsis / whiteSpace: nowrap / flex: 1 / minWidth: 0` — trunca o nome se necessário
- `<span>` de data: `flexShrink: 0` — a data nunca some

O div pai já tinha `flex: 1 / minWidth: 0`, garantindo que o truncamento funcione corretamente.

---

## C1B.5 — Conquistas/Patentes: exibição compacta

**Causa raiz:** `Conquistas.jsx` exibia todas as 13 patentes e todos os 14 conquistas de todos os grupos de uma vez. Em mobile, isso criava um scroll enorme antes do usuário chegar na sua posição atual.

**Correções:** `app/src/modules/motor/Conquistas.jsx`

### Patentes
- Por padrão: janela de 3 (patente anterior, atual e próxima via `PATENTES.slice(inicioJanela, fimJanela)`)
- Botão "▾ Ver carreira completa (13 patentes)" expande para todas
- Botão "▴ Mostrar só minha posição" recolhe
- Estado: `useState(false)` → `verCarreira`

### Conquistas por grupo
- Por padrão: todas as desbloqueadas + primeira bloqueada (motivação)
- Se há mais bloqueadas: botão "▾ Ver mais (N conquistas)" expande o grupo
- Botão "▴ Ver menos" recolhe
- Estado: `useState(new Set())` → `gruposExpandidos` (Set de nomes de grupo)

---

## C1B.6 — Coordenação: alertas com nomes de alunos

**Causa raiz:** Os cards de alerta ("Sem atividade", "Sem credencial", "Meta atrasada") mostravam apenas o número. A coordenação precisava navegar para outra aba para saber quem estava em risco.

**Correção:** `app/src/modules/desempenho/PainelGestao.jsx`

- `Alerta` recebe prop `nomes: string[]`
- Exibe até 3 primeiros nomes (`.split(" ")[0]` para usar apenas o primeiro nome) + "e mais N" se houver mais
- Texto truncado com `textOverflow: ellipsis` para segurança em mobile
- Passados via: `ag.filter(x => x.semAtividade).map(x => x.aluno.nome.split(" ")[0])` etc.
- Alinhamento vertical do ícone ajustado para `flex-start` (para acomodar a linha de nomes)

---

## Restrições observadas

- RLS não alterada.
- `service_role` não usado no front.
- Nenhum dado real apagado ou criado.
- Motor C0 não tocado.
- Fase 15 não recriada.
- Bloco B não refeito.
- Backoffice/superoperador não tocado.
- DB1 não iniciado.
- C1C não misturada.

---

## Arquivos alterados

| Arquivo | Frente | Tipo |
|---------|--------|------|
| `app/src/modules/motor/MetaHero.jsx` | C1B.1 | UI — 4 estados de missão + CTAs |
| `app/src/routes/aluno/VisaoEstudo.jsx` | C1B.1, C1B.3 | UI — propagação aoAvancar + reordenação desempenho |
| `app/src/modules/desempenho/Niveis.jsx` | C1B.3 | UI — título conservador |
| `app/src/modules/motor/Registrar.jsx` | C1B.2 | UI — limite 7 + "Ver mais" |
| `app/src/modules/motor/Conquistas.jsx` | C1B.5 | UI — patentes compactas + grupos com "Ver mais" |
| `app/src/modules/desempenho/Progresso.jsx` | C1B.4 | UI — truncamento de nome de simulado |
| `app/src/modules/desempenho/PainelGestao.jsx` | C1B.6 | UI — mini-lista de alunos nos alertas |
