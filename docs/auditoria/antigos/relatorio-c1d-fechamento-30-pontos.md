# Relatório C1D — Fechamento dos 30 Pontos da Auditoria Original

**Data:** 2026-06-19
**Branch:** `claude/c1d-fechamento-30-pontos` (a partir da `main`)
**Escola demo:** Matriz Educação RM (`11111111-1111-4111-8111-111111111111`)
**Projeto Supabase:** `bdjkgrzfzoamchdpobbl` (Rumo-a-aprova-o-)

---

## 1. Resumo executivo

A C1D fecha o saldo da auditoria original sem abrir escopo novo. Confirmado que **C1A, C1B e C1C estão mergeadas na `main`** (PRs #11, #12/#13, #14).

| Métrica | Valor |
|---|---|
| Pontos **corrigidos** | **27 / 30** |
| Pontos **parcialmente corrigidos** | **0 / 30** |
| Pontos **adiados formalmente** | **3 / 30** (#19, #29, #30 — todos P2/P3) |
| Pontos **não corrigidos** (sem justificativa) | **0** |
| **P0 em aberto** | **Nenhum** |
| **P1 em aberto** | **Nenhum** |

**Não declaramos 30/30 "resolvido".** Três pontos (#19, #29, #30) foram **conscientemente adiados** para fases futuras (coordenação/backoffice e D0/white-label), com justificativa na Seção 4. Nenhum deles bloqueia demo, vídeo ou piloto.

Itens efetivamente corrigidos **nesta C1D**: **#18, #22, #23, #28, #16, #27, #20, #21** (os seis "parciais/abertos" que restavam da auditoria + os dois de higiene da base demo).

---

## 2. Tabela item a item (30 pontos originais)

Status permitidos: **corrigido** · **parcialmente corrigido** · **adiado formalmente** · **não corrigido** · **não se aplica mais**.

| # | Problema original | Sev. | Status | Fase | Evidência | Observação |
|---|---|---|---|---|---|---|
| 01 | Ranking com dados idênticos em blocos (2–10 / 11+) | P0 | corrigido | C1A | `seed/14_c1a_diversificar_demo.sql` — variação por `hashtext(re.id)` | 9 FORTE / 15 MED / 8 RISCO com valores distintos |
| 02 | Desempenho (aluno): "Trajetória de precisão" e "Desempenho por meta" com eixo Y invertido | P0 | corrigido | C1A | `RadarDesempenho.jsx:112`, `Acumulado.jsx:137` usam `domain=[0,100]`; dados ordenados asc | Era artefato de ordenação, não `reversed` |
| 03 | Simulados (aluno): gráfico de evolução com eixo Y invertido | P0 | corrigido | C1A.5 | `Progresso.jsx:196` ordena `[...simulados].sort(data asc)` | Confirmado: nenhum chart usa `reversed` |
| 04 | Ficha do aluno: desempenho por matéria idêntico (4× 60q·85%) | P0 | corrigido | C1A | efeito colateral da diversificação de C1A.1 | questões/acertos por registro independentes |
| 05 | Lista de alunos: acerto % com 0 questões (7d) | P0 | corrigido | C1A.3 | `ListaAlunos.jsx:141`, `AreaEscola.jsx:211` usam `accSem` (→ "—" quando 0q) | matematicamente coerente |
| 06 | Registrar: lista sem paginação | P1 | corrigido | C1B.2 | `Registrar.jsx:83` limite 7 + "Ver mais" | |
| 07 | Hoje: missão concluída sem CTA | P1 | corrigido | C1B.1 | `MetaHero.jsx` 4 estados + CTAs | |
| 08 | Hoje: cadeado sem explicação na próxima missão | P1 | corrigido | C1B.1 | `MetaHero.jsx` texto dinâmico de desbloqueio | reforçado em #23 (data exata) |
| 09 | Painel: 35/60 sem atividade (58%) | P1 | corrigido | C1A.4 | 39 registros Jun 13–18; resultado **12/60 (20%)** | |
| 10 | Alertas da coordenação sem CTA | P1 | corrigido | C1B.6 | `PainelGestao.jsx` alertas clicáveis → lista filtrada | |
| 11 | Conquistas: 13 patentes sem colapso | P1 | corrigido | C1B.5 | `Conquistas.jsx` janela de 3 + "Ver carreira completa" | |
| 12 | Responsável: sem acesso demo | P1 | corrigido | C1A.6 | conta `RESPDEMO2026X` vinculada a Lucas | já existia em prod; validada |
| 13 | Marca/Simulado: botões lavanda (#e3d4f2) | P1 | corrigido | C1A.7 | `UPDATE escolas SET cor_acento='#CDA349'` | |
| 14 | Desempenho: "Níveis" sem critério visível | P2 | corrigido | C1B.3 / C1C.4 | renomeado "Estimativa de nível"; sub sem "Fase 15" | |
| 15 | Desempenho: hierarquia repetitiva | P2 | corrigido | C1B.3 | `VisaoEstudo.jsx` reordenado (Insights→Progresso→Radar→Estimativa→Acumulado) | |
| 16 | Treemap: label de Português ausente (célula pequena) | P2 | corrigido | **C1D** | `Acumulado.jsx` `CelulaTreemap` — `<title>` em toda célula + label em células médias | ver §3 |
| 17 | Simulados: botão "Salvar" lavanda | P2 | corrigido | C1A.7 | mesmo fix do #13 (`cor_acento`) | |
| 18 | Registrar: delete (×) sem confirmação | P2 | corrigido | **C1D** | `Registrar.jsx` `apagar()` com `window.confirm` | ver §3 |
| 19 | Lista de alunos: dropdowns inline (turma/concurso) misturam leitura/edição | P2 | **adiado formalmente** | — | `ListaAlunos.jsx:153,159` | ver §4 — fase de coordenação/backoffice |
| 20 | LGPD: timestamps de consentimento idênticos | P2 | corrigido | **C1D** | `seed/16_c1d_higiene_demo.sql` + UPDATE remoto: 18 `aceito_em` distintos | ver §3 |
| 21 | LGPD: nomes de responsáveis genéricos | P2 | corrigido | **C1D** | mesmo seed: 0 genéricos, 18 nomes distintos | ver §3 |
| 22 | Hoje: "ofensiva: 0 🔥" desmotivador | P2 | corrigido | C1B (banner) + **C1D** (card Ritmo) | `MetaHero.jsx:179` → "retomando o ritmo" quando streak=0 | ver §3 |
| 23 | Hoje: "desbloqueia em 3 dias" sem data exata | P2 | corrigido | C1B (relativo) + **C1D** (data) | `MetaHero.jsx` "Disponível em 22/06 (domingo) — 3 dias" | ver §3 |
| 24 | Login: placeholder "XXXX-XXXX-XXXX" com hífens | P3 | corrigido | C1C.2 | `Login.jsx` placeholder "Ex.: LUCASDEMO2026" | |
| 25 | Login: background liso | P3 | corrigido | C1C.2 | `Login.jsx` crosshatch militar + borda dourada | |
| 26 | Conquistas: desbloqueadas/bloqueadas misturadas | P3 | corrigido | C1B.5 | `Conquistas.jsx` desbloqueadas primeiro + "✓ Desbloqueada" | |
| 27 | Treemap: abreviações ("Mat","Ing") pouco claras | P3 | corrigido | **C1D** | `CelulaTreemap` `<title>` com nome completo (`nomeCompleto`) | ver §3 |
| 28 | Simulados: nome pré-preenchido pode duplicar | P3 | corrigido | **C1D** | `Progresso.jsx` `proximoNomeSimulado()` auto-incrementa | ver §3 |
| 29 | Cronômetro visualmente desconectado | P3 | **adiado formalmente** | — | `Registrar.jsx`/`VisaoEstudo.jsx` | ver §4 — fase futura de UX |
| 30 | Marca: URL de logo (Supabase) em vez de upload | P3 | **adiado formalmente** | — | `Marca.jsx` | ver §4 — D0/white-label/backoffice |

**Total: 27 corrigido · 0 parcial · 3 adiado formalmente · 0 não corrigido.**

---

## 3. Itens corrigidos nesta C1D

### #18 — Confirmação antes de deletar registro
`app/src/modules/motor/Registrar.jsx` — `apagar(id)` agora exige confirmação antes de chamar `db.removerRegistro`:
```js
if (typeof window !== "undefined" &&
    !window.confirm("Remover este registro de estudo? Esta ação não pode ser desfeita.")) return;
```
- Diálogo nativo (mobile-safe), com botões **Cancelar** e **OK**.
- Registro só é removido após confirmação. Não altera o motor C0 (apenas adia a chamada já existente).
- A coordenação (leitura) não passa `aoApagar`, então o × não aparece lá — sem impacto.

### #22 — "ofensiva: 0 🔥" em todos os lugares
`app/src/modules/motor/MetaHero.jsx:179` — o card "Ritmo Diário" era o último lugar que exibia `ofensiva: 0 🔥`:
```js
sub={m.streak > 0 ? `ofensiva: ${m.streak} 🔥` : "retomando o ritmo"}
```
- O banner `FaixaAspirante` já ocultava (`streak > 0 &&`). Agora **nenhum card** mostra "0 🔥".
- Streak positivo continua exibindo o valor + fogo normalmente.

### #23 — Data exata de desbloqueio da próxima missão
`app/src/shared/regras/regras.js` — novo helper `fmtBRDiaSemana(iso)` → `"22/06 (domingo)"` em horário **local** (mesmo critério de `todayISO`).
`app/src/modules/motor/MetaHero.jsx` — explicação da próxima missão:
```
diasDesbloqueio === 0  → "Disponível hoje à meia-noite."
diasDesbloqueio > 0    → "Disponível em 22/06 (domingo) — 3 dias."
```
- Mantém a contagem relativa **e** a data de calendário. Sem ambiguidade.

### #28 — Auto-incremento do nome do simulado
`app/src/modules/desempenho/Progresso.jsx` — `proximoNomeSimulado(simulados)` varre os nomes existentes (`/^Simulado (\d+)$/`) e sugere `max+1`:
- sem simulado → "Simulado 1"; com "Simulado 1" → "Simulado 2"; com 1,2,3 → "Simulado 4".
- O simulado planejado da semana (`semanaAtiva.simulado`) ainda tem prioridade.
- Após salvar, reseta já contando o que entrou. Nome customizado continua permitido.

### #16 / #27 — Treemap: labels e abreviações
`app/src/modules/desempenho/Acumulado.jsx` — `CelulaTreemap`:
- `<title>{nomeCompleto} — {pct}%</title>` em **toda** célula → tooltip nativo no hover (resolve #27 e o #16 da matéria invisível em fatia estreita).
- Limiar de label reduzido: células médias (`w>30 && h>18`) passam a mostrar ao menos a abreviação; grandes mostram abreviação + %.
- Nenhuma matéria fica sem identificação possível. Ver validação visual em §6.

### #20 / #21 — Higiene da base demo (LGPD)
`supabase/seed/16_c1d_higiene_demo.sql` (idempotente, escopo exclusivo da escola vitrine) + aplicado na base remota via Supabase MCP.

**Estado ANTES (consulta real, escola vitrine):**
```
total=18 · genericos=18 · distintos_aceito_em=2
```
**Estado DEPOIS:**
```
total=18 · genericos_restantes=0 · distintos_aceito_em=18 · nomes_distintos=18
primeiro=2026-05-22 · ultimo=2026-06-12
```
- Nomes fictícios plausíveis (30 prenomes × 20 sobrenomes), escolha **determinística** por `hashtext(aluno_id)` → estável entre execuções.
- `aceito_em` distribuído por ~24 dias em horário comercial, determinístico por aluno.
- **Vínculo responsável-aluno preservado** (apenas o texto `responsavel_nome` mudou; `vinculos_responsaveis` intocado).
- **Escopo**: somente `escola_id = 11111111-…`; nenhuma outra escola tocada. RLS preservada (DML comum, sem `service_role` no front).
- **Idempotente**: o `WHERE responsavel_nome ilike 'Responsável d%'` impede re-sorteio em re-execução.

---

## 4. Itens adiados (justificativa formal)

### #19 — Dropdowns inline turma/concurso (P2) — adiado
**Justificativa:** são `<select>` nativos (`ListaAlunos.jsx:153,159`). Alterá-los exige abrir o seletor e escolher deliberadamente outra opção — o risco de "edição acidental" é **substancialmente menor** que o toque no `×` que motivou o #18 (no mobile o `<select>` abre um picker dedicado). Converter para um modo "Editar" com salvar/cancelar é um refactor médio da renderização da linha e pertence ao escopo de **gestão/coordenação/backoffice** (regra #9: não criar funcionalidade grande fora dos pontos pendentes). **Registrado como P2 pendente** para a fase de coordenação/backoffice. Não bloqueia demo nem piloto.

### #29 — Cronômetro desconectado (P3) — adiado
**Justificativa:** o cronômetro é **funcional** e já não sobrepõe o menu (validado em C1C.5). Integrá-lo ao card de missão/registro ou transformá-lo em barra fixa é polimento de UX, não correção de defeito. **Registrado como P3 pendente** para fase futura de UX. Não bloqueia piloto.

### #30 — Upload de logo vs URL (P3) — adiado
**Justificativa:** envolve upload ao Supabase Storage, validação de arquivo e política de bucket — funcionalidade de **white-label/backoffice** que pertence à fase **D0** (regra #4/#9: não iniciar D0). O campo por URL funciona para demo (fallback preservado). **Registrado como P3/fase futura.** Por causa deste item, **não declaramos 30/30 "resolvido"** — declaramos 27 corrigidos + 3 adiados.

---

## 5. Testes

| Tipo | Resultado | Observação |
|---|---|---|
| **Build** (`vite build`) | ✅ **VERDE** | `dist/assets/index-DcVPhSz5.js` 992.70 kB; aviso de chunk >500 kB é pré-existente |
| **Unitários / lógica** (`node --test`) | ✅ **83/83** | regras, progresso, agregados, paginacao, gamificacao, niveis, missoes, pedagogia, provas, recorrencia, simulado |
| **DB** (`*-db.test.mjs`, `motor.test.mjs`) | ⚠️ **não executado** | exigem Postgres local na porta 54322 (Supabase local) — indisponível no ambiente remoto. Falha é `ECONNREFUSED`/dependência, **não** relacionada às mudanças da C1D |
| **E2E Playwright** | ⚠️ **não executado** | `npx playwright install chromium` falha por **bloqueio de rede** (download do Chrome bloqueado). Mesmo bloqueio de C1B/C1C |
| **Smoke aluno** | ✅ via build + lógica | fluxos Hoje/Registrar/Desempenho/Simulados/Conquistas cobertos por testes de lógica e build |
| **Smoke coordenação** | ✅ via build | alertas/lista/ranking compilam; sem alteração de fluxo na C1D |
| **Smoke responsável** | ✅ via consulta | conta `RESPDEMO2026X` e vínculo confirmados em prod |
| **Validação mobile 430px** | ⚠️ **revisão por código** | sem browser no ambiente — ver §6 |

**Pendência de processo (recomendado antes do merge para `main`):**
- Rodar `cd tests && PGHOST=... npm test` contra um Supabase local para cobrir os testes `-db`.
- Rodar `npm run test:e2e` localmente (Chromium disponível) para os fluxos E2E.

---

## 6. Validação visual #16/#27 e mobile (revisão por código)

Sem browser no ambiente remoto; revisão por código das mudanças desta fase (todas de baixo risco em mobile):

- **Treemap (#16/#27):** `ResponsiveContainer height=220`; `<title>` é SVG nativo (tooltip no hover desktop / long-press mobile). Label de abreviação agora aparece em células `w>30 && h>18`. Nenhuma matéria fica sem identificação.
- **#18 `window.confirm`:** diálogo nativo do SO — comportamento garantido em mobile.
- **#22:** troca de texto no `sub` do `StatCard` — mesmo layout, sem risco de overflow.
- **#23:** texto mais longo na explicação da próxima missão; o contêiner usa `flex` com `minWidth:0` e o texto quebra naturalmente; o badge à direita não mudou.
- **#28:** valor default de um `<input>` — sem impacto de layout.

**Recomendação:** validar em viewport real 430×932 (iPhone 14 Plus / DevTools) os fluxos login, Hoje, Registro, Desempenho (treemap), Simulados, Conquistas, Coordenação, Lista de alunos, Alertas filtrados e Responsável antes do vídeo final.

---

## 7. Decisão

| Pergunta | Resposta |
|---|---|
| **C1D aprovada?** | **Sim.** Todos os obrigatórios (#18, #22, #20/#21, #23, #28) corrigidos; #16/#27 corrigidos e validados por código; build verde; 83/83 testes de lógica; sem P0/P1 aberto; tabela dos 30 completa. |
| **Os 30 pontos foram fechados?** | **27 corrigidos + 3 adiados formalmente.** **Não** declaramos 30/30 "resolvido" — #19, #29 e #30 foram conscientemente deixados para fase futura. |
| **Quais pontos seguem fora do escopo?** | **#19** (P2 — coordenação/backoffice), **#29** (P3 — UX futura), **#30** (P3 — D0/white-label). Nenhum bloqueia demo, vídeo ou piloto. |
| **Pode seguir para D0?** | **Sim.** Não há P0/P1 em aberto. Os 3 itens adiados estão registrados e dois deles (#19, #30) são naturalmente endereçados no escopo de coordenação/white-label. Recomenda-se rodar E2E + mobile real localmente antes do merge para `main`. |

---

## 8. Arquivos alterados (C1D)

| Arquivo | Ponto | Tipo |
|---|---|---|
| `app/src/modules/motor/Registrar.jsx` | #18 | UI — confirmação no delete |
| `app/src/modules/motor/MetaHero.jsx` | #22, #23 | UI — ofensiva 0 + data exata |
| `app/src/shared/regras/regras.js` | #23 | helper `fmtBRDiaSemana` |
| `app/src/modules/desempenho/Progresso.jsx` | #28 | UI — auto-incremento de nome |
| `app/src/modules/desempenho/Acumulado.jsx` | #16, #27 | UI — labels/tooltip do treemap |
| `supabase/seed/16_c1d_higiene_demo.sql` | #20, #21 | SQL — higiene da base demo (idempotente, escopo vitrine) |
| `docs/auditoria/relatorio-c1d-fechamento-30-pontos.md` | — | relatório |

**Mudança de dados (DB remoto, documentada no seed):** `consentimentos` da escola vitrine — 18 linhas atualizadas (nomes + `aceito_em`) via Supabase MCP.

---

## 9. Restrições observadas

- Trabalho a partir da `main`; C1A/C1B/C1C confirmadas mergeadas.
- D0 não iniciado. DB1 não iniciado. C1A/C1B/C1C não refeitas.
- RLS não alterada. `service_role` não usado no front.
- Nenhuma funcionalidade grande criada fora dos pontos pendentes.
- Toda decisão de adiar (#19, #29, #30) justificada (§4).
- Escopo de dados restrito à escola vitrine; nenhuma outra escola tocada.
