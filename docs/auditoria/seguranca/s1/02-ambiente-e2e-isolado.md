# S1.2 — Ambiente E2E isolado

## Estado
O código já suporta E2E isolado desde a Fase 17.2
(`docs/operacao/e2e-ambiente.md`). A S1 **endureceu o comportamento**:
sem o projeto isolado, a E2E **não roda contra o demo** (antes rodava
com aviso). Agora o demo nunca é alvo de teste destrutivo, por
construção do workflow.

## Como ligar (passos de painel — exigem o dono)
1. Criar um **projeto Supabase de teste** (free, descartável). Região
   pode ser `us-east-1` (sem dado real).
2. Aplicar migrations + seeds nesse projeto (idempotentes); criar as
   contas de Auth de teste (seed 04 + `scripts`).
3. Adicionar os secrets no GitHub (Settings → Secrets → Actions):
   - `E2E_SUPABASE_URL`
   - `E2E_SUPABASE_ANON_KEY` (anon é pública por design)
4. Próximo CI: o job `e2e` deixa de ser "skipped" e roda isolado.

Detalhes operacionais completos: `docs/operacao/e2e-ambiente.md`.

## Garantia atual (sem o projeto isolado)
- O `e2e-guard` marca `isolado=false` e o job `e2e` é **pulado**.
- O banco de **demo** (`bdjkgrzfzoamchdpobbl`) **não é tocado** por
  nenhuma suíte de CI.
- O gate de PR (`build-e-unitarios`) roda contra um **Postgres vanilla
  efêmero** do próprio runner — isolamento total, sem rede externa.

## Conclusão
O isolamento está **garantido por padrão** (o demo nunca é poluído). A
execução positiva da E2E isolada continua pendente de um passo de painel
(criar projeto + secrets), que é decisão/execução do dono.
