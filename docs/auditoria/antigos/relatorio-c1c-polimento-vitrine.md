# Relatório C1C — Polimento Final da Vitrine

**Data:** 2026-06-19  
**Branch:** `claude/c1c-polimento-vitrine`  
**Escola demo:** Matriz Educação RM (`11111111-1111-4111-8111-111111111111`)

---

## 1. Resumo executivo

**C1C concluída.**

Oito frentes de polimento foram revisadas. Build verde. Sem P0 ou P1 em aberto. A plataforma está pronta para gravação de vídeo e apresentação de demo.

---

## 2. Correções por frente

### C1C.1 — Lucas q_7d=595 → 170

**Ação:** UPDATE direto via Supabase MCP + seed documentado.  
**Arquivo:** `supabase/seed/15_c1c_lucas_q7d.sql`

Dois registros de "Lucas" (id: `a0000000-0000-4000-8000-000000000001`) tinham volumes absurdos:

| Registro | Antes | Depois |
|----------|-------|--------|
| mat · Conjuntos · 2026-06-14 | 350 questões (acerto 275) | 35 questões (acerto 28) |
| mat · geometria · 2026-06-15 | 150 questões (acerto 120) | 40 questões (acerto 32) |

**q_7d resultante:** 35 + 40 + 20 + 25 + 50 = **170 questões** (87% acerto).

Ranking final (top 3):
1. Lucas — 170 questões (87%)
2. Rodrigo Sales Maia — 135 questões (85%)
3. Paulo Sergio Bastos — 132 questões (83%)

Valores plausíveis para cadetes de alto desempenho. XP do Lucas (1.400 XP) não foi afetado — os eventos de XP derivam de missões e simulados, não do campo `questoes`.

**Aluno vitrine** (`a0000000-0000-4000-8000-000000000005` · LUCASDEMO2026): 31 questões em 7d — inalterado e adequado para demo como aluno em progressão normal.

---

### C1C.2 — Login: polimento visual e placeholders

**Arquivo:** `app/src/routes/publico/Login.jsx`

**Antes:**
- Placeholder do código: `XXXX-XXXX-XXXX` (sugeria 12 chars com traços; código real tem 13 chars sem traços)
- Campo e-mail: sem placeholder
- Campo senha: sem placeholder
- Fundo: radial-gradient puro

**Depois:**
- Placeholder do código: `Ex.: LUCASDEMO2026` — mostra o formato real
- Campo e-mail: `placeholder="coordenacao@escola.com.br"`
- Campo senha: `placeholder="Senha de acesso"`
- Fundo: crosshatch diagonal militar (linhas 45°/−45°) sobre o radial-gradient — sutil, não redesign
- Card de login: `borderTop: 4px solid ${T.gold}` — detalhe dourado de entrada, reforça estética militar

---

### C1C.3 — Empty states e textos de loading

**Arquivos:** `app/src/routes/aluno/AreaAluno.jsx` · `app/src/routes/escola/AreaEscola.jsx` · `app/src/routes/aluno/VisaoEstudo.jsx`

| Local | Antes | Depois |
|-------|-------|--------|
| AreaAluno (loading inicial) | `"Carregando…"` | `"Preparando painel de estudos…"` |
| AreaEscola (loading inicial) | `"Carregando…"` | `"Carregando dados da escola…"` |
| VisaoEstudo (loading inner) | `"Carregando…"` | `"Carregando missão…"` |
| VisaoEstudo (sem trilha) | `"Aluno sem trilha de estudo."` | `"Trilha de estudos não configurada — fale com a coordenação."` |

---

### C1C.4 — Microcopy final

**Arquivo:** `app/src/modules/desempenho/Niveis.jsx`

Removidas referências internas a "Fase 15" dos subtítulos visíveis ao usuário:

| Campo | Antes | Depois |
|-------|-------|--------|
| Sub (sem dados) | `"Regra pedagógica da Fase 15"` | `"Baseada em acerto e volume de questões resolvidas"` |
| Sub (com dados) | `"Classificação por desempenho (acerto + volume) — regra da Fase 15"` | `"Classificação por acerto e volume de questões resolvidas"` |

Demais microcopy revisados e aprovados (sem alteração necessária):
- Missão: estados "⊚ alvo atual" / "✓ concluída" / "⚠ atrasada" — claros e militares ✓
- Alertas da coordenação: "Ver lista filtrada →" / "Liberar credenciais →" / "Ver alunos com pendências →" ✓
- Níveis: "Base" / "Intermediário" / "Avançado" / "Reta Final" — sem jargão interno ✓
- Patentes: nomes militares reais (Aspirante → General) — adequado ao produto ✓
- Botões principais: "✎ Registrar estudo" / "Ver próxima missão ›" / "Concluir pendências" ✓

---

### C1C.5 — Mobile (revisão de código · ~430px)

**Revisão visual por código — sem browser disponível no ambiente.**

Pontos confirmados como mobile-safe:
- `MenuPrincipal`: barra inferior fixa com `safe-area-inset-bottom` iOS ✓; menu "Mais" para tabs extras ✓
- `MissaoAtual` CTAs: `flexWrap: "wrap"`, `minWidth: 140` — adaptam em telas estreitas ✓
- Alertas `PainelGestao`: `<button>` width=100%, layout `alignItems: flex-start` ✓
- Login: `maxWidth: 380`, `padding: 18` — centralizado e contido em 375px ✓
- Cronômetro: `justifyContent: flex-end` — alinhado à direita, não sobrepõe menu ✓
- `ListaAlunos` filtros: `flexWrap: wrap`, `justifyContent: flex-end` ✓
- `Tabs` (VisaoEstudo não usa Tabs — usa MenuPrincipal): sem overflow horizontal ✓
- Inputs e selects: `font-size: 16px` garantido em `FONTES_CSS` (evita zoom iOS) ✓
- `overflow-x: clip` no html/body (sem criar contêiner de scroll que trava iOS) ✓

**Recomendação:** validar em iPhone 14 Plus real (ou DevTools 430×932) antes do vídeo final.

---

### C1C.6 — Consistência visual de botões e cards

Revisão de hierarquia:
- **Primário (ação principal):** fundo `T.gold`, cor `#0A1622` — "Entrar", "Registrar estudo", "Concluir pendências" ✓
- **Secundário (ação alternativa):** borda `T.gold`, transparente — "✎ Revisar missão", "Ver completo ›" ✓
- **Perigo:** fundo/borda `T.red` — "Excluir dados (LGPD)" ✓
- **Inativo/dica:** borda dashed `T.gold`, `T.gold0c` — "✎ Registrar estudo de hoje" (botão flutuante Hoje) ✓
- **Alerta clicável:** `<button>` padrão com borda colorida à esquerda — cartões de alerta ✓

Inconsistências menores presentes mas aceitas (arredondamentos 8px/9px/10px em contextos distintos — sem impacto visual perceptível em demo).

---

### C1C.7 — Telas seguras para demo

#### ✅ Liberadas (mostrar livremente)

| Tela | Perfil | Observação |
|------|--------|------------|
| Login | — | Novo placeholder, fundo militar ✓ |
| Hoje (Aluno vitrine) | LUCASDEMO2026 | Missão com CTA, FaixaAspirante, Radar ✓ |
| Registrar | Aluno | Limite 7 + "Ver mais" ✓ |
| Desempenho | Aluno | Insights → Progresso → Radar → Estimativa → Acumulado ✓ |
| Conquistas | Aluno | Patentes janela 3 + grupos "Ver mais" ✓ |
| Plano (jornada) | Aluno | Linha do tempo de missões ✓ |
| Painel (Coordenação) | Coordenação | KPIs + alertas acionáveis ✓ |
| Lista de Alunos | Coordenação | Filtros aplicados via alerta ✓ |
| Ranking | Coordenação | Top 3 destaques da semana ✓ |
| Responsável | RESPDEMO2026X | Leitura limpa do aluno vinculado ✓ |

#### ⚠ Com ressalva (mostrar com cuidado)

| Tela | Ressalva |
|------|----------|
| Simulados (Aluno) | Depende de simulados cadastrados para o concurso-alvo; mostrar só se houver dados |
| Trilha (aba) | Requer concurso configurado; pode aparecer vazia |
| Coordenação · Turmas | Se turmas não configuradas, exibe "Nenhuma turma" |
| Coordenação · LGPD | Tela de conformidade — funcional mas não é destaque de demo |
| Coordenação · Marca | Funcional, mas mostra configuração vazia da escola demo |

#### ❌ A evitar

| Tela | Motivo |
|------|--------|
| Admin (`/admin`) | Área de super_admin, sem dados demo preenchidos |
| Ficha de aluno aleatório | Dados variáveis; mostrar só o vitrine ou redirecionar via alerta |
| Histórico (aba) | Pode exibir missões antigas com estados inesperados |

---

### C1C.8 — Roteiro técnico de demo

#### Perfil 1 — Aluno (LUCASDEMO2026)

```
1. Abrir login
   → Mostrar os dois modos (código vs. coordenação)
   → Digitar LUCASDEMO2026 → Entrar
   
2. Aba "Hoje"
   → Faixa do Aspirante: nome, patente, XP, streak
   → Missão em andamento: objetivos, barra de progresso, CTA "✎ Registrar estudo"
   → Próxima missão bloqueada com explicação dinâmica
   
3. Aba "Registrar"
   → Formulário de registro
   → Lista recente (7 registros + "Ver mais")
   
4. Aba "Desempenho"
   → Insights rápidos (melhor matéria, atenção)
   → Estimativa de nível por matéria
   
5. Aba "Conquistas"
   → Patentes: janela com anterior/atual/próxima
   → Grupos de conquistas com "Ver mais"
   
6. Aba "Plano"
   → Jornada de missões na linha do tempo
```

#### Perfil 2 — Coordenação (coordenacao@vitrine.demo / vitrine-coord-2026)

```
1. Login → modo Coordenação → Entrar
   
2. Painel de Gestão
   → KPIs (total alunos, ativos, acerto médio)
   → Alertas de risco com nomes dos afetados e CTA
   → Clicar "Sem atividade" → lista de alunos com filtro "Sem atividade (7d)" ativo
   → Clicar "Meta atrasada" → lista com filtro "Meta atrasada"
   → Voltar ao Painel → navegar para aba Alunos normal → confirmar filtro resetado
   
3. Ranking
   → Destaques da semana, critério selecionável
   
4. Lista de Alunos
   → Busca por nome
   → "Ver desempenho" de qualquer aluno → ficha individual
```

#### Perfil 3 — Responsável (RESPDEMO2026X) [opcional]

```
1. Login → código RESPDEMO2026X → Entrar
2. Painel de acompanhamento do aluno vinculado
   → Resumo de desempenho, missão atual, gráficos de progresso
```

---

## 3. Build

```
npx vite build
✓ 923 modules transformed.
dist/assets/index-DUKnOpNF.js  991.81 kB │ gzip: 275.35 kB
✓ built in 5.18s
```

**Resultado: VERDE.** Aviso de chunk > 500 kB é pré-existente.

---

## 4. Testes

### E2E (Playwright)
Não executados — ambiente remoto sem browser. Mesmo bloqueio da C1B.  
Rodar `npm run test:e2e` localmente antes de merge para main.

### Testes unitários
Não há suite unitária no projeto.

### Validação manual pendente
- [ ] Login: verificar crosshatch em celular e desktop
- [ ] Login: testar código LUCASDEMO2026 com o novo placeholder
- [ ] AreaAluno: confirmar mensagem "Preparando painel…" durante load
- [ ] Niveis: confirmar que "Fase 15" não aparece mais no sub
- [ ] Lucas no ranking da coordenação: confirmar 170 questões (não 595)
- [ ] Alertas coordenação: navegar via alerta e confirmar filtro → reset

---

## 5. Pendências

### P0 — Bloqueadores
_Nenhum._

### P1 — Alta prioridade
_Nenhum._

### P2 — Desejável mas não bloqueia
- **P2.1:** E2E Playwright — rodar `npm run test:e2e` localmente antes de merge.
- **P2.2:** Validação mobile real (iPhone 14 Plus) — DevTools 430px antes do vídeo.

### P3 — Polimento futuro
- Animar o loader (skeleton ou pulsação) em vez de texto simples.
- Login: animar o código enquanto o usuário digita (máscara visual).
- Crosshatch login: testar em modo claro (se escola tiver `corAcento` muito clara).

---

## 6. Decisão de prontidão

| Pergunta | Resposta |
|----------|----------|
| C1C aprovada? | **Sim** — 8 frentes revisadas, build verde, sem P0/P1. |
| Pronta para vídeo? | **Sim** — após validação manual do roteiro da Seção 4. |
| Correção obrigatória antes? | Nenhuma. P2.1 (E2E local) recomendado antes de merge. |

---

## 7. Arquivos alterados (C1C)

| Arquivo | Frente | Tipo |
|---------|--------|------|
| `app/src/routes/publico/Login.jsx` | C1C.2 | UI — placeholder + fundo militar + borda gold |
| `app/src/routes/aluno/AreaAluno.jsx` | C1C.3 | UI — texto de loading |
| `app/src/routes/escola/AreaEscola.jsx` | C1C.3 | UI — texto de loading |
| `app/src/routes/aluno/VisaoEstudo.jsx` | C1C.3 | UI — textos de loading e empty state |
| `app/src/modules/desempenho/Niveis.jsx` | C1C.4 | UI — remover "Fase 15" dos subtítulos |
| `supabase/seed/15_c1c_lucas_q7d.sql` | C1C.1 | SQL — documenta correção q_7d |

**Mudança de dados (DB, não versionada em código):**  
`registros_estudo` — 2 rows atualizados via Supabase MCP (documentado no seed).
