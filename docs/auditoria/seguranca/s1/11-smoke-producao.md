# S1.11 — Smoke tests de produção

> Todos executados **contra o banco live** (`bdjkgrzfzoamchdpobbl`) em
> transação com **ROLLBACK** (nada persistiu) ou via leitura pura.

## Por papel / situação

| Cenário | Verificação | Resultado |
|---|---|---|
| **anon** | lê `alunos` | **0 linhas** (RLS nega) |
| **anon** | chama `backoffice_dashboard()` | **bloqueado** |
| **anon** | executa `sou_super_admin()` | **bloqueado** (anon revogado) |
| **aluno** | `meu_aluno_id()` resolve | sim (escola ativa) |
| **aluno** | lê os próprios `registros_estudo` | 12 (só os dele) |
| **responsável** | lê `alunos` | **1** (só o vinculado) |
| **coordenação** | `resumo_escola()` (painel) | 60 linhas (sua escola) |
| **coordenação** | `backoffice_dashboard()` | **bloqueado** (`acesso negado`) |
| **super_admin** | dashboard + criar/editar/status | ok + `admin_logs` |
| **escola suspensa** | aluno lê registros | **0** |
| **escola suspensa** | coordenação vê painel/alunos | **0 / 0** |
| **escola suspensa** | identidade (usuarios/escolas) | legível (tela de suspensão) |

## Infra
- Migrations 0026/0027 **aplicadas no live** e **idempotentes** (rodadas
  2× no `reset-db.sh` local sem erro/duplicação).
- Advisor de segurança `function_search_path_mutable`: **0** (era 2).
- Schools live após toda a validação: `vitrine` e `beta`, ambas
  `implantacao` — **estado inalterado** (rollbacks confirmados).
- Suíte de testes (Postgres 16 real, mesmas migrations): **222/222**.
- Build de produção: verde.

## Conclusão
Os fluxos críticos de produção respondem como esperado: isolamento por
papel, multitenancy, backoffice com porteiro e trilha, e o novo bloqueio
de escola suspensa. **Nenhum vazamento, nenhum P0.** Pronto para piloto
controlado, observadas as pendências P1/P2 de painel (auth/backup/
região/privacidade do repo) no relatório principal.
