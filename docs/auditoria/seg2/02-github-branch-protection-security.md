# SEG2 / S2-C — Repo, branch protection e GitHub security

**Fase:** SEG2 · **Data:** 2026-06-26
**Repositório:** `Jinriuk/Rumo-a-aprova-o-`
**Pendências herdadas:** J-1 (P2), J-3 (Manual), J-4 (P3)

---

## 1. Estado atual (verificado via GitHub API nesta sessão)

| Item | Estado | Evidência |
|------|--------|-----------|
| Visibilidade | **Público** (`"private": false`, `"visibility": "public"`) | `search_repositories` |
| Branch padrão | `main` | API |
| **Branch protection da `main`** | **AUSENTE** (`"protected": false`) | `list_branches` |
| PR obrigatório / checks obrigatórios | **Não impostos** | decorre da ausência de proteção |
| Push direto na `main` | **Possível** hoje (disciplina, não regra) | — |
| Colaboradores | **1** — `Jinriuk` (admin/dono); dev solo | `list_repository_collaborators` |
| Branches | `main` + `claude/demo-base-realista-auditoria-t5ji99` (**stale**, J-4) | `list_branches` |
| CI (`build-e-unitarios`) | Verde e determinístico; guarda anti-"verde vazio" | `.github/workflows/ci.yml` |
| Secret scanning / Push protection | Não verificável por API nesta sessão | checklist (seção 4) |
| Dependabot alerts | Não verificável por API nesta sessão | checklist (seção 4) |
| Code scanning (CodeQL) | **Adicionado nesta fase** (`.github/workflows/codeql.yml`) | seção 3 |
| Dependabot updates | **Adicionado nesta fase** (`.github/dependabot.yml`) | seção 3 |

---

## 2. Decisão do dono (registrada)

O dono **autorizou aplicar branch protection com bypass do dono** ("pode aplicar c/
bypass do dono"). Ou seja: exigir PR + CI verde, bloquear force-push/deleção, mas permitir
que o dono (admin) faça bypass em emergência (`enforce_admins = false`).

> **Por que não foi aplicado automaticamente nesta sessão:** o GitHub MCP desta sessão
> **não expõe ferramenta de escrita de branch protection/ruleset**, e o acesso REST direto
> está bloqueado (`403 GitHub access is not enabled for this session`). Portanto a aplicação
> vira **checklist turnkey** abaixo — com o comando exato — para o dono rodar da máquina dele
> (onde está autenticado) ou aplicar pelo painel em 1 minuto.

---

## 3. O que foi entregue **em código** nesta fase (J-3)

### 3.1 CodeQL — code scanning gratuito
`.github/workflows/codeql.yml`: analisa **JavaScript/TypeScript** (front `app/` + Edge
Functions `supabase/functions/`) em PR, push na `main` e semanalmente. Resultados em
**Security → Code scanning**. Gratuito em repo público. Se o repo virar privado sem
GitHub Advanced Security, basta remover o arquivo.

### 3.2 Dependabot — atualizações de dependências
`.github/dependabot.yml`: PRs **semanais agrupados** para `npm` em `/app` e `/tests` e para
`github-actions` em `/`. Limite baixo de PRs (5) para não gerar ruído em dev solo.

> Estes dois arquivos **passam a valer quando a branch for mergeada na `main`** (e o CodeQL
> já roda nos PRs desta branch). Não exigem permissão administrativa — são ativados pelo
> próprio repositório ao detectar os arquivos.

---

## 4. Checklist manual — endurecer a `main` antes do piloto real

### 4.1 Branch protection (autorizado: PR + check + bloqueios, com bypass do dono)

**Opção A — painel (1 min):** GitHub → Settings → Branches → *Add branch ruleset* (ou
*Add rule*) para `main`:
- [x] **Require a pull request before merging** (aprovações: **0** — dev solo)
- [x] **Require status checks to pass** → selecionar **`build-e-unitarios`**
- [x] **Require branches to be up to date before merging**
- [x] Bloquear **force-push** e **deletion**
- [ ] **Do not allow bypassing** → **DEIXAR DESMARCADO** (bypass do dono autorizado)

**Opção B — `gh api` (turnkey, rode da sua máquina autenticada):**
```bash
gh api -X PUT repos/Jinriuk/Rumo-a-aprova-o-/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["build-e-unitarios"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
JSON
```
- `enforce_admins: false` → **você (dono) pode dar bypass**.
- `required_approving_review_count: 0` → exige **PR**, mas você mesmo pode mergear sem 2ª pessoa.
- Conferir depois: `gh api repos/Jinriuk/Rumo-a-aprova-o-/branches/main/protection`.

### 4.2 Code security (Settings → Code security and analysis)
- [ ] **Secret scanning**: ON · **Push protection**: ON
- [ ] **Dependabot alerts**: ON · **Dependabot security updates**: ON
- [ ] **CodeQL / Code scanning**: confirmar que o workflow `CodeQL` rodou (Security → Code scanning)

### 4.3 Higiene
- [ ] Apagar branch stale **`claude/demo-base-realista-auditoria-t5ji99`** (J-4) se já obsoleta:
      `git push origin --delete claude/demo-base-realista-auditoria-t5ji99`
      (não apagada automaticamente — não foi criada nesta fase).

---

## 5. Repositório público × dados reais (A-2)

Hoje o repo é público **por decisão registrada** (`docs/operacao/github/repositorio-publico.md`)
— aceitável enquanto a base é demo/vitrine. **Antes de cadastrar alunos reais (menores)**:

- [ ] Garantir que o repo público **nunca** contenha seeds/scripts com dado pessoal real
      (hoje só há credenciais de **demo** — ver doc 08); **e/ou**
- [ ] Avaliar **tornar o repo privado** (Settings → General → Danger Zone → Change visibility).
      A segurança continua sendo a RLS, não a obscuridade — mas reduzir superfície é higiene.

> Visibilidade **não alterada automaticamente** — exige autorização explícita do dono
> (regra da fase). Fica como decisão para PR1/piloto real.

---

## 6. Achados

| ID | Sev | Achado | Status SEG2 |
|----|-----|--------|-------------|
| J-1 | P2 | `main` sem branch protection | **Checklist turnkey** (autorizado; aplicar via 4.1) |
| J-3 | Manual | Dependabot + CodeQL + secret scanning | **CodeQL + Dependabot adicionados**; alerts/scanning = checklist 4.2 |
| J-4 | P3 | Branch stale | Checklist 4.3 |
| A-2 | Manual | Repo público × dado real | Recomendação seção 5 (PR1) |

**Veredito S2-C:** segurança do GitHub **endurecida no que era possível por código**
(CodeQL + Dependabot, mergeáveis). Branch protection **autorizada pelo dono** e entregue
como **checklist turnkey com comando exato** (limitação de ferramenta da sessão, não de
permissão). **Nenhum P0/P1.**
