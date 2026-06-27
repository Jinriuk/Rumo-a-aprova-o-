# Relatório S1 — Segurança e Operação Técnica

> Fase **S1**. Objetivo: sair de "demo controlada funcional" para
> "ambiente tecnicamente preparado para piloto real controlado".
> Trabalho a partir da `main` (QA1 mergeada — PR #18). Branch:
> `claude/s1-seguranca-operacao`.
>
> Data: 2026-06-21 · Projeto Supabase `bdjkgrzfzoamchdpobbl`
> (`us-east-1`, plano **free**) · Repo `Jinriuk/Rumo-a-aprova-o-`.

---

## 1. Resumo executivo

| Pergunta de aceite | Resposta |
|---|---|
| O CI ficou honesto? | ✅ Gate único e determinístico (`build-e-unitarios`); E2E só roda isolado, senão é **pulado explicitamente** (nunca finge verde, nunca toca o demo). |
| O status do E2E está claro? | ✅ "skipped" com `::warning::` quando não há ambiente isolado; o caminho para ligá-lo está documentado. |
| O D0 foi validado de verdade? | ✅ Backoffice exercido de ponta a ponta (criar/editar/suspender/reativar) com `admin_logs` gravando cada ação; não-admin barrado. |
| `admin_logs` registra? | ✅ Provado ao vivo: `criar-escola, editar-escola, suspender-escola, ativar-escola`. |
| Não-admin é barrado? | ✅ Coordenação e anon recebem `acesso negado: somente super_admin`. |
| Escola suspensa bloqueia usuários? | ✅ **Bloqueio autoritativo no banco** (migration 0027) + tela no front. Aluno/responsável/coordenação param; super_admin reativa. |
| RPCs endurecidas? | ✅ Auditadas; porteiro `eh_super_admin()`/`tenant_id()` em todas; `anon` revogado; `search_path` fixo. |
| `search_path` corrigido? | ✅ Os 2 advisors WARN restantes (`app.xp_por_prioridade`, `app.xp_simulado`) foram fechados (0026). |
| `service_role` fora do front? | ✅ Confirmado: nenhuma ocorrência em `app/src`; só em migrations (grants server-side). |
| Decisão de backup documentada? | ✅ Plano **free não tem backup automático** — decisão e plano em `07-...`/`docs/operacao`. |
| `us-east-1` + plano documentados? | ✅ Região e LGPD em `08-...` + plano de migração `sa-east-1`. |
| Checklist de auth? | ✅ `09-auth-credenciais.md` + checklist em `docs/operacao`. |
| P0 em aberto? | ✅ **Nenhum P0.** Pendências são P1/P2 operacionais (toggle de auth, plano/backup, repo público) — listadas abaixo. |

**Veredito:** S1 entregue. O sistema está **tecnicamente preparado para
um piloto real controlado**, com 2 ações de painel (não-código) que
dependem do dono antes de receber a primeira escola real: ligar o
*leaked password protection* e decidir backup/plano. Nada disso é
bloqueador de código e nenhum é P0.

---

## 2. O que mudou no código (resumo)

| Arquivo | Item | O quê |
|---|---|---|
| `supabase/migrations/0026_endurecer_search_path_xp.sql` | S1.10 | Fixa `search_path` em `app.xp_por_prioridade`/`app.xp_simulado` (2 advisors WARN → 0). |
| `supabase/migrations/0027_escola_suspensa_bloqueio.sql` | S1.5 | Bloqueio autoritativo de escola suspensa/cancelada (porteiro `tenant_operacional()` + helpers de identidade + políticas da coordenação + `resumo_escola`). |
| `app/src/shared/data/index.js` | S1.5 | `meuPerfil()` reconhece status suspenso e lança erro tipado `ESCOLA_SUSPENSA`. |
| `app/src/shared/hooks/useSessao.js` | S1.5 | Estado `suspensa` separado de `erro`. |
| `app/src/App.jsx` | S1.5 | Tela "Acesso temporariamente suspenso" (sem vazar dado). |
| `.github/workflows/ci.yml` | S1.1/S1.2 | Gate único determinístico + guarda anti-"verde vazio" + E2E só isolado (skip explícito). |
| `tests/suspensao-db.test.mjs` | S1.5 | 5 testes de RLS provando o bloqueio (e que a identidade segue legível). |
| `docs/operacao/e2e-ambiente.md` | S1.2 | Atualizado para o novo comportamento honesto. |

Migrations **aplicadas no projeto live e idempotentes** (rodadas 2× no
CI local + via MCP). Suíte completa: **222 testes · 222 pass · 0 fail**;
build de produção verde.

---

## 3. Evidências ao vivo (todas em transação com ROLLBACK — nada persistiu)

### Bloqueio de escola suspensa (S1.5)
| Medida | Escola ATIVA | Escola SUSPENSA |
|---|---|---|
| `app.meu_aluno_id()` do aluno | resolve | **null** |
| aluno lê os próprios `registros_estudo` | 12 | **0** |
| coordenação `resumo_escola()` (painel) | 60 | **0** |
| coordenação enxerga `alunos` | 60 | **0** |
| própria linha em `usuarios` (identidade) | 1 | **1** (segue legível p/ a tela) |
| `escolas` (marca/status) | 1 | **1** (segue legível) |

### Backoffice D0 (S1.4)
`sou_super_admin`=true · dashboard `escolas_total`=2 · criar/editar/
suspender/reativar=ok · **admin_logs** = `criar-escola, editar-escola,
suspender-escola, ativar-escola` · coordenação chamando dashboard →
`bloqueado: acesso negado: somente super_admin`.

### Smoke de papéis (S1.11)
anon lê `alunos`→**0** · anon backoffice→**bloqueado** · anon
`sou_super_admin`→**bloqueado** (anon revogado) · responsável vê
`alunos`→**1** (só o vinculado).

### Advisors (S1.10)
Segurança: `function_search_path_mutable` **0** (era 2). Restam 8
`authenticated_security_definer_function_executable` (por design — ver
`06-...`) e 1 `auth_leaked_password_protection` (toggle de painel, S1.8).

---

## 4. Pendências (nenhuma P0)

- **P1 — ligar *Leaked Password Protection*** (Supabase → Auth →
  Policies). É toggle de painel; não há ferramenta de API no nosso
  ferramental para fazê-lo por código. Passo a passo em
  `09-auth-credenciais.md`.
- **P1 — backup/plano**: plano **free não tem backup automático
  utilizável**. Antes da 1ª escola real: subir para Pro (backup diário)
  **ou** instituir `pg_dump` periódico fora do Supabase. Ver
  `07-backup-plano.md` e `docs/operacao/backup-retencao-lgpd.md`.
- **P1 — região `us-east-1` vs LGPD**: o dado de aluno (menor) deveria
  morar em `sa-east-1`. Migração **não é automática** (regra S1) — plano
  documentado em `08-regiao-lgpd.md` e `docs/operacao/plano-migracao-sa-east-1.md`.
- **P2 — repositório público**: `Jinriuk/Rumo-a-aprova-o-` está
  **público**. A segurança não depende de obscuridade (é RLS), mas para
  um produto com PII recomenda-se torná-lo privado antes do piloto.
  Decisão do dono (não alterei visibilidade sem autorização).
- **P2 — senha do superadmin / `app.registrar_super_admin`**: processo
  de credencial inicial documentado; rotação de senha do operador é
  ação de painel.
- **P3 — resíduo de leitura da coordenação suspensa**: ver `05-...`
  (coordenação suspensa não tem painel nem identidade de gestão útil, e
  o front a barra; o backstop de banco cobre aluno/responsável por
  completo e os *writes* + painel da coordenação).

---

## 5. Mapa dos relatórios desta fase

| Doc | Item |
|---|---|
| `01-ci-e2e.md` | S1.1 CI/E2E confiável |
| `02-ambiente-e2e-isolado.md` | S1.2 ambiente E2E isolado |
| `03-backoffice-rpc-hardening.md` | S1.3 backoffice/RPC |
| `04-validacao-d0.md` | S1.4 validação operacional do D0 |
| `05-escola-suspensa.md` | S1.5 escola suspensa com bloqueio efetivo |
| `06-advisors-policies-edge.md` | S1.10 advisors/policies/Edge Functions |
| `07-backup-plano.md` | S1.6 backup e plano Supabase |
| `08-regiao-lgpd.md` | S1.7 região do banco e LGPD |
| `09-auth-credenciais.md` | S1.8 auth/senha/credenciais |
| `10-github-secrets.md` | S1.9 GitHub/repo/secrets |
| `11-smoke-producao.md` | S1.11 smoke tests de produção |

---

## 6. Fora de escopo (declaração explícita)

Não iniciei **DB1**, **D1** nem **I1**. Não fiz redesign visual. Não
mexi na área pedagógica (todos os testes de pedagogia seguem verdes).
Não migrei região nem fiz upgrade de plano automaticamente. Não removi
a proteção `sou_super_admin()` — ela foi auditada e mantida. Nenhum
secret exposto; nenhum `service_role` no front; RLS intacta e reforçada.
