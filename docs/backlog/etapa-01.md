# Backlog — Etapa 1 (Comando, foco, governança e fonte da verdade)

**Atualizado em:** 02/09/2026 (revisão 4 — P2 do PR #84 resolvidos e PR #85 aberto)

---

## BKL-002: Nenhum commit de produto nos últimos 14 dias

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Alta
- **Prazo:** até o merge do PR #84
- **Estado:** revisão (aguardando merge, sem bloqueio conhecido)
- **Critério de aceite:** decisão registrada sobre a causa da pausa; e decisão sobre a branch órfã (BKL-005) antes de fechar.
- **Evidência:** explicado pela pausa de planejamento. Fecha quando BKL-005 fechar (PR #84 mergeado ou explicitamente descartado). Os 2 P2 que travavam o PR #84 foram corrigidos (commit `7d3fd54`) e os threads resolvidos — nada mais pendente do lado de revisão.

---

## BKL-005: Branches pendentes, analisadas uma a uma

- **Frente:** engenharia
- **Responsável:** técnico (Opus, conforme papel do plano) + Gabriel (decisão de merge)
- **Prioridade:** Alta (trava a leitura do BKL-002)
- **Prazo:** —
- **Estado:** revisão
- **Critério de aceite:** cada branch remota tem destino definido (merge, fechamento ou justificativa para continuar aberta).

| Branch | Status verificado em 02/09 (atualizado) | Recomendação |
|---|---|---|
| `claude/jornada-transformadora-uxg2-r2-806vu0` | PR #84 aberto contra `main`. 579/579 testes, sem conflito de merge. **Os 2 P2 do Codex bot foram corrigidos e os threads resolvidos** (commit `7d3fd54`: condição de corrida ao trocar de objetivo — `alvoConfirmacaoRef` valida o alvo antes de marcar concluído; erro de hook vazando entre objetivos — `fecharObjetivo.setErro(null)` nos 4 pontos de reset). CI verde. | mergear |
| `claude/uxg2-jornada-migration-0045-nskdek` | PR #85 aberto contra `main`. Migration 0045 idêntica ao aplicado no banco de teste, idempotência confirmada, `list_migrations` remoto bate 1:1 com o repositório. | mergear |
| `dependabot/github_actions/actions/setup-node-7` | PR #73, aberto desde 20/07, CI verde, mas com base bem antiga (`18b9f65`) — precisa reavaliar mergeabilidade contra o `main` atual antes de mergear. | mergear se ainda limpo, risco baixo |
| `dependabot/npm_and_yarn/app/app-deps-a4a15aa221` | PR #81, aberto, CI verde. | mergear, risco baixo |
| `dependabot/npm_and_yarn/tests/tests-deps-e4eef21ccf` | PR #76, aberto, CI verde. | mergear, risco baixo |

---

## BKL-007: Congelamento de funcionalidades (Princípio 4)

- **Frente:** revisão
- **Responsável:** Gabriel
- **Prioridade:** Alta
- **Prazo:** vigente até revisão explícita
- **Estado:** validado
- **Decisão (ver ADR-0004):** até revisão em contrário, só entra trabalho de engenharia que resolva (1) os cinco P1 da auditoria de 25/08, (2) a migration 0045 (`rls_auto_enable`, BKL-004), (3) a decisão sobre a branch `uxg2-r2` (BKL-005). Nenhuma funcionalidade nova além disso.

---

## BKL-008: Separar decisões "agora" / "antes do G3" / "depois do piloto"

- **Frente:** revisão
- **Responsável:** Gabriel
- **Prioridade:** Média
- **Estado:** validado
- **O que isso é, exatamente:** não é uma classificação das 14 etapas do plano (essas continuam rodando em paralelo, sem exceção) nem das funcionalidades do sistema como um todo. É uma classificação de cada **bloqueador concreto** (os P1-P4 da auditoria + os itens deste backlog) por quando ele precisa ser resolvido:
  - **Agora:** não bloqueia nada, mas precisa acontecer já (governança, prospecção, itens deste backlog).
  - **Antes do G3:** bloqueia a entrada do primeiro aluno real, não bloqueia vender ou demonstrar.
  - **Depois do piloto:** dívida técnica ou polimento, não impede nem vender nem pilotar.
- **Classificação:**
  - **Agora:** BKL-002/005 (branch e commit), BKL-004 parte de migration, BKL-007/009/010/012/013 (governança), BKL-011 (calendário, parcial), prospecção comercial (Etapa 3, nunca para).
  - **Antes do G3:** os cinco P1 da auditoria (e-mail de coordenação, produção separada, backup/restore/E2E, pacote LGPD de menores, conteúdo/coorte sustentável) e os P2 (colunas de escola, credencial opaca, geração de meta transacional, logs/observabilidade, exportação LGPD, MFA).
  - **Depois do piloto:** os P3 (FKs compostas por tenant, dívida de cobertura/lint/types, componentes grandes) e P4 (domínio próprio, white-label completo, polimento de UI).

---

## BKL-009: Registro de commit em demo, staging e produção

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** concluído
- **Registro (02/09/2026):**
  - **Demo/Vitrine:** projeto `bdjkgrzfzoamchdpobbl`, branch `main`, commit `cd75cc5`.
  - **Staging:** não existe hoje. Candidato natural: o próprio `bdjkgrzfzoamchdpobbl`, reaproveitado como staging/teste depois que a produção nova existir (ver ADR-0001, atualizado).
  - **Produção:** não existe ainda. Organização `eerbpzacxolwlwsltynb` criada e reservada, mas sem nenhum projeto Supabase dentro dela até 02/09.

---

## BKL-010: Nível mínimo de acesso do Leandro

- **Frente:** comercial
- **Responsável:** Gabriel
- **Prioridade:** Média
- **Estado:** concluído
- **Decisão:** por enquanto, acesso zero (bloqueado) até o repasse acontecer. Quando repassado, o nível será: CRM, conta demo/apresentação, arquivos de apresentação e materiais de prospecção. Sem acesso a Supabase, GitHub ou qualquer ambiente técnico.

---

## BKL-011: Calendário semanal fixo e blocos sem concorrência com GrinderBank

- **Frente:** revisão
- **Responsável:** Gabriel
- **Prioridade:** Média
- **Prazo:** 05/09/2026
- **Estado:** pendente (parcialmente resolvido)
- **Resolvido:** GrinderBank não recebe nenhum bloco de tempo por enquanto, até Gabriel fechar as bases necessárias do Rumo. Isso satisfaz a parte "sem concorrência com GrinderBank".
- **Ainda em aberto:** a cadência fixa em si (quais dias/horários para engenharia, comercial e revisão) não foi definida.

---

## BKL-012: Planilha de gastos e caixa do produto

- **Frente:** revisão
- **Responsável:** Gabriel
- **Prioridade:** Média
- **Estado:** concluído
- **Evidência:** `Controle_Caixa_Produto.xlsx` recebido, com abas Resumo e Movimentações (data, tipo, categoria, descrição, status, recorrência, valor, forma de pagamento, próxima cobrança).
- **Resíduo (não bloqueante):** várias datas e formas de pagamento ainda estão em branco (marcadas como pendentes na própria planilha); nenhuma entrada de receita registrada ainda, o que é esperado sem contrato fechado.

---

## BKL-013: Regra de carga simultânea

- **Frente:** revisão
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** validado
- **Decisão:** no máximo 3 itens em `em execução` por frente ao mesmo tempo (não 3 no total, ver nota no índice).
