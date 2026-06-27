# HANDOFF — Concluir a SEG2 (para executor com TODOS os acessos)

**Origem:** sessão de código sem acesso Supabase MCP, com egresso de rede bloqueado
(`*.supabase.co` e `*.vercel.app` → 403 CONNECT) e sem ferramenta de escrita de branch
protection no GitHub. Por isso parte da SEG2 ficou como **deploy/verificação** e **infra**.
**Data:** 2026-06-26 · **Branch com o trabalho:** `claude/seg2-production-security-u3bi2d`
(commit `19aa0d2`). **Projeto Supabase:** `bdjkgrzfzoamchdpobbl` (Free, us-east-1).
**Repo:** `Jinriuk/Rumo-a-aprova-o-` (público).

> Use este arquivo como prompt. Leia primeiro `docs/auditoria/seg2/` inteiro (00→relatório)
> e `docs/auditoria/seg1/`. Não refaça o que já está feito — **execute e verifique** o que
> está pendente abaixo e **preencha os resultados reais** nos docs (substitua os ⏳).

---

## 0) Regras (mantêm-se da SEG2)
- Não apagar dado/usuário/escola real. Não commitar `.env`/credenciais. Não expor valores
  de secret em relatório (só nomes). `service_role` nunca no front. Não enfraquecer RLS sem
  relatório. Não rodar scanner agressivo em produção (ZAP só em staging). Não fazer migração
  destrutiva sem plano de rollback. Não trocar ambiente de produção sem checklist +
  autorização do dono. Toda ação manual vira checklist; todo risco é classificado
  (P0/P1/P2/P3/Manual/QA2/PR1/POL1).
- **Dono autorizou:** branch protection **com bypass do dono** (`enforce_admins=false`).
- **Decisão do dono:** Pro + domínio próprio **em julho**, após a 1ª escola. Sem domínio agora.

---

## 1) O que JÁ está feito (não refazer — só validar)
- **CORS allowlist (E-1):** as 6 Edge Functions deixaram de usar `*` e usam allowlist
  refletida. Helper canônico `supabase/functions/_shared/cors.ts` (`buildCorsHeaders`,
  `origemPermitida`), configurável por secret **`ALLOWED_ORIGINS`** (CSV). `contexto.ts`
  re-exporta `corsHeaders`. Funções auto-contidas têm cópia mínima do helper.
  **Falta apenas o DEPLOY + curls** (item 2).
- **CodeQL** (`.github/workflows/codeql.yml`) e **Dependabot** (`.github/dependabot.yml`)
  adicionados. Passam a valer ao mergear na `main`.
- **Docs SEG2** (`docs/auditoria/seg2/00–13`, scanners, dossiê, relatório) escritos.
- **Build verde; testes 341/341** (Postgres real).
- **Senha de coordenação endurecida** no painel (≥8 + letras/dígitos) — feito pelo dono.

---

## 2) DEPLOY + VERIFICAÇÃO do CORS (S2-D) — você TEM Supabase agora
1. Deployar as 6 funções:
   ```bash
   supabase functions deploy provisionar-aluno backoffice-coordenador \
     revogar-responsavel gerar-meta virar-semana lgpd-titular
   ```
   (ou via MCP `deploy_edge_function`, uma a uma).
2. (Opcional, se já houver domínio) `supabase secrets set ALLOWED_ORIGINS="https://dominio,https://www.dominio,https://rumo-a-aprova-o.vercel.app"`.
3. **Preflight — origem permitida** (espera `access-control-allow-origin: https://rumo-a-aprova-o.vercel.app`):
   ```bash
   for fn in provisionar-aluno backoffice-coordenador revogar-responsavel gerar-meta virar-semana lgpd-titular; do
     echo "== $fn =="; curl -i -X OPTIONS "https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/$fn" \
       -H 'Origin: https://rumo-a-aprova-o.vercel.app' -H 'Access-Control-Request-Method: POST' \
       -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type' \
       2>/dev/null | grep -i 'access-control-allow-origin'; done
   ```
4. **Preflight — origem bloqueada** (espera NENHUM allow-origin):
   ```bash
   for fn in provisionar-aluno backoffice-coordenador revogar-responsavel gerar-meta virar-semana lgpd-titular; do
     echo "== $fn =="; curl -i -X OPTIONS "https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/$fn" \
       -H 'Origin: https://evil.example.com' -H 'Access-Control-Request-Method: POST' \
       -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type' \
       2>/dev/null | grep -i 'access-control-allow-origin' || echo "  BLOQUEADO OK"; done
   ```
5. **Smoke** (console aberto): login coordenação → provisionar aluno → gerar meta →
   revogar/revincular responsável → LGPD. Sem erro de CORS.
6. **Preencher a tabela do doc `03-cors-allowlist-edge-functions.md`** com os resultados reais.

---

## 3) Security Headers + scanners (S2-E / S2-F) — você TEM rede agora
1. Garantir que a **`main` foi redeployada** na Vercel (SEG1 + SEG2 mergeadas).
2. `curl -I https://rumo-a-aprova-o.vercel.app/` → conferir os 6 headers.
3. Rodar e **registrar a nota** (substituir os "não executado"):
   - SecurityHeaders.com → `scanners-externos/01-securityheaders.md` (esperado A/A-).
   - MDN Observatory → `02-mdn-observatory.md`.
   - SSL Labs → `03-ssl-labs.md` (esperado A/A+).
   - Sucuri SiteCheck → `04-sucuri-sitecheck.md`.
   - Unxpose externo leve (sem integração OAuth ampla) → `05-unxpose.md`.
4. Atualizar `04-security-headers-mdn.md` (nota antes/depois) e `05-relatorio-scanners-externos.md`.
5. (Opcional A+) endurecer CSP removendo `'unsafe-inline'` do `script-src` — só com teste no deploy.

---

## 4) GitHub branch protection + security (S2-C) — você TEM admin/REST agora
1. Aplicar branch protection (autorizado, com bypass do dono):
   ```bash
   gh api -X PUT repos/Jinriuk/Rumo-a-aprova-o-/branches/main/protection \
     -H "Accept: application/vnd.github+json" --input - <<'JSON'
   { "required_status_checks": { "strict": true, "contexts": ["build-e-unitarios"] },
     "enforce_admins": false,
     "required_pull_request_reviews": { "required_approving_review_count": 0 },
     "restrictions": null, "allow_force_pushes": false, "allow_deletions": false,
     "required_linear_history": true }
   JSON
   ```
   Conferir: `gh api repos/Jinriuk/Rumo-a-aprova-o-/branches/main/protection`.
2. Settings → Code security: ativar **Secret scanning + Push protection**, **Dependabot alerts +
   security updates**. Confirmar que o workflow **CodeQL** rodou (Security → Code scanning).
3. Apagar branch stale: `git push origin --delete claude/demo-base-realista-auditoria-t5ji99`.
4. Atualizar `02-github-branch-protection-security.md` marcando o que foi aplicado.

---

## 5) Leaked Password Protection (S2-B) — requer **Pro**
1. Assinar **Pro** (ver item 6). Auth → Sign In/Providers → ativar **Leaked password protection**.
2. Manter senha mín. ≥8 + letras/dígitos (já configurado).
3. `get_advisors(security)` → confirmar que `auth_leaked_password_protection` (WARN) sumiu.
4. **Corrigir** `docs/operacao/supabase/leaked-password-protection.md` (hoje afirma "ATIVA"
   incorretamente) e o doc `01-leaked-password-protection.md` com o estado verídico.

---

## 6) Backup/restore (S2-G) — requer **Pro** (julho)
1. Assinar **Pro** → backup diário gerenciado (+ PITR se for operar dado real).
2. **TESTAR RESTORE** num **projeto separado** (não em produção): conferir nº de tabelas,
   migrations (`scripts/checar-migrations.mjs`), **RLS** (`tests/isolamento.test.mjs`),
   usuários/dados críticos. Registrar **RTO/RPO** em `06-backup-restore-supabase.md`.

---

## 7) Staging isolado + E2E (S2-H) — requer 2º projeto (julho)
1. Criar projeto Supabase **staging** (idealmente **sa-east-1**). Migrations via runbook
   (`docs/operacao/runbook-migrations-supabase.md`). Só seeds de catálogo + dados sintéticos.
2. Deployar as 6 funções no staging (com `ALLOWED_ORIGINS` do staging).
3. Vercel staging/preview apontando para o Supabase de staging (VITE_* próprios).
4. GitHub Secrets `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` → a E2E do CI passa a rodar.
5. Rodar **Playwright/E2E** e registrar. (Opcional) ZAP baseline contra staging → `08-zap-baseline.md`.

---

## 8) Separação demo × real (S2-I) + região sa-east-1 (LGPD) — antes do 1º aluno real
1. Criar **projeto de produção separado** (sa-east-1, Pro) — `docs/operacao/plano-migracao-sa-east-1.md`.
2. Migrations + **só seeds de catálogo** (sem seeds de demo). Front de produção aponta pra ele.
3. Reprovisionar Edge Functions + `SUPABASE_SERVICE_ROLE_KEY` no projeto real.
4. Rotacionar/parar de versionar as credenciais de **demo**. Atualizar `08-separacao-demo-usuarios-reais.md`.

---

## 9) SMTP + URLs (S2-J) e Domínio (S2-K) — julho
1. SMTP próprio (Resend/SES/Postmark) em Auth → SMTP; verificar remetente (SPF/DKIM/DMARC).
2. Testar recovery de senha + convite de coordenação (entrega, não-spam).
3. Comprar domínio, DNS na Vercel, certificado. Atualizar `ALLOWED_ORIGINS`, **Site URL**,
   **Redirect URLs** e rever CSP. Rodar Internet.nl + Hardenize no domínio
   (`scanners-externos/06`,`07`). Atualizar docs 09/10.

---

## 10) LGPD operacional (S2-N) — antes do aluno real
Publicar **termo de uso** + **política de privacidade**; coletar **consentimento do
responsável**; definir **retenção** e **canal do titular (DPO)**; **DPA** com a escola (B2B).
Mecanismos técnicos (exportar/excluir/consentimento/logs) já existem e estão testados em DB.
Atualizar `13-lgpd-operacional.md`.

---

## 11) Fechamento
- Re-rodar `npm run build` (app) e a suíte (`tests/`, Postgres real) — esperado 341/341.
- **Preencher os resultados reais** em todos os docs com ⏳ (CORS, headers, scanners, restore, E2E).
- Atualizar `relatorio-seg2-seguranca-producao-infra-real.md` (seção 2 e tabela de pendências).
- Commit + push na branch; abrir PR para `main` **se o dono pedir**.

## Critério para declarar SEG2 100% concluída
Branch protection aplicada · CORS deployado e verificado (curls) · headers reexecutados
(saiu de D) · MDN/SSL Labs/Sucuri/Unxpose executados · backup definido **e restore testado** ·
staging criado **ou** planejado com checklist · SMTP/URLs validados ou marcados como bloqueio
de piloto amplo · secrets revisados · demo×real separados ou com plano ativo · LGPD
documentada · build + testes verdes · dossiê + relatório atualizados. **Sem P0/P1.**
