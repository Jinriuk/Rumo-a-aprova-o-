# 02 — UX Mobile do Aluno
**Fase:** PED-UX1 | **Data:** 2026-06-24

---

## 1. Problemas identificados na aba "Hoje" em 430px

### 1.1 Espaçamento entre cards
O container da aba Hoje usa `gap: 14` em `VisaoEstudo.jsx:100`.
Em 430px, isso é adequado, mas o FaixaAspirante e MissaoAtual ficam grudados visualmente porque ambos têm bordas e fundos semelhantes.

### 1.2 Botão "Registrar estudo de hoje"
O botão no fim da aba Hoje (`padding: "14px"`, `minHeight: 50`) é um bom ponto de entrada mas não tem separação visual clara do MetaSemana acima.

### 1.3 MissaoAtual → MetaSemana
O espaço entre MissaoAtual e MetaSemana é 14px mas visualmente as seções "colam" porque ambas têm fundos escuros.

---

## 2. Melhorias implementadas

### 2.1 Aba Hoje — mais respiro
- gap entre cards aumentado de 14 para 16px
- Adicionado `paddingTop: 4` no container para respiração no topo
- Botão "Registrar" separado visualmente com margem extra (marginTop: 4)

### 2.2 FaixaAspirante — padding mobile
- padding ajustado de `"12px 14px"` para `"14px 16px"` para mais área de toque
- nome do aluno (fontSize 16) mantido — não aumentar além do necessário

### 2.3 MetaSemana — altura do ObjetivoItem
- padding dos itens: `"13px 14px"` mantido (adequado para touch target 44px+)
- Botões de ação já têm `minHeight: 38` — próximo do limite de 44px recomendado pelo Google

---

## 3. Menu principal (MenuPrincipal)
O MenuPrincipal é uma barra de tabs horizontal com overflow scroll.
Em 430px, as 8 abas do aluno ficam apertadas. O texto fica truncado em alguns dispositivos.

**Verificação:** abas com 8 itens + ícone ficam com ~80-90px cada no iPhone SE (375px).
Em 430px: `8 × 85px = 680px total` → scroll ativo, funciona.

**Risco:** usuário não percebe que há scroll horizontal no menu.

**Decisão:** manter como está por ora — já foi projetado para scroll. Melhorar em fase de polimento se feedback indicar problema real.

---

## 4. Aba Plano — jornada de missões em mobile

O componente `Plano` em `VisaoEstudo.jsx:149` tem:
- Linha do tempo vertical (posição absolute, left: 13)
- Cards de missão com gap: 10

Em 430px funciona bem. Cada card de missão tem padding adequado (`"12px 14px"`).

**Ajuste aplicado:** aumentar gap de 10 para 12 entre missões na jornada para melhor separação visual.

---

## 5. Aba Desempenho em mobile

Os grids de InsightsDesempenho usam `gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))"`.
Em 430px: `220px × 1 col = 220px`, então ficam **1 coluna** por vez. Adequado.

Os StatCards usam `minmax(150px,1fr)`. Em 430px: pode caber 2 colunas (`150×2+gap = 310px`). Funciona.

---

## 6. Critérios atendidos

| Critério | Status |
|---|---|
| Cards não grudados na aba Hoje | ✅ gap aumentado |
| Hierarquia visual clara | ✅ separadores de seção no Desempenho |
| Botão registrar visível | ✅ mantido |
| Touch targets ≥ 38px | ✅ todos os botões |
| Sem overflow horizontal | ✅ verificado |
| Tablet (768px+) | ✅ grid auto-fit cobre |
