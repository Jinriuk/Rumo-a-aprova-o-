# SEG2 / S2-A — Leitura e consolidação da SEG1 + plano da SEG2

**Fase:** SEG2 — Segurança de Produção e Infraestrutura Real
**Data:** 2026-06-26
**Branch:** `claude/seg2-production-security-u3bi2d`
**Base:** `main` pós-SEG1 (`ddd1377`, PR #36 mergeada — confirmado via `git log` e GitHub API)
**Projeto Supabase:** `bdjkgrzfzoamchdpobbl` (us-east-1, plano **Free**) · **Repositório:** `Jinriuk/Rumo-a-aprova-o-` (público)

> Observação de branch: o nome pedido no enunciado era
> `claude/seg2-seguranca-producao-infra-real`. A sessão foi iniciada na branch
> `claude/seg2-production-security-u3bi2d` (designada pelo ambiente de execução).
> Todo o trabalho da SEG2 vive nessa branch — apenas o nome difere.

---

## 1. Confirmação: SEG1 está na `main`

- `git log --oneline` mostra `a054861 SEG1: segurança operacional imediata` +
  merge `ddd1377 Merge pull request #36 … seg1-operational-security`.
- GitHub API confirma `default_branch: main`, `pushed_at: 2026-06-25`.
- Os 13 documentos da SEG1 estão em `docs/auditoria/seg1/` e foram **todos lidos**
  antes de qualquer ação desta fase (regra 3 do enunciado).

---

## 2. Resumo dos achados da SEG1

A SEG1 ("seguro para demo controlada") concluiu, com evidência técnica:

| Tema | Resultado SEG1 |
|------|----------------|
| P0 / P1 | **0 / 0** |
| `service_role` no front | **Ausente** (`git grep` + teste de CI que falha se aparecer) |
| RLS | **Ativa em 45/45 tabelas**; 341 testes verdes (Postgres real) |
| Superadmin / rotas sensíveis | Gate `eh_super_admin()` **no banco** em todas as RPCs/Edge Functions |
| Edge Functions | 6 deployadas/ACTIVE; auth por token + papel + `escola_id`; **CORS curinga `*`** |
| Headers de segurança | 6 headers (CSP+HSTS+XFO+XCTO+Referrer+Permissions) aplicados no `vercel.json` |
| Logs de auditoria | `admin_logs`, `logs_coordenacao`, `logs_acesso` — com RLS, autor não-forjável |
| Repositório | **Público** (intencional/documentado); só anon key versionada |
| Branch protection | **Ausente** na `main` (verificado) |
| Scanners externos | **Não executados** (egresso de rede bloqueado) — checklists |

**Veredito SEG1:** aprovada, sem P0/P1, liberada para SEG2 e QA2.

---

## 3. Pendências herdadas pela SEG2 (da seção 4 do relatório SEG1)

| ID | Sev | Pendência | Onde trato na SEG2 |
|----|-----|-----------|--------------------|
| D-1 | P2 | Ativar Leaked Password Protection | `01-leaked-password-protection.md` |
| A-1/B-1 | P2 | Credenciais de demo públicas → projeto separado/rotação | `08-separacao-demo-usuarios-reais.md` |
| E-1 | P2 | Estreitar CORS curinga `*` → allowlist | `03-cors-allowlist-edge-functions.md` ✅ feito em código |
| J-1 | P2 | Branch protection na `main` | `02-github-branch-protection-security.md` |
| H-2 | Manual | Confirmar nota SecurityHeaders + smoke CSP pós-deploy | `04-security-headers-mdn.md` + `05-…scanners` |
| D-2 | Manual | Confirmar Site URL / Redirect URLs | `09-smtp-site-redirect-urls.md` |
| J-3 | Manual | Secret scanning + Dependabot + CodeQL | `02-…` ✅ CodeQL+Dependabot adicionados |
| J-4 | P3 | Apagar branch antiga stale | `02-…` (checklist) |
| K-2 | P3 | Retenção/rotação de logs | `13-lgpd-operacional.md` |
| — | SEG2 | Backups/restore, staging, domínio, SMTP, sa-east-1 | docs `06`,`07`,`09`,`10`,`13` |

---

## 4. O que a SEG2 corrige **em código** (entregue nesta branch)

1. **CORS allowlist (E-1):** as 6 Edge Functions deixaram de usar `Access-Control-Allow-Origin: *`
   e passaram a refletir o Origin **só** quando ele está na allowlist
   (`_shared/cors.ts` + cópia mínima nas funções auto-contidas). Build + 341 testes verdes.
   *Deploy* depende do dono (sem acesso Supabase nesta sessão — ver doc 03).
2. **CodeQL (`.github/workflows/codeql.yml`):** code scanning gratuito de JS/TS.
3. **Dependabot (`.github/dependabot.yml`):** atualizações semanais agrupadas (app, tests, actions).

> `vercel.json` **não foi alterado** nesta fase: a SEG1 já aplicou os 6 headers
> corretos. A SEG2 apenas **valida** (checklist do dono, egresso bloqueado).

---

## 5. O que fica **bloqueado por plano/ambiente** (julho / dono)

Conforme decisão do dono (sem domínio próprio agora; Pro e domínio em **julho**, após
a 1ª escola):

| Item | Por que está bloqueado | Vira |
|------|------------------------|------|
| Leaked Password Protection | **Só no plano Pro** (projeto está em Free) | Checklist, ativar em julho |
| Backups gerenciados / PITR / restore testado | Requer Pro | Plano + checklist (doc 06) |
| Staging isolado (projeto Supabase separado) | Requer 2º projeto/Pro | Plano + runbook (doc 07) |
| SMTP próprio | Decisão do dono / domínio | Fallback manual + checklist (doc 09) |
| Domínio e URLs finais | Compra em julho | Plano + checklist (doc 10) |
| Migração para sa-east-1 (LGPD) | Projeto novo de produção | Referência a `operacao/plano-migracao-sa-east-1.md` |
| Branch protection (aplicar) | Sem ferramenta de escrita exposta nesta sessão | Checklist turnkey + `gh api` (doc 02) |
| Scanners externos | Egresso de rede bloqueado neste runtime | Checklists com URL pronta (doc 05) |

---

## 6. O que fica para PR1 / QA2 / POL1

- **QA2:** carga (300–500 alunos), múltiplas escolas, exercitar logs de provisionamento/LGPD ao vivo.
- **PR1:** reavaliar visibilidade do repo com dados reais; primeiro acesso/troca de senha; piloto real.
- **POL1:** polimento UI/UX (fora do escopo SEG2).

---

## 7. Limitações reais desta sessão (transparência)

- **Sem ferramentas MCP do Supabase expostas** nesta sessão de código → não há como
  deployar funções, consultar advisors ou alterar Auth daqui. Os dados "ao vivo" do
  Supabase nesta fase vêm da verificação manual do dono no painel (registrada nos docs).
- **Egresso de rede bloqueado** para `*.supabase.co` e `*.vercel.app`
  (`gateway answered 403 to CONNECT`) → sem curl de preflight/headers e sem scanners daqui.
- **Sem ferramenta de branch protection** no GitHub MCP e **REST direto bloqueado**
  (`403 GitHub access is not enabled for this session`) → branch protection vira checklist.

Essas limitações não bloqueiam a SEG2: o que é código foi feito e testado; o que é
painel/infra virou checklist turnkey com comando exato, como manda a regra da fase.
