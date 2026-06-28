# Fechamento — "100% de código" (3 etapas) — Rumo à Aprovação

**Data:** 2026-06-28
**Branch:** `claude/rumo-aprovacao-100-codigo-yb1tfa`
**Método:** prova rodada ao fim de cada etapa (suíte + build + teste novo quando
mexe em banco). Nada marcado "feito" sem saída real colada.

> Continuação direta de `auditoria-senior-2026-06-28.md` e das duas correções já
> aplicadas (tabela-fantasma e motor de XP duplicado). Esta rodada **ligou as
> duas features latentes** (recorrência e simulado por concurso), **endureceu o
> que era seguro** (bundle + CSP) e **provou o todo**. O que continua aberto é
> **decisão de produto** ou **infra do dono** — listado sem maquiar na seção 4.

---

## 1. Linha de base (a NÃO regredir)

| Métrica | Antes desta rodada | Depois |
|---|---|---|
| Testes | 456 / 456 verdes | **459 / 459 verdes** (+3 do fluxo de simulado) |
| Build de produção | verde | **verde** |
| Bundle principal (JS) | 1.173 kB (gzip 324) num arquivo | **711 kB (gzip 196)** + recharts em chunks sob demanda |
| Módulos órfãos citados | `recorrencia.js`, `simuladoConcurso.js` | **0** (ambos importados pela UI) |

---

## 2. O que foi LIGADO/feito (com prova)

### Etapa 1 — Recorrência por assunto na Trilha do Concurso
- `TrilhaConcurso.jsx` passou a usar `consolidarRecorrencia`,
  `prioridadeSugerida` e `relatorioIncidencia` (de `conteudo/recorrencia.js`)
  para mostrar, por assunto, o **grau de recorrência** (estimada/validada/medida)
  e a **prioridade sugerida** — com a regra de ouro preservada: *estimada é
  inferência e não vira prioridade oficial sozinha*.
- Conta **pontos cegos** (assunto no edital sem incidência medida em prova real).
- Novo seam `carregarRecorrenciaDoConcurso(examTag)` que **degrada graciosamente**
  (se a estrutura 15.7 não existir no ambiente, a trilha aparece igual).
- **Prova:** `grep` mostra `recorrencia.js` importado por `TrilhaConcurso.jsx`;
  build verde; suíte 456/456 (sem regressão — etapa não toca banco).

### Etapa 2 — Simulado no formato do concurso (militares)
- Novo `desempenho/SimuladoConcurso.jsx`: quando o concurso tem
  `elimination_model`/`redacao_role`, o aluno **registra acertos por matéria/dia
  + nota da redação** e vê, via `conteudo/simuladoConcurso.js`: **nota por dia**,
  **alerta de eliminação** (absoluto × mediana, sem corte inventado), **avaliação
  da redação** no papel certo e **objetivo sugerido**.
- `Simulados` virou um seletor de formato: **concurso** (CN, EPCAR, EsPCEx, ESA,
  EEAr) quando há estrutura cadastrada; **genérico atual** caso contrário — nada
  regride para quem não tem concurso de formato.
- **Persistência:** reusa as colunas `exam_tag`/`redacao_nota` que a migration
  **0014** já criou (com RLS de `simulados` cobrindo-as) — **não precisou de
  migration nova**. A persistência/RLS já era provada por `simulado-db.test.mjs`.
- **Prova:** `grep` mostra `simuladoConcurso.js` importado pela UI; novo
  `tests/simulado-concurso-fluxo-db.test.mjs` (3 testes) cruza a **estrutura real
  do banco** (`prova_materias`) com a avaliação pura — exatamente o fluxo que a
  tela roda; suíte 459/459; build verde.

### Etapa 3 — Endurecimento seguro
- **Code-splitting:** os painéis de gráfico (`Progresso`, `Simulados`,
  `Acumulado`, `RadarDesempenho`) carregam por `import()` dinâmico (React.lazy +
  Suspense). O **recharts saiu do bundle principal**: de **1.173 kB → 711 kB**
  (≈ 40% menor), recharts vai para `CartesianChart` (~346 kB) carregado só ao
  abrir Desempenho/Simulados.
- **CSP:** removido `'unsafe-inline'` do `script-src` (agora `script-src 'self'`).
  Seguro porque o build de produção **não emite script inline** (só o módulo
  externo) e não há `dangerouslySetInnerHTML`. **Não** se usou nonce/hash: em
  hospedagem estática da Vercel não há injeção por requisição, e sem script inline
  `'self'` já é a forma mais forte. `style-src 'unsafe-inline'` foi **mantido de
  propósito** — os estilos inline do React (`style={{…}}`) dependem dele;
  removê-lo causaria regressão visual.

---

## 3. Confirmação item-por-item (pedido → feito? → prova)

| # | Pedido | Feito? | Prova |
|---|---|---|---|
| E1.1 | Trilha usa `consolidarRecorrencia`/`relatorioIncidencia` (grau + prioridade) | ✅ | `TrilhaConcurso.jsx` importa e renderiza painel "Recorrência por assunto" |
| E1.2 | Degrada sem dado, sem quebrar a tela | ✅ | `carregarRecorrenciaDoConcurso` retorna vazio se tabela ausente; painel só renderiza com dado |
| E1.3 | `recorrencia.js` deixa de ser órfão | ✅ | `grep` → importado por `TrilhaConcurso.jsx` |
| E2.1 | Aluno registra acertos/dia + vê nota/dia, eliminação, redação, objetivo | ✅ | `SimuladoConcurso.jsx` via `avaliarSimulado` |
| E2.2 | Mantém simulado genérico quando não há formato | ✅ | `Simulados` → `SimuladoGenerico` (fallback) |
| E2.3 | `simuladoConcurso.js` deixa de ser órfão | ✅ | `grep` → importado por `SimuladoConcurso.jsx` |
| E2.4 | Persistência via migration (se preciso) + teste novo | ✅ (sem migration nova) | colunas da 0014 já cobrem; novo `simulado-concurso-fluxo-db.test.mjs` |
| E2.5 | Teste do cálculo/fluxo | ✅ | 3 testes cruzando `prova_materias` real × avaliação pura |
| E3.1 | Code-splitting, bundle principal menor | ✅ | 1.173 kB → 711 kB; recharts em chunk lazy |
| E3.2 | CSP: remover `unsafe-inline` do `script-src` se seguro | ✅ | `vercel.json` → `script-src 'self'` (sem script inline no build) |
| E3.3 | Atualizar doc de fechamento com estado real | ✅ | este documento |

---

## 4. O que CONTINUA pendente (sem maquiar)

### 4a. Decisão de produto / pedagógico (precisa do dono ou da coordenação)
- **Validar a recorrência estimada → medida.** O painel mostra o grau honesto,
  mas promover "estimada" a prioridade oficial é decisão pedagógica humana
  (tagueamento de mais provas reais). O código não inventa isso.
- **Redação: nota mínima eliminatória por concurso.** Hoje a avaliação usa
  `minimo = null` (apto = tem nota). Definir o piso oficial por edital é dado de
  produto; quando existir, basta passar `redacaoMinimo` ao `avaliarSimulado`.
- **Painel de simulado por concurso para a coordenação.** O aluno já vê o
  formato; expor o mesmo diagnóstico na ficha da coordenação é escopo de produto
  (a RLS de `simulados` já permite a leitura).

### 4b. Infra / conta do dono (NÃO é código — não fechei)
- **SMTP de produção** (envio real de e-mail de provisionamento).
- **Backup automatizado / plano Pro** do Supabase.
- **Região `sa-east-1`** (latência Brasil) — escolha de projeto.
- **Secrets de E2E** (Playwright) no CI — a suíte E2E existe mas **não roda** sem
  as credenciais de ambiente.
- **URL de observabilidade** (logs/alertas externos).
- **Leaked-password protection (plano Pro)** no Auth do Supabase.

> Estes seis itens dependem de credencial/contrato/console do dono. Não há código
> a escrever aqui; ficam como pendência explícita, sem fingir conclusão.

---

## 5. Gate de prova final (saída real)

```
# banco: migrations + seed 2x (idempotência exercitada)
banco rumo_teste pronto (migrations + seed 2x, idempotência exercitada)

# suíte
# tests 459
# pass 459
# fail 0

# build de produção
dist/assets/CartesianChart-CjU5JMOf.js   345.68 kB │ gzip: 100.82 kB
dist/assets/index-caSGI86b.js            711.77 kB │ gzip: 195.59 kB
✓ built in 399ms
```
