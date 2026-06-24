# Fase A — Segurança, logs, erros, observabilidade e auditoria

## 7.1 Promessa da fase
Tornar o sistema operável por uma escola real: erro técnico nunca chega à tela, error boundary, observabilidade mínima, auditoria de ações de coordenação (`logs_coordenacao`), RLS revisada sem enfraquecimento, sem `service_role` no front, e documentação operacional.

## 7.2 Evidência no código
- `app/src/shared/lib/erros.js` (`mensagemAmigavel`), `observabilidade.js` (`instalarCapturaGlobal`), `app/src/shared/ui/ErroFronteira.jsx`.
- `app/src/main.jsx` instala captura global + error boundary.
- `supabase/migrations/0022_logs_coordenacao.sql` (tabela + RLS por tenant).
- `registrarLogCoordenacao` em `data/index.js`, chamado em criar/renomear/remover turma, cadastrar alunos, atualizar marca.
- Edge Functions sem campo `detail` cru na resposta de erro.
- Docs: `docs/operacao/{operacao,rollback,backup-retencao-lgpd,checklist-go-live-piloto,ambientes-e-variaveis}.md`.
- `tests/logs-coordenacao-db.test.mjs`; `logs_coordenacao` incluída em `isolamento.test.mjs`.

## 7.3 Evidência no ambiente
- `logs_coordenacao` no remoto: **existe, RLS habilitada, 88 linhas** → a auditoria de coordenação **está ativa** (não é só schema). Confirma a aplicação de `0022_logs_coordenacao` no remoto (reconciliada na C0.5).
- `logs_acesso`: 915 linhas (rastro de provisionamento/acesso).
- **Sem `service_role` no front:** confirmado por busca — as 2 ocorrências em `app/` são **comentários** afirmando que a chave NÃO é usada (vive só na Edge Function).
- Advisor de segurança: **0 ERROR**. WARNs relevantes a esta fase: leaked-password protection **desabilitada**; rate-limit do login = só o padrão do Supabase Auth.

## 7.4 O que foi realmente entregue
Tradução de erro técnico, error boundary, captura global, auditoria de coordenação ativa no remoto, Edge Functions sem vazamento de detalhe técnico no corpo HTTP, e documentação operacional completa. RLS não enfraquecida (nenhum advisor ERROR; isolamento coberto por teste).

## 7.5 O que não foi entregue
- **Região do banco em `sa-east-1`** — continua em `us-east-1`. Era P1 conhecido na própria Fase A; **segue aberto**.
- **Backup automático confirmado** — sem evidência verificável via MCP de que foi confirmado para o plano em uso.
- **Leaked-password protection** — desabilitada no Auth (advisor WARN); a Fase A documentou postura de login mas este toggle não foi ligado.

## 7.6 Divergências
- O relatório da Fase A lista os dois P1 (região + backup) como “decisões de infra, fora do escopo de código” — corretamente. A auditoria confirma que **ambos seguem abertos** no ambiente real hoje.

## 7.7 Riscos
- **P1** — Banco em `us-east-1` (não `sa-east-1`): bloqueia dado real de menor (LGPD/residência).
- **P1** — Backup automático não confirmado.
- **P2** — Leaked-password protection desabilitada (Supabase Auth).
- **P2** — Rate-limit do login só o padrão do Auth (sem proteção customizada).
- **P3** — `Turmas.renomear/excluir` via `window.prompt/confirm` sem trava de “ocupado” (herdado).

## 7.8 Decisão da fase
**Aprovada com ressalvas.** O trabalho de código (erros/observabilidade/auditoria) foi entregue e está ativo no remoto. As ressalvas são as pendências de **infra/operação** (região, backup, leaked-password, rate-limit) — todas materiais para operar dado real e endereçáveis em S1.
