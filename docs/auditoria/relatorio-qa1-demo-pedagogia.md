# Relatório Final — QA1: Patch de Demo e Pedagogia

> Fase **QA1** — patch curto de demo, pedagogia e vitrine pós-QA0.
> **Não é S1. Não é DB1.** Nada de infraestrutura, RLS de backoffice,
> backup, região do banco, plano Supabase ou E2E/CI foi tocado.
>
> Data: 2026-06-21 · Branch de trabalho: `claude/bold-darwin-ntxx2r`
> (linha de desenvolvimento que já carrega D0 + QA0; ver nota de branch
> ao final da seção 1).

---

## 1. Resumo executivo

* **QA1 foi concluída?** Sim. Os 8 itens obrigatórios foram tratados.
* **O P1 pedagógico foi resolvido?** Sim. Aluno EsPCEx (e qualquer
  concurso ≠ CN) não vê mais conteúdo de "Colégio Naval". O scaffold
  semanal compartilhado foi neutralizado e a trilha por edital continua
  vindo do `exam_tag` do próprio aluno.
* **A demo está mais segura?** Sim. Painel sem "Meta atrasada 59/60"
  alarmista, ranking com Lucas forte mas plausível, turma residual
  removida, diagnóstico de nível conservador e narrativa do responsável
  coerente.
* **Ainda há telas a evitar?** Sim, poucas e com ressalva — ver seção 5.
  Nenhuma é bloqueador absoluto para uma demo conduzida.
* **Pode seguir para S1?** Sim. Nada da QA1 bloqueia a S1; as pendências
  remanescentes são justamente o escopo de S1 (infra/segurança).

**Nota de branch.** O enunciado pedia criar `claude/qa1-demo-pedagogia`
a partir da `main`. Porém D0 e QA0 **ainda não estão na `main`** (a `main`
está na Fase R); eles vivem na linha `claude/bold-darwin-ntxx2r`, que é a
branch de trabalho designada pelo harness desta sessão. Para **não perder
D0/QA0**, a QA1 foi desenvolvida sobre essa branch (que contém todo o
histórico C1B→C1C→C1D→D0→QA0). O nome lógico desta entrega é
"QA1 — demo e pedagogia".

---

## 2. Correções realizadas

| # | Item | O que foi feito | Camada |
|---|------|-----------------|--------|
| QA1.1 | Bug EsPCEx vendo Colégio Naval | Neutralizado o **scaffold semanal compartilhado** (nome da trilha-base + 2 textos genéricos "do CN" → "do seu concurso"). A trilha **por edital** já vinha de `missoes`/`trilha_planos` por `exam_tag` (`TrilhaConcurso`) e está correta. Copy das telas vazias alinhada para "em configuração". Teste de regressão criado. | Seed + UI + teste |
| QA1.2 | "Meta atrasada 59/60" | Alerta **renomeado** de "Meta atrasada" → "Pendências da semana / missão desta semana ainda em aberto (semana em curso)". Criado **cohort "em dia"** (perfil FORTE concluiu a semana ativa). | UI + seed |
| QA1.3 | Lucas outlier no ranking | `q_7d` baixado de **135 → 95** (continua 1º, ~30% acima do 2º). Corrigido registro **50/50 (100%)** irreal → 20/16. XP/patente preservados (vêm do ledger C0). | Seed |
| QA1.4 | "Turma CN 2026" residual (2 alunos) | Lucas + Aline realocados para **"CN/EPCAR — Manhã"**; turma residual vazia removida (só vitrine, sem órfãos). | Seed |
| QA1.5 | "Nível por matéria" incoerente | Linguagem **conservadora**: faixas de volume (insuficiente / estimativa inicial / firme). Avançado/Intermediário só "firmam" com volume robusto; abaixo disso é "estimativa". Leitura "domina/risco" só com base firme. | UI + lógica + teste |
| QA1.6 | Mobile 430px | Revisão de código (sem overflow de página; tabela larga já contida em região rolável; charts responsivos). Pendência de validação visual em dispositivo → P3. | Revisão |
| QA1.7 | Narrativa do responsável | Meta concluída + poucos dias → frase reconhece mérito e orienta sem alarmar; deixa de repetir o alerta dissonante "poucos dias". | UI |
| QA1.8 | Telas liberadas p/ demo | Lista atualizada — seção 5. | Doc |

---

## 3. Evidências

### Arquivos alterados (código)

* `app/src/modules/conteudo/niveisAluno.js` — QA1.5: `CONFIANCA`,
  `LIMIAR.VOLUME_ROBUSTO=50`, classificação devolve confiança
  (ALTA/PARCIAL). Contrato do caso "sem evidência" preservado
  (`{nivel:null, origem}`).
* `app/src/modules/desempenho/Niveis.jsx` — QA1.5: título "Estimativa
  inicial…", matéria PARCIAL marcada "(estimativa)", leitura forte só
  com base firme, nota de método explicando a regra.
* `app/src/modules/desempenho/PainelGestao.jsx` — QA1.2: alerta
  "Pendências da semana".
* `app/src/modules/pessoas/ListaAlunos.jsx` — QA1.2: filtro renomeado.
* `app/src/modules/desempenho/ResumoResponsavel.jsx` — QA1.7: frase
  reconciliada; alerta de "poucos dias" suprimido quando a meta foi
  cumprida.
* `app/src/modules/conteudo/TrilhaConcurso.jsx` — QA1.1: copy neutra
  "Trilha/Missões deste concurso em configuração".

### Seeds / migrations

* `supabase/seed/17_qa1_demo_pedagogia.sql` — **novo**, idempotente.
  Concentra QA1.1 (neutralizar scaffold), QA1.2 (cohort em dia),
  QA1.3 (Lucas), QA1.4 (turma residual). Roda depois de 02 e 13.
  Aplicado também ao banco de demo via MCP e verificado (abaixo).
* `supabase/seed/02_trilha_cn.sql` e `trilha-cn-v1.json` — **não**
  reescritos (respeitam a nota de autoria "NÃO reescrever a
  metodologia"); a neutralização do scaffold é um passo aditivo no 17.

### Testes

* `tests/qa1-exam-tag.test.mjs` — **novo**: garante que aluno EsPCEx
  (e cada concurso) nunca recebe missão de outro edital; concurso sem
  conteúdo → lista vazia (UI mostra "em configuração"), jamais CN.
* `tests/niveis.test.mjs` — estendido: faixas de volume
  (parcial × firme) e preservação do contrato "validar".
* Resultado: **23 testes lógicos · 23 pass · 0 fail**.
* **Build de produção verde** (`vite build`, 923 módulos).

### Alunos verificados (banco de demo, vitrine `11111111…`)

* **Lucas** (CN) — q_7d 135 → **95** (1º; 2º = Pedro 73). Registro
  100% corrigido. Patente preservada (ledger C0).
* **Alexandre Moraes Pinho** (EsPCEx, perfil RISCO) — trilha/plano não
  exibe mais texto "do CN"; missões por `exam_tag` = espcex.
* **Joao Pedro Vasques** (EsPCEx, FORTE) — semana ativa concluída (em
  dia); missões espcex.
* **Andre Luiz Peixoto** (EsSA) e **Fernanda Aguiar Brito** (EEAr) —
  missões pelo próprio edital.

### Antes/depois (números principais)

| Métrica (vitrine) | Antes | Depois |
|---|---|---|
| Atividades do scaffold com texto "do CN" | 2 | **0** |
| Nome da trilha-base | "Colégio Naval — CPACN/2026" | "Trilha base de preparação militar" |
| "Turma CN 2026" (residual, 2 alunos) | existia | **removida** (alunos → CN/EPCAR Manhã, agora 18) |
| Lucas q_7d | 135 (≈1,85× o 2º) | **95** (≈1,30× o 2º) |
| Lucas — registro 100% (50/50) | sim | **não** (20/16) |
| Alunos com meta da semana "em dia" | 1 | **10** |
| Alunos realmente atrasados (fim < hoje) | 0 | 0 (a semana fecha hoje) |

---

## 4. Mobile 430px

**Método.** Sem navegador/dispositivo nesta sessão; revisão **de código**
das telas e padrões de layout em viewport estreito.

**Telas/áreas revisadas:** Aluno (Hoje, Plano, Trilha, Registrar,
Desempenho, Simulados, Conquistas, Histórico), Responsável (painel,
cards, atenção), Coordenação (painel, alunos, ranking, turmas, ficha,
marca, LGPD), Backoffice (`/admin-interno`, dashboard, escolas, logs).

**Achados:**
* Viewport e safe-area corretos (`width=device-width`, `viewport-fit=cover`).
* Gráficos (recharts) usam `ResponsiveContainer width="100%"` → escalam.
* Tabela larga de "Desempenho acumulado" (`minWidth:560`) **já está
  contida** numa região `overflow-x:auto` dentro do card — rola sozinha,
  sem provocar scroll horizontal de página.
* Cabeçalho, menus e linhas usam `ellipsis`/`flexWrap` — sem texto
  cortando layout nem botão saindo da tela nos padrões inspecionados.
* Grids de cards usam `minmax(140–150px,1fr)` → cabem em ~398px.

**Corrigido agora:** nada exigiu correção de código (nenhum overflow de
página identificado). O badge "(estimativa)" introduzido na QA1.5 cabe
(nome da matéria com `ellipsis`).

**Pendência (P3):** validação **visual** real em 430px (emulador/aparelho)
para Simulados, Desempenho (radar/barras) e Ficha do aluno — confirmação
empírica do que a revisão de código indica como ok.

---

## 5. Telas liberadas para demo

### ✅ Liberadas

* **Aluno — Hoje / Plano / Trilha**: scaffold neutro + trilha por
  `exam_tag`. EsPCEx coerente.
* **Aluno — Conquistas / Histórico**.
* **Coordenação — Painel de gestão**: alertas honestos ("Pendências da
  semana", "Sem atividade", "Sem credencial"); distribuição realista.
* **Coordenação — Ranking**: Lucas forte e plausível; top com variação
  natural.
* **Coordenação — Turmas**: sem resíduo "Turma CN 2026".
* **Coordenação — Ficha do aluno (CN e EsPCEx)**: respeita `exam_tag`.
* **Responsável**: narrativa coerente (mérito + orientação).
* **Marca / white-label**, **LGPD**.

### ⚠️ Com ressalva

* **Aluno/Coord — Desempenho (nível por matéria)**: agora conservador,
  porém em alunos com pouco volume aparece "estimativa" — é o
  comportamento desejado; explique em demo que firma com mais registros.
* **Mobile (qualquer tela) em 430px**: liberado por revisão de código;
  validação visual empírica ainda pendente (P3).
* **URL `*.vercel.app`**: branding/comercial — ressalva P2 (sem domínio
  próprio ainda; ver seção 7).

### ⛔ Evitar / conduzir com cuidado

* **Telas de Simulados com alunos de volume baixíssimo**: números pobres
  são reais, mas escolha um aluno FORTE para demonstrar.
* Nenhuma tela ficou em estado "quebrado" que justifique bloqueio total.

---

## 6. Pendências restantes

* **P0:** nenhuma.
* **P1:** nenhuma pedagógica remanescente (o P1 de `exam_tag` foi
  resolvido).
* **P2:**
  * URL `*.vercel.app` (branding/comercial) — fase futura, depende de
    domínio próprio.
  * "Pendências da semana" ainda mostra contagem alta no meio da semana
    (é honesto: semana em curso). Opção futura: separar visualmente
    "em dia / em aberto / sem atividade" em KPIs.
* **P3:**
  * Validação visual mobile 430px em dispositivo/emulador.
  * Possível segunda trilha-base por nicho no futuro (hoje o scaffold é
    único e neutro) — **DB1**, fora de escopo.

---

## 7. Fora do escopo (declaração explícita)

Ficaram para **S1 — Segurança e Operação Técnica** (NÃO tocados aqui):

* região do banco (`us-east-1`);
* backup / retenção;
* plano Supabase (Free/Nano);
* E2E/CI (continuam como estão — apenas documentado, não corrigido);
* RPCs SECURITY DEFINER / RLS de backoffice;
* leaked password protection;
* repositório privado;
* troca de senha do superadmin.

**Domínio próprio:** **não foi feito** porque **ainda não existe domínio
disponível**. A URL `*.vercel.app` permanece como ressalva **P2
comercial/branding** para fase futura — não tratada como bloqueador da QA1.

Nada de **S1** nem **DB1** foi misturado nesta entrega.

---

## 8. Decisão

* **QA1 aprovada?** ✅ Sim — os 8 itens foram tratados; build verde;
  testes lógicos verdes; nenhum dado real afetado (escopo restrito à
  vitrine); nada de S1/DB1 misturado.
* **Pode demonstrar com segurança controlada?** ✅ Sim — seguindo a lista
  de telas da seção 5 (liberadas; ressalvas conhecidas).
* **Pode seguir para S1?** ✅ Sim.
* **Ainda existe algo visual que impeça a demo?** ❌ Não há bloqueador.
  Restam apenas ressalvas conhecidas (mobile visual P3, `*.vercel.app`
  P2) que não impedem uma demonstração conduzida.

---

### Apêndice — idempotência e segurança das mudanças de dados

* Todo o `17_qa1_demo_pedagogia.sql` é idempotente: `UPDATE` por id/condição
  estável, realocação com `on conflict do nothing`, `DELETE` só do resíduo
  vazio (guarda anti-órfão), e a conclusão de metas reusa o
  `idempotency_key` do gatilho C0 (sem XP dobrado em reexecução).
* Escopo de escrita: escola de **vitrine**
  (`11111111-1111-4111-8111-111111111111`). A neutralização do scaffold
  toca conteúdo **global compartilhado** (trilha-base) — higiene de
  conteúdo, não dado de escola; nenhuma outra escola teve dados alterados.
* Sem `service_role` no front. RLS intacta.
