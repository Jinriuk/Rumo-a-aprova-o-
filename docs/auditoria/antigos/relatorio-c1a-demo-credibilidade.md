# Relatório C1A — Credibilidade da Demo

**Data:** 2026-06-19  
**Branch:** `claude/c1a-demo-credibilidade`  
**Escola demo:** Matriz Educação RM (`11111111-1111-4111-8111-111111111111`)

---

## Resumo executivo

Sete bloqueadores de credibilidade foram identificados e corrigidos antes de qualquer gravação de vídeo, deck ou reunião com o cliente. As correções não alteram RLS, não usam `service_role` no front, não apagam dados reais e não hardcodam valores para mascarar problemas.

---

## C1A.1 — Ranking com dados idênticos em blocos

**Causa raiz:** `13_vitrine_militar_demo.sql` usava valores fixos por perfil (FORTE: sempre q=20 acc=17; MEDIANO: q=15 acc=10; RISCO: q=10 acc=4). O ranking exibia blocos de alunos com % de acerto e questões idênticos.

**Correção aplicada:** `UPDATE` determinístico em `registros_estudo` usando `hashtext(re.id::text)` como fonte de variação por registro. Bandas aplicadas:
- FORTE: questões 15–27, acerto 75–92 %
- MEDIANO: questões 10–20, acerto 55–74 %
- RISCO: questões 5–14, acerto 30–51 %

**Resultado verificado:** 9 FORTE (q 15–27, pct 82–86 %), 15 MEDIANO, 8 RISCO — todos com valores distintos.

**Arquivo:** `supabase/seed/14_c1a_diversificar_demo.sql`

---

## C1A.2 — Ficha do aluno com desempenho por disciplina idêntico

**Causa raiz:** Mesma origem de C1A.1 — a disciplina ciclava com `v_disc[1 + (i % 4)]` mas questões/acertos eram uniformes, então todos os alunos do mesmo perfil tinham a mesma % em cada disciplina.

**Correção:** A diversificação via `hashtext` de C1A.1 resolve C1A.2 como efeito colateral: cada `registro_estudo` tem agora questões/acertos próprios independentemente da disciplina.

---

## C1A.3 — Alunos com 0 questões exibindo % de acerto não-zero

**Causa raiz:** Os componentes `ListaAlunos` e `AreaEscola` (componente Turmas) exibiam `r.acc` (acerto acumulado de vida) em um contexto de "últimos 7 dias". Um aluno com zero questões na semana podia mostrar "83%" porque tinha histórico antigo.

**Correção:**
- `app/src/modules/pessoas/ListaAlunos.jsx` linha 141: `r.acc` → `r.accSem`
- `app/src/routes/escola/AreaEscola.jsx` linha 208: `r.acc` → `r.accSem`

`r.accSem` é `null` quando `ca_questoes_7d = 0`, exibindo "—" em vez de um percentual enganoso.

---

## C1A.4 — Excesso de alunos sem atividade (35/60; meta ≤ 12)

**Causa raiz:** Os 38 alunos do Bloco B foram inseridos com datas de registro até no máximo Jun/2026, e os 8 alunos RISCO tinham última atividade em Jun 5 (>7 dias antes de Jun 19). Junto com alunos existentes que não tiveram registros recentes, o total de "sem atividade 7d" era 35.

**Correção:** 39 registros novos adicionados com datas Jun 13–18 para 23 alunos:
- 17 alunos existentes (002–021, exceto 019 e 022)
- 4 alunos RISCO em recuperação parcial (027, 038, 055, 057)
- 2 alunos SEM ativados (037, 047)

**Alunos mantidos inativos (12):**
- 4 RISCO defasados (029, 039, 045, 059) — padrão realista de abandono
- 4 SEM sem histórico (030, 031, 040, 058) — alunos que nunca começaram
- 4 existentes com engajamento muito baixo (006, 014, 019, 022)

**Resultado verificado:** 48 com atividade / 12 sem atividade.

**Arquivo:** `supabase/seed/14_c1a_diversificar_demo.sql`

---

## C1A.5 — Gráfico de evolução de simulados com eixo Y invertido/incoerente

**Causa raiz:** `listarSimulados` retorna simulados em ordem decrescente (`data DESC`). O componente `Progresso.jsx` usava esse array diretamente para construir `chart`, sem reordenar. O gráfico plotava do mais recente para o mais antigo, tornando uma melhora real aparente como queda.

**Correção:** `app/src/modules/desempenho/Progresso.jsx` linhas 196–202:
```js
// antes
const chart = simulados.map((s) => ({ ... }));

// depois
const chart = [...simulados]
  .sort((a, b) => String(a.data).localeCompare(String(b.data)))
  .map((s) => ({ ... }));
```
A cópia (`[...simulados]`) preserva o array original; `evolucao` (diff entre último e penúltimo do chart) agora reflete corretamente a tendência mais recente.

---

## C1A.6 — Conta demo do Responsável não funcional

**Diagnóstico:** A conta **já existia** em produção, criada em execução anterior do seed.

**Credenciais da conta demo:**
- Código de acesso: `RESPDEMO2026X`
- Email interno: `respdemo2026x@codigo.acesso.local`
- Senha: `RESPDEMO2026X`
- Aluno vinculado: Lucas Gabriel Monteiro da Silva (`a0000000-0000-4000-8000-000000000005`)
- Vínculo em: `vinculos_responsaveis`

**Status:** Funcional. Nenhuma alteração necessária.

---

## C1A.7 — Botões primários com cor lavanda (herança indevida do white-label)

**Causa raiz:** O campo `cor_acento` da escola demo em produção estava definido como `#e3d4f2` (lavanda), provavelmente de um teste de white-label. O sistema `tema(corAcento)` substitui `BASE.gold` pela cor de acento da escola, fazendo todos os `<Botao>` herdarem a lavanda.

**Correção SQL:**
```sql
UPDATE escolas SET cor_acento = '#CDA349'
WHERE id = '11111111-1111-4111-8111-111111111111';
```

**Resultado:** Botões primários voltam ao dourado padrão `#CDA349`.

---

## Motor C0

Após todas as alterações em `registros_estudo`, o motor C0 foi re-processado:
```sql
SELECT app.backfill_progresso('11111111-1111-4111-8111-111111111111');
```
Retornou `0` — nenhum novo evento gerado (estado já consistente após os patches).

---

## Restrições observadas

- RLS não alterada.
- `service_role` não usado no front.
- Nenhum dado real apagado.
- Nenhum dado pessoal real criado.
- Problema não mascarado com CSS — corrigido na camada correta (dado ou lógica de exibição).
- Motor C0 íntegro.
- Fase 15 não recriada.
- Bloco B não refeito integralmente — apenas patches cirúrgicos.
- Backoffice/superoperador não tocado.
- DB1 não iniciado.

---

## Arquivos alterados

| Arquivo | Tipo | Bloqueador |
|---------|------|-----------|
| `supabase/seed/14_c1a_diversificar_demo.sql` | SQL novo | C1A.1, C1A.2, C1A.4, C1A.7 |
| `app/src/modules/pessoas/ListaAlunos.jsx` | UI fix | C1A.3 |
| `app/src/routes/escola/AreaEscola.jsx` | UI fix | C1A.3 |
| `app/src/modules/desempenho/Progresso.jsx` | UI fix | C1A.5 |

C1A.6 não gerou arquivo — conta já existia em produção.
