# Riscos, pendências e próximos passos

> Consolidação P0–P3 de toda a AUDIT-ALL. Classificação por destino: **patch curto**, **S1** (segurança/operação), **DB1** (consolidação Supabase), **D1** (evolução backoffice), **I1** (implantação de escola).

## 13.1 — Lista de P0

**Não há P0 aberto.** ✅

O único P0 do histórico recente — **CI de testes vermelho desde o Bloco B** (seed 13 abortando → suíte pulada) — **foi corrigido na D0** e confirmado nesta auditoria: o job `build-e-unitarios` está verde no run #112 (211 testes, 0 skipped), e o `reset-db.sh` isola corretamente as seeds 04/13/14.

## 13.2 — Lista de P1

| # | P1 | Evidência | Destino |
|---|---|---|---|
| P1-1 | **Banco em `us-east-1`, não `sa-east-1`** — bloqueia dado real de aluno menor (LGPD/residência) | `list_projects` → region `us-east-1` | **S1** (decisão de infra/migração de projeto) |
| P1-2 | **Suíte E2E nunca verde no CI** — cancelada por timeout (25 min) em todo run, inclusive `main` #112; foi tratada como rede de segurança nas fases A/B/C1*/D0 | `12-github-ci.md` | **patch curto** (destravar/segmentar/quarentenar) + **S1** |
| P1-3 | **Backup automático não confirmado** para o plano em uso | Fase A §5; sem evidência de mudança | **S1** |

> Os três P1 são de **operação/segurança**, não de funcionalidade. Nenhum bloqueia a demo ou o piloto controlado; **P1-1 bloqueia dado real de menor** e **P1-2 remove a confiança em “verde”**.

## 13.3 — Lista de P2/P3

### P2
| # | Item | Destino |
|---|---|---|
| P2-1 | Divergência de ledger de migration: remoto `0022_motor_progresso` × repo `0024`; sem linha `0024` no remoto; dois `0022` → armadilha de `db push` | **DB1** |
| P2-2 | `admin_logs` = 0: caminho de escrita+auditoria da D0 nunca exercitado em prod; validação manual D0 pendente | **patch curto** (validação manual) |
| P2-3 | D0 suspensão = só status; sem bloqueio global de login por escola suspensa | **D1** |
| P2-4 | 8 RPCs `SECURITY DEFINER` executáveis por `authenticated` (advisor) — autogated, mas pede revogar EXECUTE/endurecer | **S1** |
| P2-5 | 2 funções com `search_path` mutável (`app.xp_por_prioridade`, `app.xp_simulado`) — contraria doutrina | **S1**/DB1 |
| P2-6 | Leaked-password protection desabilitada (Supabase Auth) | **S1** |
| P2-7 | Rate-limit do login só o padrão do Auth | **S1** |
| P2-8 | Sem branch protection / gate verde antes do merge → merge C1B publicou build ERROR na Vercel | **S1**/patch |
| P2-9 | Carga real 300–500 alunos não medida em prod (índices ainda “unused”) | **I1**/DB1 |
| P2-10 | E2E/mobile dos ajustes C1A–C1D nunca validados automaticamente | **patch**/S1 |

### P3
| # | Item | Destino |
|---|---|---|
| P3-1 | Branch `naval-system-build` órfã (sem conteúdo único) — apagar | **patch curto** |
| P3-2 | Branch `demo-base-realista` com 2 refactors “16.8” não incorporados — **revisar antes de apagar** | **patch curto** (decisão humana) |
| P3-3 | Tabelas Fase 15 dormentes: `aluno_niveis`/`aluno_onboarding`/`aluno_nivel_historico` (0 linhas) e `aluno_xp_eventos` (0, superseded por C0) | **fase futura** (produto/limpeza) |
| P3-4 | ~38 FKs sem índice de cobertura (advisor INFO) | **DB1** |
| P3-5 | 7 `multiple_permissive_policies` em tabelas Fase 15 | **DB1** |
| P3-6 | `virar-semana` com `verify_jwt=false` — confirmar que só o cron/secret aciona | **S1** |
| P3-7 | Bundle único >500 kB sem code-splitting | **fase futura** (UX/perf) |
| P3-8 | Conferência manual das env vars da Vercel (só `VITE_*`) | **patch**/S1 |
| P3-9 | Vitrine/Beta com `status=implantacao`, `plano=null` (status ampliado D0 não usado p/ diferenciar) | **D1** (cosmético) |
| P3-10 | `Turmas.renomear/excluir` via `window.prompt/confirm` sem trava “ocupado” | **fase futura** |
| P3-11 | Cobertura de responsáveis na vitrine mínima (2 vínculos) | **I1**/demo |

## 13.4 — Próxima fase recomendada

### Recomendação: **S1 — segurança e operação técnica**

**Por quê.** Tudo que ficou aberto e materialmente importante é de **segurança/operação**, não de produto:
- Os dois P1 mais sérios são de operação: **residência LGPD (`sa-east-1`)** e **backup confirmado** — pré-condições para qualquer dado real de aluno (I1 depende deles).
- O P1 de **CI/E2E** destrói a confiança em “verde”; S1 é o lugar natural para tornar a verificação real (ou redesenhá-la) e introduzir um gate antes do deploy.
- O bloco de **endurecimento do Supabase** (P2-4/5/6/7, P3-6) — `SECURITY DEFINER` executável por `authenticated`, `search_path` mutável, leaked-password, rate-limit, `verify_jwt` da virada — é exatamente o escopo de S1 e fecha os advisors WARN sem tocar funcionalidade.

**Antes de S1 — patch curto (baixo risco, alto valor):**
1. Destravar/segmentar/quarentenar o job **E2E** no CI para que o badge reflita a verdade (P1-2).
2. **Validação manual da D0** em produção (criar/editar/suspender escola → conferir `admin_logs`) (P2-2).
3. Apagar `naval-system-build` e **decidir** sobre `demo-base-realista` (revisar os 2 refactors 16.8) (P3-1/P3-2).
4. Conferir env vars da Vercel (P3-8).

**Por que não as outras agora:**
- **DB1** (consolidar ledger de migration, FKs sem índice, políticas permissivas) é forte e necessária, mas **não bloqueia operação** e pode vir logo após S1.
- **D1** (evolução do backoffice: bloqueio por escola suspensa, busca/paginação) depende de a D0 ter sido **exercitada** (P2-2) — fazer depois da validação manual.
- **I1** (implantação de escola nova) **não deve começar** antes de fechar P1-1 (LGPD/região) e P1-3 (backup) — caso contrário se onboarda dado real sem residência/backup garantidos.

---

## 13.5 — Critérios de conclusão da AUDIT-ALL (checklist)

- [x] Todos os 14 relatórios criados em `docs/auditoria/audit-all/`.
- [x] Todas as 15 fases/itens do escopo avaliados (14.5 → reconciliação D0).
- [x] Supabase, Vercel e GitHub auditados com evidência de ambiente.
- [x] Divergências documentadas (relatório × código × banco × Vercel × comportamento).
- [x] P0/P1/P2/P3 listados (P0: nenhum; P1: 3; P2: 10; P3: 11).
- [x] Recomendação clara da próxima fase (**S1**, com patch curto pré-S1).
- [x] Nenhuma alteração destrutiva; nenhuma correção silenciosa (auditoria 100% somente-leitura; só foram criados estes relatórios).
