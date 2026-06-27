# SEG2 / S2-M — Plano de rollback e incidentes

**Fase:** SEG2 · **Data:** 2026-06-26
**Referência (runbook detalhado):** `docs/operacao/rollback.md`, `deploy-checklist.md`.

> Este doc **consolida** o plano de rollback para a SEG2 e adiciona o **fluxo de incidente**
> (comunicação + decisão). O runbook técnico passo-a-passo vive em `operacao/rollback.md`.

---

## 1. Rollback por camada

| Camada | Como reverter | Tempo |
|--------|---------------|-------|
| **Front (Vercel)** | Deployments → deploy estável anterior → *Promote to Production* (ou `vercel rollback`) | segundos |
| **Edge Function** | `git revert` do commit + `supabase functions deploy <fn>` (ou MCP). Reverter CORS = redeployar versão anterior | minutos |
| **Migration** | **Nunca** editar/apagar migration aplicada. Escrever migration nova de reversão (`NNNN_desfaz_X.sql`). Se apagou dado → restaurar do backup primeiro (doc 06) | minutos–horas |
| **Estado de escola/conta** | Suspender (`status='suspensa'`) ou regerar credencial — reversível, sem apagar dado | imediato |

**Regra de ouro:** migrations são **aditivas**; front e banco mantêm paridade ("migration
primeiro, front depois"). Nunca reverter o front para versão que dependa de schema anterior
ao que já está no banco.

---

## 2. Fluxo de incidente

1. **Detectar** — erro no console/produção, falha de login, dado errado, indisponibilidade.
2. **Classificar severidade:**
   - **P0** — indisponibilidade total / vazamento de dado → ação imediata.
   - **P1** — função crítica quebrada (login, provisionamento) → mesmo dia.
   - **P2/P3** — degradação parcial / cosmético → janela planejada.
3. **Conter** — rollback da camada afetada (seção 1) **antes** de investigar a fundo.
4. **Diagnosticar** — logs: Vercel (front), Supabase → Edge Functions → Logs (`console.error`),
   `admin_logs`/`logs_coordenacao`/`logs_acesso` (ações sensíveis).
5. **Corrigir** — fix + deploy + (idealmente) teste em staging quando existir.
6. **Comunicar** (ver seção 3) e **registrar** o incidente.

---

## 3. Comunicação

| Para | Quando | Quem | Canal |
|------|--------|------|-------|
| **Coordenação da escola** | indisponibilidade > 30 min ou dado afetado | dono | WhatsApp/e-mail direto |
| **Usuário final (aluno/resp.)** | só se afetar acesso/dado deles | via coordenação | a escola comunica |
| **Interno (registro)** | todo incidente P0/P1 | dono | este doc / issue |

- **Quem decide rollback:** o **dono** (decisor único hoje — dev solo).
- **Tempo máximo de resposta alvo:** P0 ≤ 1h para conter; P1 ≤ mesmo dia.

---

## 4. Checklist de incidente (copiar por ocorrência)
- [ ] Severidade classificada (P0/P1/P2/P3)
- [ ] Camada afetada identificada
- [ ] Contenção (rollback) aplicada
- [ ] Causa diagnosticada (logs anexados)
- [ ] Correção aplicada e verificada
- [ ] Backup verificado (se houve risco a dado) — doc 06
- [ ] Escola comunicada (se aplicável)
- [ ] Pós-morte curto registrado (o que evita reincidência)

## 5. Critério de aceite (SEG2)
> ✅ **Plano mínimo de rollback e incidentes definido**, consolidando o runbook técnico
> existente + fluxo de comunicação/decisão. Pronto para piloto controlado.
