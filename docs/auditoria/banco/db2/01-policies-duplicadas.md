# DB2-B — Policies duplicadas (consolidação)

> Objetivo: zerar `multiple_permissive_policies` **sem alterar
> comportamento**. Migration aplicada: `0029_db2_policies_consolidadas.sql`.
> Teste dedicado: `tests/policies-consolidadas.test.mjs`.

## 1. Situação inicial (advisor)

7 tabelas tinham **2 políticas PERMISSIVE aplicáveis a SELECT** para
`authenticated` (uma `FOR ALL` da coordenação + uma `_select`):
`aluno_conquistas`, `aluno_niveis`, `aluno_onboarding`,
`aluno_xp_eventos`, `config_escola`, `missoes_escola`,
`vinculos_responsaveis`.

## 2. Mapeamento e decisão por tabela

### Grupo 1 — 6 tabelas (split FOR ALL → escrita)
`aluno_conquistas`, `aluno_niveis`, `aluno_onboarding`,
`aluno_xp_eventos`, `config_escola`, `missoes_escola`.

- **`_coordenacao` (FOR ALL)** — USING/WITH CHECK =
  `escola_id = tenant_id() AND papel() = 'coordenacao'`.
- **`_select`** — já concede SELECT à coordenação no mesmo escopo
  (para as 4 `aluno_*`, o ramo `papel()='coordenacao'`; para
  `config_escola`/`missoes_escola`, `_select` = `escola_id = tenant_id()`,
  ainda mais amplo).
- **Equivalência provada:** o SELECT da `FOR ALL` é redundante com a
  `_select`. Substituímos a `FOR ALL` por 3 políticas de escrita
  (`_coord_ins`/`_coord_upd`/`_coord_del`) com a **mesma** condição. A
  coordenação continua lendo via `_select` e escrevendo via as novas.
- **Suspensão:** essas tabelas **não** tinham `tenant_operacional()` no
  gate (decisão pré-existente) — **não** adicionamos; comportamento
  idêntico.

### Grupo 2 — `vinculos_responsaveis` (merge de SELECT)
- **`vinculos_coordenacao` (FOR ALL)** = `escola_id=tenant_id() AND
  papel()='coordenacao' AND tenant_operacional()`.
- **`vinculos_responsavel_select`** = `escola_id=tenant_id() AND
  responsavel_id=usuario_id() AND tenant_operacional()`.
- Aqui a coordenação **só lia pela FOR ALL** — não dava para apenas
  separar escrita. Unimos as duas leituras numa **única** policy de
  SELECT equivalente (a união exata):
  ```
  vinculos_select: escola_id=tenant_id() AND tenant_operacional()
                   AND (papel()='coordenacao' OR responsavel_id=usuario_id())
  ```
  e mantivemos as escritas da coordenação (`vinculos_coord_ins/upd/del`)
  com `tenant_operacional()` preservado.

## 3. Critérios de aceite — verificados

| Critério | Como foi provado |
|---|---|
| Nenhum acesso novo aberto | união exata das condições; teste de não-vazamento entre escolas |
| Nenhum acesso legítimo bloqueado | coordenação/responsável continuam vendo o que viam (teste) |
| Escola suspensa continua bloqueando | `tenant_operacional()` preservado em `vinculos`; teste suspensão verde |
| aluno/responsável/coordenação/superadmin OK | suíte completa 227/227 |
| Advisor zerado | `multiple_permissive_policies`: **7 → 0** (get_advisors pós-migration) |

## 4. Testes

`tests/policies-consolidadas.test.mjs` (5 novos) +
`isolamento`/`suspensao-db` existentes. Suíte: **227/227 pass**.
Asserções-chave:
- cada uma das 7 tabelas tem **exatamente 1** policy permissiva de SELECT;
- coordenação mantém INSERT/UPDATE/DELETE e **não** sobra `FOR ALL`;
- coordA não vê `config_escola`/`vinculos` de outra escola;
- responsável só vê os próprios vínculos;
- escola suspensa zera o SELECT de `vinculos` da coordenação.

## 5. Rollback

Para reverter, recriar as policies originais (texto exato no histórico do
git e no dump da DB1 `02-rls-policies.md`): `*_coordenacao` como `FOR ALL`
e `vinculos_responsavel_select` como SELECT do responsável; e dropar as
`*_coord_ins/upd/del` e `vinculos_select`. Tudo não destrutivo.
