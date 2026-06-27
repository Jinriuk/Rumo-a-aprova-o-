# AUDIT-ALL — Relatório Executivo

> Auditoria retrospectiva, **somente-leitura**, de todas as fases técnicas.
> Repositório: `Jinriuk/Rumo-a-aprova-o-` · branch de trabalho: `claude/audit-all-phases-d5qwqn` (a partir da `main`, tip `bffe3ba`).
> Projeto Supabase auditado: `bdjkgrzfzoamchdpobbl` · Vercel: `rumo-a-aprova-o`.
> Data: 2026-06-20.
>
> **Nada foi corrigido, migrado, deletado ou reescrito.** Apenas verificação, comparação e documentação.
> Regras de não-destruição (seção 3 do briefing) cumpridas integralmente.

---

## 0. Pergunta central

> *“Tudo que foi prometido nas fases anteriores foi realmente feito, está na `main`, está no Supabase/Vercel quando aplicável, passou nos testes e não quebrou segurança, RLS ou operação?”*

**Resposta curta:** **majoritariamente sim.** O produto está na `main`, a `main` é o default do GitHub e a Production Branch da Vercel, o banco remoto tem o schema das fases aplicado, o motor C0 está vivo (964 eventos), a base de vitrine está coerente (60 alunos, Lucas preservado, sem órfãos), o superadmin D0 está operacional, e **não há advisor de segurança de nível ERROR nem `service_role` no front**.

**Porém, há duas verdades incômodas que os relatórios anteriores suavizaram:**

1. **O workflow de CI nunca ficou verde de ponta a ponta.** Os 30 runs mais recentes são *failure* (26) ou *cancelled* (4). O job de testes unitários/RLS (`build-e-unitarios`) **passou a ficar verde a partir do merge da D0** (run #112, 211 testes), mas o job **`e2e` é cancelado por timeout (25 min) em todo run, incluindo o último na `main`** — ou seja, **a suíte E2E Playwright nunca passou no CI**, apesar de ter sido repetidamente citada como a “rede de segurança” que justificava não rodar testes manuais/E2E nas fases. **Inconsistência relatório × realidade (P1).**
2. **O banco continua em `us-east-1`, não `sa-east-1`.** É a pendência LGPD de residência de dado de menor, conhecida desde a Fase A e **ainda aberta** — bloqueia dado real de aluno menor (P1).

Nenhum P0 aberto. Detalhes em `13-riscos-pendencias-proximos-passos.md`.

---

## 1. Tabela de status por fase

| Fase | Status | Evidência principal | Pendências | Severidade máx. |
|---|---|---|---|---|
| **14.5** QA/estabilização | **Aprovada** | build verde (reproduzido nesta sessão, 5.99s); suíte de testes existe; `docs/fases/08-fase-14-5-encerramento.md` | Verde de CI ponta-a-ponta não comprovado (E2E) | P2 |
| **15** Núcleo pedagógico | **Aprovada com ressalvas** | migrations 0007–0015; tabelas povoadas (6 concursos, 5 provas, 9 matérias, 11 assuntos, 22 subassuntos, 8 missões, 8 patentes, 13 conquistas); ligada ao runtime via C0.5 | `aluno_niveis`/`aluno_onboarding`/`aluno_nivel_historico` vazias; `aluno_xp_eventos` (XP 15.5) substituída pelo ledger C0 | P3 |
| **A** Segurança/logs/obs | **Aprovada com ressalvas** | `erros.js`, `observabilidade.js`, `ErroFronteira.jsx`, `logs_coordenacao` (88 linhas no remoto), Edge Functions sem `detail` cru, sem `service_role` no front | região `us-east-1` (LGPD), backup não confirmado, leaked-password off, rate-limit só padrão | **P1** |
| **B-min** Performance | **Aprovada** | `paginacao.js`, `concorrencia.js`, 4 índices 0023 aplicados no remoto, `resumo_escola()` | índices ainda “unused” (volume baixo); carga 300–500 não medida em prod | P2 |
| **C0** Motor XP/ledger | **Aprovada** | `aluno_eventos_progresso` (964), 4 triggers presentes, `vw_aluno_xp_total`, idempotência, Lucas=1400 XP, XP não confiado do front | divergência de rótulo de migration no remoto | P2 |
| **C0.5** Auditoria 15 + base demo | **Aprovada** | 60 alunos/5 turmas na vitrine, 0 órfãos, 0 sem concurso, eventos via motor, Lucas preservado | um ajuste manual (Manuela cm→espcex) documentado | P3 |
| **R** Branches/main/Vercel | **Aprovada com ressalvas** | default = `main` ✓; Vercel Production Branch = `main` ✓; 4 branches mergeadas deletadas | `naval-system-build` (1 commit redundante) e `demo-base-realista` (8 commits, 2 refactors 16.8 não confirmados) ainda existem | P3 |
| **C1A/B/C/D** Demo/UX/30 pontos | **Aprovada com ressalvas** | relatórios + seeds 14/15/16 aplicados em prod; Lucas q7d corrigido; nomes fictícios; 27/30 corrigidos, 3 adiados | E2E/mobile não validados; deploy do merge C1B (#12) deu ERROR (depois corrigido) | P2 |
| **D0** Backoffice | **Aprovada com ressalvas** | migration 0025 aplicada; Edge `backoffice-coordenador` deployada (jwt✓); RPCs; `/admin-interno` com gate; superadmin registrado, **com senha e já logado** | `admin_logs` = 0 (nenhuma ação real registrada); suspensão é só status (sem bloqueio global de login); validação manual pendente | P2 |
| **Reconciliação D0/Supabase** | **Aprovada** | 0025 no remoto; Edge deployada; RPCs OK; superadmin `last_sign_in` 2026-06-20 17:03; advisors sem ERROR novo | a “pendência de senha do superadmin” do relatório D0 **já está resolvida** (divergência relatório × realidade, a favor) | P2 |

Definições de status seguem o briefing: Aprovada / Aprovada com ressalvas / Parcial / Inconsistente / Reprovada. **Nenhuma fase foi marcada Inconsistente ou Reprovada** — as promessas de produto se confirmaram no código e no ambiente. As ressalvas são de **operação/verificação** (CI/E2E, LGPD, backoffice não exercitado), não de funcionalidade ausente.

---

## 2. Inconsistências relatório × realidade (as que importam)

| # | Relatório dizia | Realidade observada | Classificação |
|---|---|---|---|
| 1 | “build verde / CI verde” (várias fases) | **Build** verde ✓, mas o **workflow** de CI nunca fechou verde; **E2E nunca passou** (cancelado por timeout em todo run, inclusive `main` #112) | **P1** — rede de segurança inexistente |
| 2 | D0: “pendência operacional de senha do superadmin” | Superadmin **tem senha e já logou** (`last_sign_in` 2026-06-20 17:03) | Divergência **a favor** — pendência fechada |
| 3 | D0: “CI de testes voltou ao verde” | Verdadeiro **no nível do job** `build-e-unitarios` (#112 success, 211 testes); mas o run inteiro é *cancelled* por causa do E2E | Parcialmente verdadeiro |
| 4 | C0.5: motor “ligado ao runtime por exam_tag” | Confirmado: 0 alunos sem concurso, `trilha_planos` cobrindo 5 exam_tags | Confirmado ✓ |
| 5 | Fase A.8: auditoria de coordenação | `logs_coordenacao` existe e tem **88 linhas** no remoto — ativa | Confirmado ✓ |

---

## 3. Evidência de ambiente (resumo)

- **Supabase** (`bdjkgrzfzoamchdpobbl`, Postgres 17, **us-east-1**): 24 migrations aplicadas; 5 Edge Functions ACTIVE; **0 advisor de segurança ERROR**; RLS habilitada em todas as tabelas públicas; 60+3 alunos em 2 escolas; ledger C0 com 964 eventos. Detalhe em `10-supabase.md`.
- **Vercel** (`rumo-a-aprova-o`): Production Branch = `main`; último deploy de produção = `bffe3ba` (merge D0) **READY**; um deploy intermediário (merge C1B #12) ficou **ERROR** e foi corrigido no merge seguinte. Detalhe em `11-vercel.md`.
- **GitHub/CI**: default = `main`; 3 branches vivas (`main`, `naval-system-build`, `demo-base-realista`); **0/30 runs de CI verdes** no histórico recente; job de unitários verde desde a D0; E2E sempre cancelado. Detalhe em `12-github-ci.md`.

---

## 4. Testes executados nesta auditoria

| Teste | Resultado | Observação |
|---|---|---|
| `npm run build` (app) | ✅ **verde** | 5.99s; aviso de chunk >500 kB preexistente/cosmético |
| Testes de lógica pura (`node --test`, 12 suítes sem DB) | ✅ **82/82** | 8 “falhas” são `ECONNREFUSED:54322` em `motor.test.mjs` (testes de banco, sem Postgres neste ambiente) — ambiental, não regressão |
| Testes DB/RLS (`*-db.test.mjs`) | ⚠️ **não executável aqui** | sem Postgres/Supabase local; **verde no CI #112** (job `build-e-unitarios` = success, 211 testes) |
| E2E Playwright | ⚠️ **não executável aqui** e **nunca verde no CI** | Chromium/allowlist no ambiente; no CI é cancelado por timeout |
| Smoke superadmin | ✅ indireto | `internal_admins` ativo, senha definida, `last_sign_in` real |
| Smoke aluno/coordenação/responsável | ⚠️ não executado | sem browser; dados de suporte coerentes no banco |

---

## 5. Veredito e próxima fase

**Fotografia confiável:** o sistema está **apto a um piloto controlado** e a demo é credível, **condicionado** a fechar os dois P1 (residência de dado em `sa-east-1` + tornar a verificação E2E/CI real) antes de **dado real de aluno menor**.

**Próxima fase recomendada: `S1 — segurança e operação técnica.`** Justificativa em `13-riscos-pendencias-proximos-passos.md` §4. Em resumo: os itens mais sensíveis abertos são todos de segurança/operação — região LGPD (P1), CI/E2E como rede de segurança real (P1), endurecimento dos advisors `SECURITY DEFINER`/`search_path`/leaked-password (P2) e bloqueio global por escola suspensa (P2). `DB1` (consolidar a divergência de ledger de migrations + FKs sem índice + políticas permissivas duplicadas) é o segundo candidato, sem urgência. Recomenda-se um **patch curto pré-S1** para (a) destravar/quarentenar o job E2E no CI e (b) executar a validação manual da D0 em produção.

---

## 6. Índice dos relatórios

| Arquivo | Conteúdo |
|---|---|
| `00-relatorio-executivo-audit-all.md` | este documento |
| `01-fase-145.md` | QA/estabilização/testes/base |
| `02-fase-15.md` | núcleo pedagógico, exam_tag, trilhas/missões/patentes/conquistas/simulados |
| `03-fase-a.md` | segurança, logs, erros, observabilidade, auditoria |
| `04-fase-b-min.md` | performance, paginação, concorrência, memoização, índices |
| `05-fase-c0.md` | motor real de progresso/XP/ledger |
| `06-fase-c05.md` | auditoria da Fase 15, ligação ao runtime, base demo |
| `07-fase-r.md` | branches, `main`, Vercel |
| `08-c1a-c1b-c1c-c1d.md` | credibilidade, UX, polimento, 30 pontos |
| `09-d0-backoffice.md` | backoffice interno / superoperador |
| `10-supabase.md` | migrations, tabelas, RLS, RPCs, Edge Functions, advisors |
| `11-vercel.md` | produção, branch, deploys, domínios |
| `12-github-ci.md` | branches, PRs, CI, testes pulados, “verde falso” |
| `13-riscos-pendencias-proximos-passos.md` | P0–P3, destino (patch/S1/DB1/D1/I1), próxima fase |
