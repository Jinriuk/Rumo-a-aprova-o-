# EST1-B — Estabilização: operação observável + endurecimento de backoffice

**Data:** 2026-07-14 · **Base:** `main` = `b98f95c` (pós-EST1-A / PR #67)
**Branch:** `claude/system-analysis-stabilization-mif9b2`
**Escopo:** a parte de **código** do bloco EST1-B do plano EST0 — o que é
responsabilidade de desenvolvimento. A parte de **configuração de infra** (contas
externas, plano Pro, SMTP, região) fica no handoff ao final, com o passo exato.

## Resultado

**3 correções de código entregues, cada uma com teste e commit próprio.** Suíte
**496 → 509 verdes** (+13 testes), migrations + seed 2× (idempotência), build de
produção verde. Nada pulado, nada regredido.

| # | Item | Commit | Migration | Testes |
|---|------|--------|-----------|--------|
| B1 | `backoffice-coordenador` resolve por cache indexado (não varre 1000 do Auth) | `4c56e51` | `0041` | +4 |
| B2 | Higiene do advisor: policies duplicadas + índices de FK | `1bf026f` | `0042` | +4 |
| B3 | Função de saúde da virada (lê o heartbeat de A2) | `4c1ef18` | `0043` | +5 |

---

## B1 · `backoffice-coordenador` sem varredura de 1000 do Auth (fecha EST0 SEGURANCA-01 / A8)

**Problema (confirmado):** a função resolvia o coordenador existente com
`listUsers({perPage:1000})` + `.find()` sobre a **única** página. Como todo aluno
e responsável é `auth.users`, o projeto passa de 1000 contas com 1–2 escolas
reais; um coordenador fora da página 1 caía no `createUser`, o GoTrue rejeitava a
duplicidade e a função devolvia um **500 enganoso**, bloqueando o re-vínculo.

**Correção:** resolve pelo cache indexado `usuarios.email` (índice `0041`, O(1)).
No estado parcial raro (conta Auth sem linha `usuarios`), pagina o Auth **até
achar** (teto defensivo de 50 páginas), sem parar em 1000 nem devolver o 500.

**Prova:** `tests/est1-backoffice-coordenador-fonte.test.mjs` (inspeção de fonte,
padrão do CI sem Deno): o anti-padrão não pode voltar, resolução por cache,
paginação real.

## B2 · Higiene do advisor (fecha os apontamentos medidos em 14/07)

**WARN policies permissivas duplicadas em `aluno_missoes`:** a policy da
coordenação (`FOR ALL`) duplicava o SELECT com a `_select`. A 0029 tinha zerado
esse padrão; a 0033 (PED1) o reintroduziu. Consolidação (`0042`): a coordenação
passa a ter policies só de **escrita** (ins/upd/del); o SELECT fica com a única
`aluno_missoes_select`. Comportamento idêntico.

**INFO FKs sem índice:** índices de cobertura para as 12 FKs de tabelas que
**crescem por tenant** e são filtradas/juntadas pela FK (ledger, missões,
conquistas, alunos, meta/metas). Deixadas de fora **de propósito**: FKs de
conteúdo global minúsculo e da tabela **deprecada** `aluno_xp_eventos` — evita
índice ocioso que o próprio advisor depois marca "unused".

**Prova:** `tests/est1-higiene-advisor-db.test.mjs` — uma única policy de SELECT,
leitura da coordenação preservada, aluno segue barrado, 12 índices presentes.

## B3 · Saúde da virada — a metade de código do alerta (fecha o lado de código de EST0 A5/A15)

**Problema:** o `pg_cron` da virada rodava às cegas — nenhum sinal se falhasse.
O A2 (`0039`) já instalou o **heartbeat** (`virada_execucoes`). Faltava a leitura.

**Correção (`0043`):** `app.virada_saude(janela=26h)` responde se a última virada
**global** rodou dentro da janela e sem alunos com erro, devolvendo
`ok + diagnóstico` (última execução, horas desde, metas geradas, alunos com erro,
motivo). Um monitor (Edge agendada / uptime externo / cron) chama e dispara o
alerta quando `ok=false`. Porta `public.backoffice_virada_saude()` gateada por
`eh_super_admin` para o painel do operador.

**Prova:** `tests/est1-virada-saude-db.test.mjs` — heartbeat vazio, saudável, com
erro, atrasada, e a porta do backoffice com gate.

---

## Handoff — o que falta configurar (é seu, não é código)

O código de EST1-B está pronto; estes itens são **configuração de infra/contas**
que só você pode fazer. Cada um está a poucos cliques:

| # | Configuração | Onde | Liga o quê |
|---|--------------|------|-----------|
| 1 | **`VITE_ERROR_REPORT_URL`** = URL de um coletor (Sentry ingest ou Edge própria) | Vercel → env de produção (placeholder já documentado em `app/.env.production`) | Faz o erro do front sair do console e chegar a um destino monitorado (EST0 A4). O gancho já está no código. |
| 2 | **Agendar `app.virada_saude()`** e disparar alerta quando `ok=false` | Uma Edge Function chamada por `pg_cron` (~08:00, após a virada das 00:05), ou um monitor externo que faça a RPC; o alerta pode ir a e-mail/WhatsApp/Slack | Fecha o alerta da virada (EST0 A5) — a função de leitura já existe (B3). |
| 3 | **Alerta de uptime** do front (Vercel) e do banco (Supabase) | Serviço de uptime (UptimeRobot/BetterStack) → e-mail/telefone do operador | EST0 A15 (uptime). Puramente externo. |
| 4 | **SMTP com domínio do piloto** | Supabase Auth → SMTP | P0-1 do piloto; destrava recuperação de senha real e os e-mails de coordenador. |
| 5 | **Projeto Supabase Pro em `sa-east-1` + backup com restore testado**, separado da demo | Supabase (novo projeto) | EST0 A6/A10 e OPS1 — o bloqueio de "dado real de menor". O projeto `ops1-r1-restore-test-descartavel` (03/07) indica que o teste de restore já começou; formalize o runbook. |

> As migrations `0038`–`0043` precisam ser aplicadas no projeto de produção
> quando ele existir (o reset-db local já prova que aplicam limpas e idempotentes,
> 2×). No projeto demo atual, aplicar via `supabase db push` ou pelo fluxo de
> migrations do painel.

## O que continua fora do escopo de código (próximos blocos)

- **EST1-C (SEC3b):** credencial opaca do aluno, rate limit no login por código,
  MFA de super_admin — envolve o proxy de login desenhado + config do projeto Pro.
- **PED3 / JUR1 / PR1 / GTM1:** conteúdo, jurídico, piloto, comercial — como no EST0.

## Como verificar

```bash
cd tests && bash reset-db.sh && npm test   # 509/509
cd ../app && npm run build                  # verde
```
