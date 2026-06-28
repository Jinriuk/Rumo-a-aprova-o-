# SEC3 — Endurecimentos restantes de segurança — Relatório

**Fase:** SEC3 · **Data:** 2026-06-28
**Branch:** `claude/sec3-security-hardening-wye9a6`
**Projeto demo:** `bdjkgrzfzoamchdpobbl` (plano Free)
**Base:** SEG1/SEG2 concluídas (CORS allowlist, headers nota A, branch protection, CodeQL/Dependabot/Secret
Protection, RLS multi-tenant). Esta camada fecha os **riscos residuais**.

---

## 0. Resumo executivo

| # | Tarefa | Estado | Evidência |
|---|--------|--------|-----------|
| 69 | Auditar login por código / credencial | ✅ **Concluído** | `modelo-credencial-opaca.md` §1 |
| 70 | Desacoplar código público da senha Auth | 🟡 **Planejado (mitigação documentada)** | `modelo-credencial-opaca.md` §2 |
| 71 | Rate limiting no login por código | 🟡 **Risco aceito documentado** (GoTrue + plano de proxy) | `modelo-credencial-opaca.md` §3 |
| 72 | Leaked Password Protection | ✅ **Doc correto: INATIVO (gate de plano Free)** | SEG2 §01 + H1 doc corrigido |
| 73 | `timingSafeEqual` em comparação sensível | ✅ **Concluído + testado** | `virar-semana/index.ts`, `sec3-endurecimento-edge` |
| 74 | Blindar `virar_semana` por escola | ✅ **Concluído + testado** | migration `0035`, `sec3-virar-semana-escola-db` |
| 75 | Atomicidade LGPD banco + Auth | ✅ **Concluído + testado** | migration `0036`, `lgpd-titular/index.ts`, `sec3-lgpd-atomicidade-db` |
| 76 | Limpeza de `.env.production` | ✅ **Concluído: só chave pública, mantido e documentado** | §6 abaixo |

**Build:** verde · **Testes:** 434 passam, 0 falham (suíte completa, Postgres real, 2 execuções) ·
**Secret scan:** nenhum `service_role`/segredo novo no repo ou no front.

> Nenhum item foi marcado "concluído" por aparência: cada ✅ tem código + teste ou doc com estado
> verídico. Os 🟡 (70/71) são honestamente **parciais/planejados** porque exigem rearquitetar o
> caminho de Auth — explicitamente **fora do escopo** desta camada — e ficam com mitigação aceita.

---

## 1. Auditoria do login por código (T69) e desacoplamento (T70)

Detalhe completo em **`modelo-credencial-opaca.md`**. Síntese:

- **Como é:** o código público (CSPRNG, `XXXX-XXXX-XXXX`, ~10^17 de espaço) **é a própria senha**
  do Auth (`password = codigo`). Acoplamento código↔senha; rotação cara.
- **Risco:** **P2**, não P0/P1 — a entropia alta inviabiliza brute-force e o código não é
  derivável. O problema é arquitetural (reuso + rotação), não brecha barata.
- **Alvo desenhado:** credencial **opaca** (senha Auth ≠ código), código guardado só como **hash**
  numa tabela `app.acessos_codigo`, e um **proxy `login-codigo`** que faz rate limit + lookup em
  tempo constante + emite a sessão. Rotação passa a manter a identidade.
- **Por que não foi ligado agora:** desacoplar de verdade muda o caminho de login de TODOS os
  alunos/responsáveis (hoje o front fala direto com o GoTrue). A regra da camada proíbe
  "alterar toda a arquitetura de Auth sem migração planejada". Fica o **desenho executável** +
  checklist + rollback, e a mitigação vigente (entropia + raio pequeno do piloto).

---

## 2. Rate limiting do login (T71)

- **Vigente:** o GoTrue (Supabase Auth) aplica rate limit por IP no endpoint de sign-in de fábrica.
  Enquanto o login vai direto ao GoTrue, é esta a trava efetiva — somada à entropia do código.
- **Planejado:** com o proxy `login-codigo`, entra uma tabela `tentativas_login` (N/janela por
  IP+código, backoff, sem DoS — conta tentativa, não bloqueia conta legítima).
- **Risco aceito:** registrado em `modelo-credencial-opaca.md` §3. Critério de aceite
  ("limitadas **ou** bloqueio documentado com risco aceito") satisfeito.

---

## 3. `timingSafeEqual` (T73)

**Antes** — `supabase/functions/virar-semana/index.ts`:
```ts
if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) { ... 403 }
```
`!==` em string **sai no primeiro byte diferente** → o tempo de resposta vaza quantos bytes do
segredo o atacante acertou (oráculo de timing).

**Depois** — comparação **constante no tempo**, sobre o **hash SHA-256** dos dois lados (não vaza
nem o comprimento), sem ramo de saída antecipada:
```ts
async function timingSafeEqual(a, b) {
  const [ha, hb] = await Promise.all([digest(a), digest(b)]);
  let diff = 0; for (...) diff |= x[i] ^ y[i]; return diff === 0;
}
```
Único ponto do repo com comparação direta de segredo (varredura confirmou). Travado por teste de
regressão (`sec3-endurecimento-edge`: exige `timingSafeEqual`, proíbe o `token !== Deno.env`).

---

## 4. `virar_semana` por escola (T74)

**Problema:** `app.virar_semana()` / `motor_virar_semana()` são **globais** — fecham e geram metas
de **todas** as escolas. Operador não conseguia virar uma escola sem mexer nas outras.

**Mudança (migration `0035`, ADITIVA — a global e o cron 0004 ficam intactos):**
- `app.virar_semana(p_escola uuid, p_hoje date)` — **todo efeito preso a `escola_id`**
  (`update metas ... where ... and escola_id = p_escola`; loop só de `alunos.escola_id = p_escola`).
- `public.motor_virar_semana_escola(p_escola)` — porta para a Edge Function.
- **Permissão:** `revoke` de `public/authenticated/anon` + `grant` só ao `service_role` (igual à
  global). Nenhum papel de escola dispara.
- **Validação:** recusa `NULL` (não vira "todas" por engano) e exige escola existente. **Idempotente.**
- A Edge Function `virar-semana` aceita `escola_id` opcional: presente → escopo de escola; ausente
  → global (comportamento histórico preservado).

**Testes (`sec3-virar-semana-escola-db`, Postgres real):** virar A gera meta do Lucas e **não toca
B**; virar A **não fecha** meta vencida da B; virar B fecha só a da B; idempotência; `NULL`/escola
inexistente recusados; `authenticated` recebe `permission denied`. **Critério "virada não afeta
escola errada": atendido.**

---

## 5. Atomicidade LGPD banco + Auth (T75)

**Problema:** a exclusão LGPD apaga em **dois sistemas sem transação comum** — Postgres
(`app.lgpd_excluir`) e o Auth/GoTrue (`deleteUser`). `usuarios.id` = id do `auth.users`, mas **sem
FK** entre eles. A ordem antiga apagava o **banco primeiro**, depois o Auth no loop: se o Auth
falhasse, sobrava **conta órfã que ainda autentica** (estado quebrado silencioso).

**Mudança:**
- Migration `0036`: `app.lgpd_usuarios_do_aluno(p_aluno)` — **somente leitura**, devolve as contas
  que cairão (a do aluno + responsáveis sem outro vínculo), espelho exato de quem `lgpd_excluir`
  remove. Grant só `service_role`.
- `lgpd-titular/index.ts` reescrita com ordem **à prova de meio-termo**:
  1. levanta a lista (leitura, antes de apagar nada);
  2. apaga o **Auth primeiro**, de forma **idempotente** (`getUserById` → conta ausente = sucesso);
  3. se **alguma** remoção falhar de verdade → **ABORTA**: o banco fica **intacto**, o pedido é
     **retryável**, e o log registra `exclusao-lgpd-abortada` (não silencioso);
  4. só com o Auth **todo limpo**, apaga o banco. Se o banco falhar depois, log alto
     `exclusao-lgpd-db-falha` (retry seguro pela idempotência do Auth).
- Resultado: **ou os dois lados saem, ou o banco permanece íntegro** — nunca o órfão silencioso.

**Testes (`sec3-lgpd-atomicidade-db` + `sec3-endurecimento-edge`):** a lista bate exatamente com a
remoção real; exclui responsável de vínculo único e **preserva** o de vínculo múltiplo; é
somente-leitura; aluno inexistente levanta (não devolve vazio); `authenticated` não lê a lista; e a
inspeção de fonte trava a ordem **listar → Auth → banco** + o aborto em falha parcial.
**Critério "LGPD não deixa estado quebrado silencioso": atendido.**

---

## 6. `.env.production` (T76)

**Decisão: MANTER, com apenas chaves públicas — documentado.**

- Conteúdo: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. A anon key foi **decodificada**:
  `role: anon`, `ref: bdjkgrzfzoamchdpobbl` — **publicável por design** (a segurança é a RLS).
- Por que não remover: o **CI** (`/.github/workflows/ci.yml`) e o build de produção dependem deste
  arquivo (front sem segredo); o `.gitignore` o libera explicitamente (`!app/.env.production`)
  exatamente por ser público. Removê-lo quebraria o gate sem ganho de segurança.
- **Risco:** baixo e conhecido — anon key é pública; o que protege o dado é a RLS, não o sigilo da
  chave. A `service_role` **nunca** entra aqui (regra reafirmada no cabeçalho do arquivo).
- **Padrão final:** só chaves públicas versionadas; qualquer segredo vive nas variáveis do Supabase
  (Edge Functions) e na máquina do operador. Travado por teste (`sec3-endurecimento-edge` T76:
  decodifica e exige `role=anon`; proíbe valor real de `service_role` no `.env`).

---

## 7. Leaked Password Protection (T72)

Sem mudança de estado (correto): **INATIVO** — recurso exclusivo do plano **Pro** (projeto em
**Free**). A política de senha já foi endurecida no possível (≥ 8 chars + letras e dígitos, afeta só
a coordenação; aluno/responsável usam código CSPRNG). Docs já refletem o estado verídico
(`docs/auditoria/seguranca/seg2/01-leaked-password-protection.md` e o H1 já corrigido em
`docs/operacao/supabase/leaked-password-protection.md`). Checklist de ativação no Pro permanece.
**Critério "antes do Pro, docs com estado INATIVO correto": atendido.**

---

## 8. Revisão dupla

**1ª passada (funcional, banco real):** subi Postgres 16, apliquei as 36 migrations + seed (2x,
idempotência) e rodei a suíte. As funções novas foram exercitadas ao vivo: virada escopada gera só
a meta da escola A (B = 0), escola inexistente levanta, `lgpd_usuarios_do_aluno` devolve Lucas +
responsável. Build do front verde.

**2ª passada (item por item):** cada tarefa 69–76 reconferida contra seu critério de aceite (tabela
§0). Os itens 70/71 estão honestamente como **planejado/risco aceito** (não "concluído"), porque a
parte que falta exige rearquitetar Auth — fora do escopo. Nenhum requisito da camada ficou marcado
como feito sem evidência.

**Regressão nos 4 perfis:** mudanças são **aditivas** e isoladas ao servidor —
- *aluno / responsável:* login inalterado (mesmo `signInWithPassword`); LGPD/virada não são chamadas por eles.
- *coordenação:* exclusão LGPD agora é mais segura (Auth antes do banco, aborta limpo) e a mensagem
  de erro de aborto é nova; exportação inalterada.
- *superadmin/backoffice:* virada por escola é ferramenta nova de operador (service role), não
  altera os fluxos existentes; a global e o cron seguem idênticos.

**Antes/depois:** comportamento — só adições; logs — novas ações `exclusao-lgpd-abortada` /
`exclusao-lgpd-db-falha` (auditoria mais rica); tabelas — 0 colunas alteradas, 3 funções novas;
Edge Functions — 2 endurecidas; UI — sem mudança; performance — virada por escola é mais barata que
a global (varre um tenant).

---

## 9. Rollback

- Migration `0035`: `drop function public.motor_virar_semana_escola(uuid); drop function app.virar_semana(uuid, date);`
  (a virada global e o cron não dependem delas).
- Migration `0036`: `drop function public.lgpd_usuarios_do_aluno(uuid); drop function app.lgpd_usuarios_do_aluno(uuid);`
  (`app.lgpd_excluir` segue sozinha — fallback do fluxo antigo).
- Edge Functions: revert por git (arquivos auto-contidos; nenhuma migração de dados envolvida).

---

## 10. Pendências honestas (não fechadas nesta camada)

- **T70 — proxy `login-codigo` + credencial opaca:** desenho pronto; execução em janela dedicada
  (muda o login de produção; precisa de feature flag + rollback ensaiado).
- **T71 — tabela de tentativas própria:** entra junto do proxy. Hoje: trava do GoTrue (risco aceito).
- **T72 — ativar LPP:** depende de assinar o Pro (não autorizado nesta camada).

Nenhuma destas é P0/P1; todas têm mitigação vigente documentada.
