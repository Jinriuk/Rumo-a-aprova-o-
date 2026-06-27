# DB1-C — Auditoria de RLS e Policies

> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`. Levantamento via
> `pg_policies` + `get_advisors` + suíte de testes de isolamento/suspensão.

## 1. Estado geral

- **RLS ativa em 100% das tabelas** de `public` (44/44).
- Isolamento multi-tenant uniforme: quase toda política filtra por
  `escola_id = app.tenant_id()`.
- Modelo de papéis via helper `app.papel()` (`coordenacao`/`aluno`/
  `responsavel`) + `app.usuario_id()` + `app.meu_aluno_id()` +
  `app.sou_responsavel_de()`.
- Bloqueio de escola suspensa (S1) presente: `app.tenant_operacional()`
  aparece nas políticas de escrita/listagem da coordenação e nas de
  aluno/responsável das tabelas-chave. **Não foi enfraquecido.**

## 2. Cobertura por papel (verificado em teste)

A suíte `tests/isolamento.test.mjs` + `tests/suspensao-db.test.mjs`
(rodadas ao vivo nesta DB1 contra Postgres local, **222/222 pass**)
exercita:

| Papel | Comportamento esperado | Resultado |
|---|---|---|
| `anon` (sem login) | não lê nada de tenant; backoffice bloqueado | ✅ |
| `authenticated` sem perfil | sem `tenant_id` → não vê dados | ✅ |
| aluno | vê só o próprio aluno/registros/simulados | ✅ |
| responsável | vê só alunos vinculados (`sou_responsavel_de`) | ✅ |
| coordenação | vê a escola inteira (se operacional) | ✅ |
| superadmin | backoffice via RPC gateada | ✅ |
| escola **suspensa** | aluno/responsável/coordenação **param**; identidade segue legível p/ a tela | ✅ |
| escola **ativa** | tudo opera | ✅ |

## 3. Categorias de tabela por política de leitura

- **Catálogo público autenticado** (`qual = true` para `authenticated`):
  `assuntos`, `atividades_modelo`, `concursos`, `config_oficial`,
  `conquistas`, `disciplinas`, `materias`, `missoes`, `patentes`,
  `prova_dias`, `prova_materias`, `provas`, `provas_anteriores`,
  `questoes_prova`, `recorrencia_assunto`, `subassuntos`,
  `trilha_plano_missoes`, `trilha_planos`, `trilha_semanas`,
  `turmas_comerciais`, `turmas_comerciais_concursos`. `trilhas` usa
  `qual = publicada`.
  > **Avaliação:** aceitável — são catálogos de conteúdo, não-PII, iguais
  > para todas as escolas. Nenhum expõe dado de aluno. Não enfraquecer.
- **Multi-tenant estrito** (`escola_id = tenant_id()` + papel): núcleo,
  logs, gamificação por aluno, config_escola.
- **Por aluno/responsável**: `alunos`, `registros_estudo`, `simulados`,
  `metas`, `aluno_*`, com ramo `aluno_id = meu_aluno_id()` /
  `sou_responsavel_de(aluno_id)`.
- **Superadmin**: `internal_admins`, `admin_logs` gateados por
  `app.eh_super_admin()`.

## 4. Achados de policies (advisor `multiple_permissive_policies`)

7 tabelas têm **duas políticas PERMISSIVE para `SELECT`/`authenticated`**
(uma `_select` + uma `FOR ALL` da coordenação) — o Postgres avalia ambas
em todo SELECT (custo de performance, **não** falha de segurança):

| Tabela | Políticas | SELECT da coordenação coberto por `_select`? |
|---|---|---|
| `aluno_conquistas` | `conq_coordenacao` (ALL) + `conq_select` | ✅ sim (mesma escopo) |
| `aluno_niveis` | `aluno_niveis_coordenacao` (ALL) + `aluno_niveis_select` | ✅ |
| `aluno_onboarding` | `aluno_onboarding_coordenacao` (ALL) + `aluno_onboarding_select` | ✅ |
| `aluno_xp_eventos` | `xp_coordenacao` (ALL) + `xp_select` | ✅ |
| `config_escola` | `config_escola_coordenacao` (ALL) + `config_escola_select` | ✅ (`_select` = qualquer papel do tenant) |
| `missoes_escola` | `missoes_escola_coordenacao` (ALL) + `missoes_escola_select` | ✅ |
| `vinculos_responsaveis` | `vinculos_coordenacao` (ALL) + `vinculos_responsavel_select` | ⚠️ **NÃO** — o `_select` é só do responsável; a coordenação enxerga **somente** pela política ALL |

### Por que NÃO foi corrigido na DB1

Tentar remover a sobreposição troca a política `FOR ALL` por políticas de
escrita (INSERT/UPDATE/DELETE) separadas, deixando o SELECT a cargo da
`_select`. Para 6 das 7 tabelas isso é **comprovadamente equivalente**.
**Mas em `vinculos_responsaveis` não é**: a coordenação só tem SELECT via
a política `FOR ALL`; removê-la **quebraria a leitura da coordenação**.
Como a regra da DB1 proíbe "reescrever RLS inteira" e exige equivalência
provada **sem risco de quebrar coordenação**, e o ganho é apenas de
performance em tabelas hoje pequenas/vazias, a decisão é:

> **Deixar para DB2** uma migration de de-duplicação cuidadosa
> (separar leitura/escrita da coordenação, com política de SELECT
> explícita para `vinculos_responsaveis`), com teste de não-regressão por
> papel. Documentado em `08-riscos-remanescentes.md` (P2).

## 5. Search_path de funções ligadas a policies

Todas as funções usadas em políticas (`app.tenant_id`, `app.papel`,
`app.usuario_id`, `app.meu_aluno_id`, `app.sou_responsavel_de`,
`app.tenant_operacional`, `app.eh_super_admin`) têm `search_path` fixo
(`""` ou `public, app`). Advisor de segurança
`function_search_path_mutable` = **0**. Nada a corrigir aqui (já fechado
na S1 0006/0026). Ver `03-rpcs-funcoes-views.md`.

## 6. Grants

`anon` revogado das superfícies sensíveis (backoffice, view de resumo) —
confirmado na S1 e mantido. `service_role` só existe server-side
(migrations/edge), **nunca no front** (ver `05`/relatório final).

## 7. Veredito RLS

RLS **sólida, isolada por escola, com bloqueio de suspensão intacto**.
Nenhuma política permissiva-demais perigosa; o único ajuste pendente é de
**performance** (duplicidade de SELECT) e foi **deliberadamente adiado**
para DB2 por causa do caso `vinculos_responsaveis`. **Nada foi
enfraquecido na DB1.**
