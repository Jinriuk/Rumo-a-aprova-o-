# D1A.1 — Correção do acesso da coordenação

> Fase **D1A.1** · branch `claude/d1a-coordenacao-backoffice-n0tx84` · data 2026-06-22
> Projeto **Rumo à Aprovação** · projeto Supabase `bdjkgrzfzoamchdpobbl`

Primeiro o bug, depois o backoffice. Este documento é só do **diagnóstico e
correção do acesso da coordenação**. A parte visual está no relatório final.

---

## 1. Sintoma

A área do **aluno** entrava normalmente; a área da **coordenação** "não estava
acessível": a pessoa logava com `coordenacao@vitrine.demo`, mas caía num painel
**vazio, sem dado e sem explicação** (alunos/turmas/ranking em branco) — o padrão
clássico de "entra mas não carrega painel / tela branca", sem erro no console.

---

## 2. Reprodução e investigação

A investigação foi feita **direto no banco de produção** (via MCP Supabase),
simulando o JWT real de cada papel com `set_config('request.jwt.claims', …)` +
`set role authenticated` — exatamente como o PostgREST aplica a RLS.

### 2.1 Auth e perfil — OK

| Verificação | Resultado |
|---|---|
| `auth.users` de `coordenacao@vitrine.demo` | existe, e-mail confirmado, não banido/excluído |
| Senha (`vitrine-coord-2026`) | confere (`crypt`) |
| `raw_app_meta_data` | `escola_id` e `papel='coordenacao'` corretos |
| Linha em `usuarios` | existe, `papel='coordenacao'`, `escola_id` correto |
| `internal_admins` | coordenação **não** está lá (não vira backoffice) ✓ |

> Conclusão parcial: **não é** login, senha, perfil, papel nem vínculo.

### 2.2 Gates e RLS — o achado

A causa estava na combinação de **três fatos**:

**(a) A S1 tornou o status da escola um gate de RLS.** A migration
`0027_escola_suspensa_bloqueio` criou `app.tenant_operacional()` (TRUE quando a
escola **não** está `suspensa`/`cancelada`) e o injetou como `AND` em quase
todas as policies de leitura/escrita de dado operacional
(`alunos`, `turmas`, `metas`, `registros_estudo`, `simulados`, `consentimentos`,
`logs_acesso`, …) e na RPC `resumo_escola()`.

**(b) Reproduzindo a escola suspensa, o sintoma aparece idêntico.** Forçando
`escolas.status='suspensa'` numa transação e consultando como a coordenação:

| Consulta (como coordenação) | Resultado |
|---|---|
| `app.tenant_operacional()` | **false** |
| `usuarios` (próprio perfil) | **1** (visível) |
| `escolas` (a própria) | **1** (visível, `status='suspensa'`) |
| `alunos` / `turmas` / `metas` / `registros_estudo` | **0** |
| `resumo_escola()` | **0 linhas** |

Ou seja: a coordenação **loga, o `meuPerfil()` funciona, o `AreaEscola` monta —
e então TODA consulta de dado volta vazia, sem erro**. RLS não levanta exceção
quando não há linha; só devolve conjunto vazio. O painel fica morto e mudo.

**(c) O front é cego ao status.** `data/index.js → meuPerfil()` selecionava
`escolas(id, nome, slug, logo_url, cor_acento)` — **sem `status`**. Como
`escolas_select` **não** é filtrada por `tenant_operacional()` (de propósito: o
dono precisa enxergar a própria escola), o front *tinha como* ler o status e
explicar o bloqueio, mas **não lia**. Resultado: impossível distinguir
"operacional porém vazia" de "suspensa" → tela branca sem motivo.

### 2.3 Por que o aluno "funcionava" e a coordenação "não"

No estado de produção encontrado, as duas escolas-vitrine estavam em
`status='implantacao'` (default histórico da 0021), que `tenant_operacional()`
**considera operacional** — então, no instante do diagnóstico, os dois papéis
tecnicamente passavam. A assimetria percebida vem de dois pontos:

1. O **painel da coordenação é 100% data-driven** — sem dado, fica visivelmente
   vazio. A área do aluno tem mais andaime estático, então "parece" funcionar.
2. O **checklist do backoffice** marcava "Acesso liberado" só com `status='ativa'`
   (`AreaAdmin.jsx`), enquanto a RLS liberava `implantacao`. Essa **divergência
   de semântica de status** (front exige `ativa`; banco aceita
   não-`suspensa`/`cancelada`) é o que fazia o operador ver a escola como
   "não liberada" e a coordenação cair em estados ambíguos.

### 2.4 Drift de migrations (por que o bug era difícil de enxergar)

O **repositório estava em 0024**; o **banco em 0030**. As migrations
**0025–0030 (D0, S1, DB1, DB2) foram aplicadas em produção e nunca commitadas**.
Sem elas no repo, era impossível reproduzir/auditar o comportamento da S1 a
partir do código — o que mascarou a causa.

---

## 3. Causa-raiz

> **A S1 (0027) passou a esconder todo o dado da escola quando ela não está
> operacional (`suspensa`/`cancelada`). O front nunca lia `escolas.status`, então
> uma escola não-operacional (ou em estado de status ambíguo como `implantacao`)
> produzia um painel de coordenação vazio e sem explicação — interpretado como
> "coordenação sem acesso". Agravado por: (i) as escolas-vitrine não estarem
> `ativa`; (ii) o checklist do backoffice exigir `ativa` enquanto a RLS aceitava
> `implantacao`; (iii) as migrations 0025–0030 nunca terem sido commitadas
> (drift repo↔banco).**

Onde quebrou: na **fronteira front↔RLS** introduzida pela S1 — não no login, não
no Auth, não no isolamento. A RLS estava **correta**; faltava o front **lê-la e
traduzi-la**, e faltava o status da vitrine estar coerente.

---

## 4. Correção (causa-raiz, sem afrouxar segurança)

| # | Correção | Arquivo |
|---|---|---|
| 1 | `meuPerfil()` passa a selecionar `status` da escola | `app/src/shared/data/index.js` |
| 2 | Helper puro `escolaOperacional()` espelha `app.tenant_operacional()` | `app/src/shared/data/operacional.js` |
| 3 | Tela **"Acesso suspenso"** clara quando a escola não opera (em vez de painel vazio) | `app/src/App.jsx` |
| 4 | Status das escolas de **vitrine/demo** (`vitrine`, `beta`) corrigido para `ativa` | `supabase/migrations/0031_d1a_vitrine_status_ativa.sql` |
| 5 | Checklist do backoffice deixa de exigir `ativa` e reflete **operacional** | `app/src/routes/admin/AreaAdmin.jsx` |
| 6 | **Reconciliação**: migrations 0025–0030 commitadas verbatim (fim do drift) | `supabase/migrations/0025…0030_*.sql` |

### O que NÃO foi feito (limites respeitados)

- ❌ Não afrouxou RLS · ❌ não removeu `tenant_operacional()` · ❌ não removeu o
  bloqueio de escola suspensa · ❌ não liberou cross-tenant · ❌ nenhum
  `service_role` no front · ❌ e-mail da coordenação **não** hardcodado.
- O bloqueio de suspensa/cancelada **continua sendo do banco**. O front apenas o
  **torna legível**.

### Sobre o status da vitrine (regra 12)

A migration 0031 só promove a `ativa` quem está em estado de pré-ativação
(`implantacao`/`demo`/`piloto`) e **apenas** as escolas de demonstração
(`slug in ('vitrine','beta')`) — dado de vitrine, **não** dado real de cliente.
Nunca "reativa no escuro" uma escola que o operador tenha suspendido. Aplicada e
registrada em `schema_migrations` (`20260622011627`).

---

## 5. Evidência (matriz validada no banco de produção)

Simulando o JWT de cada papel (transações com rollback):

| # | Cenário | Esperado | Obtido |
|---|---|---|---|
| 1 | coordenação · escola **ativa** | vê painel | 60 alunos · resumo 60 ✓ |
| 2 | coordenação · escola **suspensa** | bloqueada | tudo 0 ✓ |
| 3 | aluno · escola ativa | vê próprio dado | 1 aluno · 3 metas · 15 reg. ✓ |
| 4 | aluno · escola suspensa | bloqueado | tudo 0 · `meu_aluno_id` null ✓ |
| 5 | responsável · escola ativa | vê vinculado | 1 vínculo · 1 aluno ✓ |
| 6 | responsável · escola suspensa | bloqueado | tudo 0 ✓ |
| 7 | superadmin → backoffice | acessa | `sou_super_admin`=true · 2 escolas ✓ |
| 8 | coordenação → backoffice | negado | `sou_super_admin`=false · RPC "acesso negado" ✓ |
| 9 | coordenação vê outra escola | não | escola B = 0 · alunos B = 0 ✓ |
| 10 | RLS habilitada | sim | 12/12 tabelas-chave `true` ✓ |

Estado final das escolas: `vitrine → ativa`, `beta → ativa`.

### Evidência de que a RLS NÃO foi enfraquecida

- Tests 2/4/6: a escola suspensa esconde **todo** o dado de aluno — o gate da S1
  segue de pé.
- Test 9: coordenação isolada à própria escola.
- Test 10: RLS habilitada em todas as tabelas-chave.
- Test 8: backoffice continua negando quem não é super_admin (porteiro no banco).
- Advisors de segurança: só WARNs **esperados** (RPCs `SECURITY DEFINER` do
  backoffice, todas com porteiro `eh_super_admin()` interno) + 1 config de Auth
  (leaked-password protection desligada — P3).

---

## 6. Testes

- `tests/operacional.test.mjs` — unidade, **3/3 OK** aqui (espelho do gate).
- `tests/coordenacao-acesso-db.test.mjs` — RLS da S1 (ativa × suspensa ×
  cancelada, 3 papéis + isolamento + porteiro D0). Requer Postgres local
  (`tests/reset-db.sh`); **validado em produção via MCP** (matriz acima) por não
  haver PG neste ambiente.
- `npm run build` (app) — **OK** (923 módulos, sem erro).

---

## 7. Pendências

- **P2** — Coordenação de escola **operacional** pode, hoje, alterar o `status`
  da própria escola (policy `escolas_update` só exige `id = tenant`). Não é furo
  cross-tenant (só afeta a própria escola, e se auto-suspender se trava), mas
  status deveria ser exclusivo do operador. Endurecer numa próxima fase.
- **P3** — Leaked-password protection desligada no Auth (config do projeto).
- **P3** — `escolas.status` no banco local de teste nasce `ativa` (default da
  0001) enquanto produção nasce `implantacao` (0021). Sem efeito no acesso, mas
  vale alinhar o default numa migration aditiva.
