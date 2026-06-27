# DB1-D — RPCs, Funções, Triggers e Views

> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`. Fonte: `pg_proc`,
> `information_schema.triggers`, `information_schema.views`.

## 1. Funções (schema `app` — internas, não expostas via PostgREST)

| Função | secdef | search_path | grants EXECUTE | Papel |
|---|---|---|---|---|
| `app.jwt()` | não | `""` | authenticated, service_role | lê claims JWT |
| `app.usuario_id()` | não | `""` | authenticated, service_role | identidade |
| `app.tenant_id()` | não | `""` | authenticated, service_role | tenant |
| `app.papel()` | não | `""` | authenticated, service_role | papel |
| `app.hoje_local()` | não | `""` | authenticated, service_role | data local |
| `app.xp_por_prioridade(text)` | não | `""` | authenticated, service_role | XP (fechado na S1/0026) |
| `app.xp_simulado()` | não | `""` | authenticated, service_role | XP (fechado na S1/0026) |
| `app.meu_aluno_id()` | **sim** | `public, app` | authenticated, service_role | id do aluno logado |
| `app.sou_responsavel_de(uuid)` | **sim** | `public, app` | authenticated, service_role | vínculo responsável |
| `app.tenant_operacional()` | **sim** | `public, app` | authenticated, service_role | **bloqueio de escola suspensa (S1)** |
| `app.eh_super_admin()` | **sim** | `public, app` | authenticated, service_role | gate super admin |
| `app.gerar_meta(uuid,date)` | **sim** | `public, app` | postgres, service_role | motor semanal |
| `app.virar_semana(date)` | **sim** | `public, app` | postgres, service_role | motor semanal |
| `app.semana_da_data(uuid,date)` | **sim** | `public, app` | postgres, service_role | motor semanal |
| `app.backfill_progresso(uuid)` | **sim** | `public, app` | (público=X, service_role) | C0 backfill |
| `app.desbloquear_conquista_basica(...)` | **sim** | `public, app` | — (trigger) | gamificação |
| `app.progresso_de_registro/missao/simulado()` | **sim** | `public, app` | — (trigger) | C0 |
| `app.registrar_nivel_historico()` | **sim** | `public, app` | — (trigger) | níveis |
| `app.registrar_super_admin(text,text)` | **sim** | `public, app, auth` | postgres, service_role | provisão superadmin |
| `app.lgpd_excluir/exportar(uuid)` | **sim** | `public, app` | postgres, service_role | LGPD |

## 2. Funções (schema `public` — expostas via `/rest/v1/rpc`)

| Função | secdef | search_path | EXECUTE p/ authenticated? | Gate interno |
|---|---|---|---|---|
| `public.sou_super_admin()` | **sim** | `public, app` | **sim** | retorna bool; seguro |
| `public.resumo_escola()` | **sim** | `public, app` | **sim** | filtra por `tenant_id` + `tenant_operacional` |
| `public.backoffice_dashboard()` | **sim** | `public, app` | **sim** | `eh_super_admin()` interno |
| `public.backoffice_escolas()` | **sim** | `public, app` | **sim** | `eh_super_admin()` interno |
| `public.backoffice_detalhe_escola(uuid)` | **sim** | `public, app` | **sim** | `eh_super_admin()` interno |
| `public.backoffice_criar_escola(...)` | **sim** | `public, app` | **sim** | `eh_super_admin()` interno |
| `public.backoffice_editar_escola(...)` | **sim** | `public, app` | **sim** | `eh_super_admin()` interno |
| `public.backoffice_definir_status(uuid,text)` | **sim** | `public, app` | **sim** | `eh_super_admin()` interno + grava `admin_logs` |
| `public.lgpd_excluir/exportar(uuid)` | não | `""` | postgres, service_role | só servidor |
| `public.motor_gerar_meta(uuid)` | não | `""` | postgres, service_role | só servidor |
| `public.motor_virar_semana()` | não | `""` | postgres, service_role | só servidor |

### Advisor `authenticated_security_definer_function_executable` (8 WARN)

Os 8 alertas são as funções `public` `SECURITY DEFINER` executáveis por
`authenticated`: as 6 `backoffice_*` + `resumo_escola` + `sou_super_admin`.
**São por design** e já foram analisados na S1 (`06-advisors-...`):
cada `backoffice_*` confere `eh_super_admin()` **dentro** da função e
grava auditoria; `resumo_escola` filtra por tenant operacional;
`sou_super_admin` só devolve booleano. Revogar o EXECUTE de
`authenticated` quebraria o backoffice (que roda como usuário logado
super admin). **Mantidos — nenhuma ação na DB1.**

## 3. Triggers

| Tabela | Trigger | Evento | Função | Idempotência |
|---|---|---|---|---|
| `aluno_niveis` | `trg_nivel_historico` | AFTER INS/UPD | `app.registrar_nivel_historico` | grava histórico (append) |
| `meta_atividades` | `trg_progresso_missao` | AFTER INS/UPD | `app.progresso_de_missao` | via `idempotency_key` em `aluno_eventos_progresso` |
| `registros_estudo` | `trg_progresso_registro` | AFTER INS | `app.progresso_de_registro` | idem |
| `simulados` | `trg_progresso_simulado` | AFTER INS | `app.progresso_de_simulado` | idem |

> Os triggers de progresso C0 gravam em `aluno_eventos_progresso`, que tem
> índice **UNIQUE em `idempotency_key`** — garante que reprocessamento não
> duplica XP. Exercitado pelos testes de motor/progresso (idempotência) e
> pelo seed rodado 2× no `reset-db.sh`. **Sem risco de XP duplicado.**

## 4. Views

| View | Base | Depende de RLS? | Expõe PII? | Uso |
|---|---|---|---|---|
| `vw_aluno_xp_total` | `aluno_eventos_progresso` | herda RLS da base p/ `authenticated` | aluno_id/escola_id (escopado) | **ativa** (front: total de XP) |
| `vw_recorrencia_medida` | `questoes_prova`+`provas_anteriores`+`assuntos` | base é catálogo | não | front (recorrência) |

> `vw_aluno_xp_total` é a **fonte de XP do C0** — confirma que
> `aluno_xp_eventos` (Fase 15) foi superada. Ambas as views são usadas no
> front (`.from('vw_recorrencia_medida')`, agregação de XP). Manter.

## 5. Veredito

Inventário de funções/triggers/views **limpo e seguro**: `search_path`
fixo em tudo que é `SECURITY DEFINER`, gates internos corretos, grants
coerentes (escrita do motor/LGPD só p/ `service_role`/`postgres`),
triggers idempotentes. **Nenhuma correção necessária na DB1** — os 8
advisors são by-design e os gates da S1 (`tenant_operacional`,
`eh_super_admin`, `sou_super_admin`) estão **intactos**.

### Observação para DB2 (não-bloqueante)
Há um par `lgpd_excluir/lgpd_exportar` em **dois schemas** (`app` secdef e
`public` wrapper não-secdef). Funciona e é seguro (ambos só
`service_role`/`postgres`), mas a duplicação merece consolidação
documental em DB2.
