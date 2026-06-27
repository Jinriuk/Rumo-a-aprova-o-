# Status Atual do Projeto

**Data:** 2026-06-27
**Fase encerrada:** SEG2 — Segurança de Produção e Infraestrutura Real
**Próxima fase:** PR1 — Prontidão de Piloto Real

---

## Resumo executivo

Sistema **liberado para piloto controlado pequeno**. Branch protection aplicada,
CodeQL/Dependabot/Secret Protection ativos, headers de segurança nota **A**, as 6
Edge Functions **deployadas com CORS allowlist** (substituindo o curinga `*`).
Build de produção verde e **341 testes** passando. **Nenhum P0/P1.** Itens de
piloto real **amplo** dependem de julho (Pro + backup/restore testado + staging +
SMTP + domínio próprio + região `sa-east-1`).

---

## Estado do Supabase remoto

**Projeto:** `bdjkgrzfzoamchdpobbl` (us-east-1, Free)

### Edge Functions (todas ACTIVE, com CORS allowlist — SEG2)

| Função | Versão | verify_jwt | Descrição |
|--------|--------|-----------|-----------|
| `provisionar-aluno` | v3 | true | Cria `usuarios` + `auth.users` para aluno |
| `backoffice-coordenador` | v5 | true | CRUD de turmas, alunos, responsáveis |
| `revogar-responsavel` | v2 | true | Revoga vínculo responsável-aluno |
| `gerar-meta` | v2 | true | Gera meta semanal para aluno |
| `virar-semana` | v2 | false | Virada operacional (gate por service_role) |
| `lgpd-titular` | v2 | true | Exporta/apaga dados do titular |

> CORS: allowlist refletida (produção Vercel + localhost + previews do projeto),
> configurável por `ALLOWED_ORIGINS`. Curls de verificação = checklist do dono
> (`auditoria/seguranca/seg2/03-cors-allowlist-edge-functions.md`).

### Migrations
- **Última:** `0032_d1b_provisionamento_acessos` (+ migrations posteriores de fase)
- **Estado:** em sincronia com o repositório (runbook em `operacao/runbook-migrations-supabase.md`)

---

## Segurança / GitHub (SEG2)

| Item | Estado |
|------|--------|
| Branch protection na `main` | ✅ Aplicada (PR + CI + linear history + no force-push, bypass do dono) |
| CORS wildcard `*` removido das 6 funções | ✅ Em código **e deployado** |
| SecurityHeaders.com | ✅ Nota **A** (6 headers) |
| CodeQL | ✅ Ativo em PR/main |
| Dependabot (alerts + security updates + dependency graph) | ✅ Habilitado |
| Secret scanning / Secret Protection | ✅ Habilitado |
| Repositório | Público (intencional/documentado) |
| Leaked Password Protection | ❌ Só no plano Pro (julho); senha endurecida ≥8 + letras/dígitos |

---

## CI e testes

- **Gate principal:** `build-e-unitarios` — verde
- **Testes:** **341/341** (Postgres efêmero, migrations + seed)
- **Build de produção:** `npm run build` verde (Vite)

---

## Escolas cadastradas

| Escola | Tipo |
|--------|------|
| Colégio e Curso Ícone | Real (piloto candidata) |
| Escola Piloto I1 | Ambiente de testes |
| Curso Beta Preparatório | Demo / semente |
| Matriz Educação RM | Demo / semente |

---

## Pendências para PR1 (resumo)

| Item | Severidade | Onde |
|------|-----------|------|
| SMTP com domínio real + escola real provisionada e testada e2e | P0 | `07-pendencias-para-piloto-real.md` |
| Backup/restore testado (Pro) | P1 | `operacao/backup-retencao-lgpd.md` |
| Curls de verificação do CORS (preflight) | P2 | `auditoria/seguranca/seg2/03-cors-allowlist-edge-functions.md` §5 |
| Região `sa-east-1` (LGPD dado de menor) | P1/julho | `operacao/plano-migracao-sa-east-1.md` |

Lista completa e priorizada em [`07-pendencias-para-piloto-real.md`](./07-pendencias-para-piloto-real.md).
