# SEG1-J — Branch Protection e GitHub Actions

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25
**Repositório:** `Jinriuk/Rumo-a-aprova-o-`

---

## 1. Estado verificado (GitHub API)

| Item | Estado | Evidência |
|------|--------|-----------|
| Branch padrão | `main` | API `default_branch` |
| **Proteção da `main`** | **AUSENTE** (`"protected": false`) | `list_branches` |
| PR obrigatório p/ `main` | **Não imposto** | decorre de não haver proteção |
| Checks obrigatórios | **Não impostos** | idem |
| GitHub Actions (CI) | **Verde** nas últimas execuções da `main` | `list_workflow_runs ci.yml` → `success` em #31, #33, #34, #35… |
| Gate principal do CI | `build-e-unitarios` (build + 341 testes), sem secret | `.github/workflows/ci.yml` |
| E2E guard | Presente — pula E2E de forma **explícita** sem ambiente isolado | `ci.yml` job `e2e-guard` |
| Guarda anti-"verde vazio" | Falha o CI se a suíte rodar < 200 testes | `ci.yml` passo final |
| Branches antigas | `claude/demo-base-realista-auditoria-t5ji99` (stale) | `list_branches` |
| Dependabot / alerts | **Não verificável por MCP** | checklist manual |
| Secret scanning | Ativo por padrão em repo público; **confirmar no painel** | checklist manual |
| Code scanning (CodeQL) | **Não configurado** (não há workflow CodeQL) | repo |

---

## 2. Análise

**Ponto forte:** o CI já é um gate sério e **determinístico** — build de produção +
341 testes (lógica, motor, RLS, isolamento, suspensão, backoffice), sem depender de
secret, com guarda contra "verde vazio". As últimas execuções na `main` estão **verdes**.

**Lacuna principal (J-1):** a `main` **não tem branch protection**. Hoje, em tese, é
possível um push direto na `main` sem PR e sem o check do CI passar. O fluxo **na
prática** vem usando PRs (#28–#35, todos via merge de PR), mas isso é **disciplina, não
regra imposta**. Para piloto com escola séria, convém **impor** a regra.

A configuração de branch protection **não foi feita automaticamente** nesta fase:
exige permissão administrativa no repositório e é uma mudança de governança que deve ser
decisão explícita do dono. Fica como **checklist manual** abaixo.

---

## 3. Checklist manual (dono) — proteger a `main`

GitHub → Settings → Branches → **Add branch ruleset / protection rule** para `main`:

- [ ] **Require a pull request before merging** (≥ 1 aprovação; ou self-approve se for dono único).
- [ ] **Require status checks to pass** → selecionar **`build-e-unitarios`** (gate autoritativo).
- [ ] **Require branches to be up to date before merging**.
- [ ] **Do not allow bypassing the above settings** (ou permitir só ao dono, conscientemente).
- [ ] **Require linear history** (opcional, mantém histórico limpo).
- [ ] Bloquear **force-push** e **deleção** da `main`.

GitHub → Settings → Code security:
- [ ] Confirmar **Secret scanning** ativo (e **Push protection**).
- [ ] Ativar **Dependabot alerts** + **Dependabot security updates**.
- [ ] (Opcional, recomendado) adicionar workflow **CodeQL** (`github/codeql-action`) para
      JavaScript — code scanning gratuito em repo público.

Higiene:
- [ ] Apagar a branch antiga `claude/demo-base-realista-auditoria-t5ji99` se já mergeada/obsoleta.

---

## 4. Achados

| ID | Sev | Achado | Status |
|----|-----|--------|--------|
| J-1 | P2 / Manual | `main` sem branch protection (PR/checks não impostos) | Checklist manual |
| J-2 | OK | CI verde, determinístico, com guarda anti-verde-vazio | Confirmado |
| J-3 | Manual | Confirmar Secret scanning + Dependabot; considerar CodeQL | Checklist manual |
| J-4 | P3 | Branch antiga stale a remover | Manual |

**Veredito SEG1-J:** CI sólido e verde; a lacuna é **branch protection não imposta** na
`main` — **P2/Manual**, documentada com checklist. **Nenhum P0/P1.**
