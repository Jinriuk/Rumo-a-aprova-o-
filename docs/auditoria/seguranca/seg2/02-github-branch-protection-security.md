# SEG2 / S2-C — Repo, branch protection e GitHub security

**Fase:** SEG2 · **Data:** 2026-06-26 · **Atualizado:** 2026-06-26 (executor com todos os acessos)
**Repositório:** `Jinriuk/Rumo-a-aprova-o-`
**Pendências herdadas:** J-1 (P2), J-3 (Manual), J-4 (P3)

---

## 1. Estado atual (verificado em 2026-06-26 17:47 UTC — executor com acesso)

| Item | Estado | Evidência |
|------|--------|-----------|
| Visibilidade | **Público** | settings |
| Branch padrão | `main` | branches page |
| **Branch protection da `main`** | **✅ APLICADA** (PR + CI + linear history + no force-push + no delete + bypass do dono) | Settings → Branches |
| Require pull request | ✅ | branch rule |
| Require status checks (`build-e-unitarios`) | ✅ + up-to-date | branch rule |
| Require linear history | ✅ | branch rule |
| Allow force pushes | ❌ bloqueado | branch rule |
| Allow deletions | ❌ bloqueado | branch rule |
| Do not allow bypassing (enforce_admins) | ❌ desmarcado — bypass do dono autorizado | branch rule |
| Colaboradores | **1** — `Jinriuk` (admin/dono); dev solo | settings |
| Branches | apenas `main` (stale removida — §4.3) | branches page |
| CI (`build-e-unitarios`) | Verde e determinístico | `.github/workflows/ci.yml` |
| Secret Protection | ✅ **HABILITADA** em 2026-06-26 | Settings → Advanced Security |
| Dependabot alerts | ✅ **HABILITADO** em 2026-06-26 | Settings → Advanced Security |
| Dependabot security updates | ✅ **HABILITADO** em 2026-06-26 | Settings → Advanced Security |
| Dependency graph | ✅ **HABILITADO** em 2026-06-26 | Settings → Advanced Security |
| Code scanning (CodeQL) | ✅ ativo — last scan ~3h atrás | Settings → Advanced Security |
| Dependabot updates | ✅ `.github/dependabot.yml` presente | seção 3 |

---

## 2. Decisão do dono (registrada e executada)

O dono autorizou aplicar branch protection com bypass do dono (`enforce_admins = false`).

**Status:** ✅ **APLICADA em 2026-06-26** via Settings → Branches (painel GitHub).

Configuração aplicada:
- Require a pull request before merging: ✅
- Require approvals: ❌ (dev solo — 0 approvals necessários)
- Require status checks (`build-e-unitarios`) + up to date: ✅
- Require linear history: ✅
- Do not allow bypassing: ❌ desmarcado (enforce_admins=false — bypass do dono)
- Allow force pushes: ❌ (bloqueado)
- Allow deletions: ❌ (bloqueado)

---

## 3. O que foi entregue em código nesta fase (J-3)

### 3.1 CodeQL — code scanning gratuito

`.github/workflows/codeql.yml`: analisa JavaScript/TypeScript (front `app/` + Edge Functions
`supabase/functions/`) em PR, push na main e semanalmente.
**Last scan: ~3h atrás (confirmado em Settings → Advanced Security, 2026-06-26).**

### 3.2 Dependabot — atualizações de dependências

`.github/dependabot.yml`: PRs semanais agrupados para npm em `/app` e `/tests` e para
github-actions em `/`. Limite baixo de PRs (5) para não gerar ruído em dev solo.
**Status:** ✅ Dependabot alerts + security updates habilitados em 2026-06-26.

---

## 4. Ações executadas (2026-06-26 — executor com acesso)

### 4.1 Branch protection — ✅ APLICADA

Aplicada via Settings → Branches → Edit rule (painel GitHub), 2026-06-26 17:47 UTC.

### 4.2 Code security — ✅ HABILITADO

Habilitado via Settings → Advanced Security, 2026-06-26:
- ✅ Dependency graph
- ✅ Dependabot alerts
- ✅ Dependabot security updates
- ✅ Secret Protection (alertas a parceiros para secrets detectados)
- ✅ CodeQL analysis (last scan ~3h)

### 4.3 Higiene — ✅ Branch stale removida

Branch `claude/demo-base-realista-auditoria-t5ji99` (J-4) deletada via UI em 2026-06-26.
Repositório agora possui apenas a branch `main`.

---

## 5. Repositório público × dados reais (A-2)

Repo público por decisão registrada (`docs/operacao/github/repositorio-publico.md`) —
aceitável enquanto base é demo/vitrine. Antes de alunos reais: avaliar tornar privado.
Decisão para PR1/piloto real.

---

## 6. Achados

| ID | Sev | Achado | Status SEG2 |
|----|-----|--------|-------------|
| J-1 | P2 | main sem branch protection | ✅ **RESOLVIDO** — aplicada 2026-06-26 |
| J-3 | Manual | Dependabot + CodeQL + secret scanning | ✅ **RESOLVIDO** — tudo ativo 2026-06-26 |
| J-4 | P3 | Branch stale | ✅ **RESOLVIDO** — deletada 2026-06-26 |
| A-2 | Manual | Repo público × dado real | Recomendação §5 (PR1) |

**Veredito S2-C:** ✅ **CONCLUÍDO** — Branch protection aplicada, CodeQL ativo, Dependabot alerts +
security updates habilitados, Secret Protection habilitada, branch stale removida. Sem P0/P1.
