# Dossiê Técnico de Segurança (Produção) — Rumo à Aprovação

**Documento apresentável para escola/cliente sério.**
**Fase:** SEG2 — Segurança de Produção e Infraestrutura Real · **Data:** 2026-06-26
**Versão do sistema:** `main` pós-SEG1 + SEG2 (esta branch)

> **Aviso de honestidade:** este dossiê reúne **evidências técnicas internas e externas**.
> **Não** é uma certificação formal de segurança e não deve ser apresentado como tal.

---

## 1. Resumo executivo

O **Rumo à Aprovação** é um SaaS educacional **multi-tenant white-label**. A premissa de
segurança é verificável: **o isolamento entre escolas é regra de banco (RLS no Postgres),
não disciplina de tela.** A SEG2 prepara o sistema para **piloto real controlado**:

- **CORS estreitado** de curinga `*` para **allowlist** nas 6 Edge Functions (SEG2).
- **Code scanning (CodeQL)** e **Dependabot** adicionados ao repositório (SEG2).
- **Política de senha** da coordenação endurecida (≥8 + letras e dígitos).
- **Backup/restore, staging, domínio, SMTP, Pro e região sa-east-1** definidos com
  **plano e checklist** para a virada de **julho** (decisão do dono).
- Mantém o que a SEG1 provou: **0 P0/P1**, `service_role` server-side, RLS 45/45, 341
  testes verdes, headers de segurança, logs auditáveis.

**Conclusão:** **minimamente preparado para piloto real controlado** observadas as
pendências de julho (Pro/backup/staging/domínio/SMTP/região) e as ações de governança
(branch protection) — **nenhuma P0/P1**.

---

## 2. Arquitetura

```
Navegador (SPA React+Vite, Vercel)
  │  só chaves PÚBLICAS (URL + anon key) + JWT do usuário logado
  ▼
Supabase
  ├── Postgres + RLS  ← autorização real (isolamento por escola)
  ├── Auth (GoTrue)   ← identidade; papel e escola_id nos claims do JWT
  └── Edge Functions  ← privilégio elevado (service_role) confinado ao servidor
```

## 3. Papéis e permissões

| Papel | Entra por | Vê/faz |
|-------|-----------|--------|
| Aluno | código `XXXX-XXXX-XXXX` | só os próprios dados |
| Responsável | código | só o(s) aluno(s) vinculado(s), leitura |
| Coordenação | e-mail + senha | só a **própria escola** |
| Super admin | e-mail + senha | backoffice cross-tenant |

A matriz é aplicada **duas vezes**: front roteia por papel; **banco impõe** por RLS.

## 4. Isolamento por escola (RLS)
- Toda tabela de dado de escola tem `escola_id` + política RLS confinando ao tenant do JWT.
- **RLS ativa em 45/45 tabelas**; **341 testes** provam que escola A não lê/escreve nada de B.

## 5. Edge Functions (6, ACTIVE)
`provisionar-aluno`, `backoffice-coordenador`, `revogar-responsavel`, `gerar-meta`,
`virar-semana` (gate por service_role), `lgpd-titular`. Auth por **token real** + papel +
`escola_id`; `service_role` só no servidor.

## 6. CORS allowlist (SEG2)
- Antes: `Access-Control-Allow-Origin: *`. Agora: **reflete o Origin só se permitido**
  (produção + localhost + previews do projeto); fora da lista → **sem** header (navegador bloqueia).
- Configurável por **`ALLOWED_ORIGINS`** (CSV) — domínio próprio entra sem mexer no código.
- Sem `Allow-Credentials` (modelo Bearer). Deploy + curls = checklist do dono (doc 03).

## 7. Secrets
- Front: só `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (públicas).
- `service_role`: nunca no front/repo; só Edge Functions; teste de CI guarda isso.
- Inventário com classificação em `11-secrets-infraestrutura.md` (sem valores).

## 8. Branch protection / GitHub security
- Repo **público**; `main` **sem proteção** hoje → **autorizada** (PR + check `build-e-unitarios`
  + bloqueios, com bypass do dono); aplicar via checklist turnkey (doc 02).
- **CodeQL + Dependabot** adicionados nesta fase. Secret scanning/alerts = checklist.

## 9. Backups e restore
- Free hoje (sem backup gerenciado). Plano: **Pro em julho** (backup diário + PITR opcional).
- **Restore deve ser testado** em projeto separado antes de dado real (doc 06).

## 10. Staging
- Não existe; CI **já suporta** (job `e2e-guard`). Plano + runbook em `07-staging-isolado-e2e.md`.

## 11. SMTP / URLs
- Site URL/Redirect URLs **corretas, sem wildcard**. SMTP ausente → **fallback manual**
  funcional (aceitável p/ piloto pequeno; bloqueante p/ amplo). Doc 09.

## 12. Domínio
- Vercel atual no piloto inicial (HTTPS/HSTS ativos). Domínio próprio = julho (doc 10).

## 13. Headers de segurança
- 6 headers (CSP+HSTS+XFO+XCTO+Referrer+Permissions) no `vercel.json`. Reexecutar
  SecurityHeaders/MDN após o redeploy da `main` (doc 04). Nota esperada **A/A-**.

## 14. Scanners externos
- Não executáveis deste runtime (egresso bloqueado) → checklists com URL pronta (doc 05).
  **Evidências técnicas externas**, não certificação.

## 15. LGPD
- Minimização (só nome + desempenho). Exportar/excluir/consentimento **implementados e
  testados em DB**. Pendentes (julho/jurídico): termos, retenção, DPA, **sa-east-1** (doc 13).

## 16. Logs
- `admin_logs`, `logs_coordenacao`, `logs_acesso` — com RLS, autor não-forjável. Retenção = K-2.

## 17. Riscos pendentes (nenhum P0/P1)

| ID | Sev | Pendência | Destino |
|----|-----|-----------|---------|
| D-1 | P2 / bloqueado-plano | Leaked Password Protection (só Pro) | julho |
| A-1 | P2 | Demo × real (projeto separado) | antes do aluno real |
| J-1 | P2 | Branch protection (autorizada) | checklist turnkey (doc 02) |
| — | SEG2 | Backup/restore, staging, domínio, SMTP, sa-east-1 | julho |
| K-2 | P3 | Retenção/rotação de logs | PR1 |

## 18. Recomendações antes do piloto real
1. Aplicar **branch protection** (doc 02, comando pronto).
2. **Deployar** as Edge Functions com CORS allowlist + rodar os curls (doc 03).
3. Confirmar **redeploy** da `main` e **re-scan** de headers (doc 04).
4. Em julho: **Pro** (backup+restore testado), **projeto real sa-east-1** separado do demo,
   **SMTP**, **domínio**.
5. Publicar **termos/política** e coletar **consentimento** dos responsáveis (doc 13).
