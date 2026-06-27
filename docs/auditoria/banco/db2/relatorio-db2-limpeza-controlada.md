# Relatório DB2 — Limpeza Controlada de Legado e Policies

> Fase **DB2**. Branch `claude/db2-limpeza-legado-policies` (a partir da
> `main` com DB1 mergeada — PR #20 / merge `9fdeb3d`). Data: 2026-06-21 ·
> Projeto `bdjkgrzfzoamchdpobbl` (`us-east-1`, free). Atuação como
> DBA/arquiteto Supabase/auditor multi-tenant. Correções **apenas seguras,
> comprovadas e não-destrutivas**.

---

## Respostas diretas (seção 15 do briefing)

1. **DB2 foi concluída?** ✅ Sim.
2. **Houve mudança destrutiva?** ❌ Não. Zero `drop`/`truncate`/`delete`/
   remoção de coluna/renome.
3. **Alguma tabela foi removida?** ❌ Não (nenhuma tinha prova completa de
   morte).
4. **Alguma policy foi consolidada?** ✅ Sim — 7 tabelas com
   `multiple_permissive_policies` consolidadas (`0029`); advisor **7 → 0**.
5. **Algum índice foi adicionado?** ❌ Não nesta fase — nenhum se
   justificou (os caminhos quentes já foram cobertos na DB1); os 27 FKs
   restantes foram classificados (baixo valor / criar com volume).
6. **Alguma função foi endurecida?** ❌ Não foi necessário — já estavam
   endurecidas (S1/0026): `search_path` fixo, grants restritos, gates
   internos. Auditadas e mantidas.
7. **O motor semanal ainda é necessário?** ✅ Sim — escreve `metas`/
   `meta_atividades`, dispara progresso C0 e alimenta o painel. **Não
   remover.**
8. **A Fase 15 está totalmente ativa ou parcialmente futura?**
   **Parcialmente**: catálogos + trilha por concurso + conquistas estão
   ativos; gamificação/níveis/onboarding/`missoes_escola` estão **vazios**
   (futuro/incompleto), com XP efetivo no C0.
9. **Quais objetos ficaram deprecated?** Nenhum marcado como "morto". As 5
   tabelas Fase 15 vazias foram **anotadas no banco** (`COMMENT ... [DB3]`)
   como "investigar antes de remover"; o motor semanal foi anotado como
   **ATIVO** (anti-confusão).
10. **Quais objetos devem ir para DB3?** As 5 tabelas Fase 15 vazias
    (após prova de ausência de escrita); revisão de `unused_index` sob
    carga; consolidação cosmética do par `lgpd_*`; decisão de produto
    sobre unificar as duas "trilhas".
11. **Há P0?** ❌ Não.
12. **Há P1?** ⚠️ Sim — operacionais/dono (backup, região, leaked-
    password). O P1 de runbook da DB1 foi **resolvido** aqui.
13. **Pode seguir para D1 ou I1?** ✅ Sim. Banco consolidado, policies
    enxutas, RLS verde, paridade mantida, sem bloqueadores.

---

## 1. O que mudou

| Item | Migration/arquivo | Efeito | Verificação |
|---|---|---|---|
| Consolidação de policies | `0029_db2_policies_consolidadas.sql` | `multiple_permissive_policies` 7 → 0 | advisor + 227/227 testes |
| Documentação no banco | `0030_db2_comments_inventario.sql` | `COMMENT ON` (motor ativo / C0 / Fase 15 [DB3]) | aplicado; metadado |
| Teste de policies | `tests/policies-consolidadas.test.mjs` | prova equivalência + suspensão | verde |
| Runbook | `docs/operacao/runbook-migrations-supabase.md` | evita `db push` cego | entregue |
| Relatórios | `docs/auditoria/db2/00–08` + este | auditoria completa | entregue |

## 2. Segurança / RLS (invariantes preservadas)

- RLS em 44/44; **nenhum acesso novo aberto, nenhum legítimo bloqueado**
  (provado por teste de não-vazamento entre escolas e por papel).
- Escola suspensa continua bloqueando (`tenant_operacional()` preservado,
  inclusive na nova policy unificada de `vinculos_responsaveis`).
- `sou_super_admin()`/`eh_super_admin()`/backoffice intactos.
- Advisors de segurança inalterados: 8 secdef by-design + 1 leaked-
  password (toggle do dono). Sem `service_role` no front.

## 3. Testes

| Verificação | Resultado |
|---|---|
| `app: npm run build` | ✅ verde |
| `tests/reset-db.sh` (migrations 0001–0030 + seed 2×) | ✅ idempotência exercitada |
| `tests: node --test` | ✅ **227 / 227 pass · 0 fail · 0 skip** |
| Advisor `multiple_permissive_policies` | **0** (era 7) |
| Advisor segurança | inalterado (by-design) |
| Paridade repo ↔ ledger | 30 == 30 (após push da DB2) |

> Ambiente: Postgres 16 local efêmero (porta 54322, db `rumo_teste`);
> testes de RLS em transações com rollback, **nunca** tocam produção.
> E2E em skip honesto (sem ambiente isolado/secrets no contêiner).

## 4. Conformidade com as regras da DB2

DB1 consolidada na `main` antes de começar; DB2 partiu da `main`; nenhuma
remoção destrutiva; RLS verde; escola suspensa bloqueando; backoffice e
papéis OK; migrations em paridade; runbook criado; testes passando; riscos
classificados. Nada de billing/região/backup/domínio. Onde houve dúvida
(Fase 15 vazia, unificação de trilhas), **documentamos e deixamos para
DB3/produto** — não removemos por intuição.

## 5. Próxima fase recomendada

- **DB3** (quando houver carga/decisão de produto): provar e podar Fase 15
  vazia; revisar `unused_index` sob carga; consolidar `lgpd_*`.
- **D1/I1** liberados em paralelo — o banco está limpo, coerente e seguro
  para evoluir.
