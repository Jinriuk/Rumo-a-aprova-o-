# Auditoria — Persona 11: DEVOPS / INFRA / OBSERVABILIDADE

> Auditoria por especialista em infra/deploy/monitoramento (Vercel, Supabase, ambientes,
> backups, logs). Base: `vercel.json`, `supabase/config.toml`, `.github/workflows/ci.yml`,
> `tests/reset-db.sh`, `app/.env.production`, README.

---

## 1. Nota geral de maturidade da área: **58/100**

O caminho feliz está montado: front estático na Vercel (SPA com rewrite), backend Supabase,
CI que builda, testa contra Postgres real e roda E2E com artefatos. As regras de migrations
são organizadas e a virada é agendada no banco. Mas a operação ainda é frágil: sem
observabilidade (logs estruturados/alertas/monitoramento), sem rollback de migrations, sem
ambiente E2E próprio, região Brasil é intenção (não imposta por config) e backups/retenção
não estão documentados. É a área mais distante de "fechada".

## 2. O que está forte

- **Deploy de front simples e correto.** `vercel.json`: build do app, output `app/dist`,
  rewrite SPA `/(.*) → /index.html`. Só chaves públicas no build (`app/.env.production`).
- **CI cobre o essencial.** Build de produção + 145 unitários contra Postgres 15 real, com
  `reset-db.sh` exercitando idempotência (seed 2x); E2E em job separado com Chromium,
  artefatos de falha (relatório, screenshots, traces) e retenção de 14 dias.
- **Virada agendada no banco** (`pg_cron`, `0004`) às 03:05 UTC = 00:05 BRT, idempotente e
  independente de o app estar aberto — operacionalmente robusto.
- **Migrations ordenadas e aditivas** (0001→0015), aplicáveis por `supabase db push`/SQL, com
  caminho de reset reproduzível para teste.
- **Separação de segredo correta:** `service_role` só no servidor; CI não precisa de secret.

## 3. O que está fraco

- **Sem observabilidade.** Não há logging estruturado, métricas, tracing nem error tracking
  (Sentry/Datadog). Em produção, um incidente numa escola é diagnosticado "no escuro" (só
  logs da UI do Supabase). Para operar B2B, é lacuna séria.
- **Sem rollback de migrations.** Só forward; não há scripts de downgrade nem procedimento
  documentado. Front novo + migration nova sem gate = risco de "front novo, banco velho".
- **Ambientes não formalizados.** Existem prod, demo e o Postgres local de teste, mas não há
  separação explícita em config nem um ambiente E2E efêmero — o E2E usa o demo compartilhado.
- **Região Brasil não imposta.** `sa-east-1` é intenção do README/comentários, não flag de
  config; depende de quem provisiona o projeto Supabase fazer certo (relevante p/ LGPD).
- **Backups/retenção não documentados** no repo (dependem do plano Supabase; sem restore drill).
- **Sem health check/uptime** nem alertas (ex.: falha da virada agendada passa despercebida).

## 4. O que está confuso

- **Qual projeto Supabase é prod vs. demo** não está claro no repo (chaves de demo em
  `.env.production`); risco de apontar o ambiente errado.
- **Estratégia de promoção** (dev → demo → prod) não documentada.

## 5. O que pode quebrar com uso real

- **Migration quebrada em prod sem rollback** = downtime e recuperação manual.
- **Falha silenciosa da virada** (cron) sem alerta = metas não geradas, percebido só pelo aluno.
- **Front novo com banco antigo** (deploy fora de ordem) sem gate de versão.
- **Demo compartilhado** interferindo no E2E/dev.

## 6. Problemas críticos

- **Ausência de observabilidade e de plano de rollback** — para um sistema com dados de
  menores em produção, não saber que algo quebrou e não conseguir voltar atrás é o ponto mais
  grave da operação.

## 7. Problemas importantes

1. Observabilidade (logs estruturados + métricas + error tracking + alertas).
2. Rollback de migrations + gate de versão front↔banco.
3. Ambiente E2E efêmero e separação formal de ambientes.
4. Região Brasil garantida + backups/retenção documentados e testados.

## 8. Melhorias desejáveis

- Health check + monitor de uptime; alerta se a virada não rodar.
- Pipeline de promoção dev→demo→prod com aprovação.
- Custos monitorados (Supabase/Vercel) por ambiente.

## 9. O que não precisa mexer

- `vercel.json` (SPA) e a estratégia de chaves públicas no front.
- Estrutura do CI (build + unitários + E2E com artefatos).
- Virada agendada no banco.
- Migrations aditivas ordenadas.

## 10. O que falta para considerar fechado (infra)

1. Observabilidade real (logs/métricas/alertas/error tracking).
2. Rollback de migrations + gate de versão.
3. Ambientes separados formalmente + E2E efêmero.
4. Região Brasil imposta, backup/retenção documentados e com restore testado.

## 11. Plano de infraestrutura mínima para sistema fechado

| Camada | Mínimo para fechar |
|--------|--------------------|
| Observabilidade | Error tracking (Sentry) no front e nas Edge Functions; logs estruturados; alerta de falha da virada |
| Deploy/DB | Procedimento de rollback documentado + ao menos migrations reversíveis nas críticas; gate de versão front↔banco |
| Ambientes | prod / staging(demo) / e2e efêmero separados e documentados; promoção com aprovação |
| Dados | Região `sa-east-1` confirmada; backup automático + restore drill periódico; política de retenção LGPD escrita |
| Disponibilidade | Health check + uptime monitor; alerta de cron |
| Custo | Acompanhamento de custo por ambiente |

## 12. Veredito final

**Não aprovado (ainda) para operação de produção.** O básico de deploy e CI está bom, e a
fundação (virada agendada, migrations ordenadas, segredo isolado) é sólida. Mas operar um SaaS
com dados de menores exige observabilidade, rollback e backups testados — e esses ainda não
existem. É a área que mais separa "protótipo bem-feito" de "produto operável". Com o plano
mínimo acima, a área sobe para a faixa de 82.
