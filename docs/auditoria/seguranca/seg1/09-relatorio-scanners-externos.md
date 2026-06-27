# SEG1-I — Relatório de Scanners Externos

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25

> Estes resultados são **evidências técnicas externas de segurança** — **não** uma
> certificação formal de segurança.

---

## 1. Resumo da execução

| Ferramenta | Executado nesta fase? | Motivo / Próxima ação | Arquivo |
|------------|------------------------|------------------------|---------|
| SecurityHeaders.com | ❌ Não | egresso bloqueado — rodar pós-deploy | `scanners-externos/01-securityheaders.md` |
| MDN Observatory | ❌ Não | egresso bloqueado — rodar pós-deploy | `scanners-externos/02-mdn-observatory.md` |
| Qualys SSL Labs | ❌ Não | egresso bloqueado; TLS é gerido pela Vercel | `scanners-externos/03-ssl-labs.md` |
| Sucuri SiteCheck | ❌ Não | egresso bloqueado — rodar pós-deploy | `scanners-externos/04-sucuri-sitecheck.md` |
| Internet.nl | ❌ Não | requer domínio próprio (SEG2) | `scanners-externos/05-internetnl.md` |
| Hardenize | ❌ Não | requer domínio próprio (SEG2) | `scanners-externos/06-hardenize.md` |
| Unxpose | ❌ Não | política: sem integração ampla nesta fase | `scanners-externos/07-unxpose.md` |
| OWASP ZAP baseline | ❌ Não | sem staging; não rodar agressivo em produção | `scanners-externos/08-zap-baseline.md` |

---

## 2. Por que nenhum scanner externo rodou **automaticamente** nesta sessão

A varredura ao vivo dependia de acesso de saída (HTTPS) aos serviços externos e ao host
do app. **A política de egresso do runtime desta sessão bloqueia** tanto
`rumo-a-aprova-o.vercel.app` quanto `bdjkgrzfzoamchdpobbl.supabase.co`
(`gateway answered 403 to CONNECT`, registrado no `__agentproxy/status`). Conforme a
documentação do ambiente, **não se contorna a política — reporta-se**.

Isso é uma limitação de **rede do ambiente de execução**, não um problema do app. Por
isso, todos os scanners externos foram convertidos em **checklist manual do dono**, com
URL pronta e resultado esperado em cada arquivo.

---

## 3. Evidência técnica interna equivalente (o que substituímos por verificação direta)

Mesmo sem os scanners externos, a SEG1 produziu evidência **direta** e mais forte que um
scanner remoto em vários pontos:

| Tema que o scanner inferiria | Evidência direta produzida na SEG1 |
|------------------------------|------------------------------------|
| Headers de segurança | Aplicados e versionados em `vercel.json` (revisão de código), `08-security-headers.md` |
| RLS / isolamento | 341 testes verdes + RLS ativa em 45/45 tabelas (`06-rls-isolamento.md`) |
| Secrets expostos | Varredura `git grep` completa, sem secret privado (`02`, `03`) |
| Auth / leaked password | Security Advisor do Supabase (`04-auth-supabase.md`) |
| Edge Functions / CORS / Auth | Revisão das 6 funções + metadados de deploy (`05-…`) |

---

## 4. Conclusão SEG1-I

Scanners externos **não executados nesta fase por bloqueio de rede do ambiente**, com
**motivo e próxima ação registrados** para cada um (atende a regra "se não executado,
registrar Não executado / Motivo / Próxima ação"). A pendência é **Manual** (dono) e
**não bloqueia** a aprovação da SEG1, dado o conjunto de evidências internas diretas.
