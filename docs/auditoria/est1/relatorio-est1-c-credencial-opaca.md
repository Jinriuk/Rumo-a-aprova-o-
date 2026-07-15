# EST1-C — Fundação da credencial opaca (SEC3b) + spec do corte

**Data:** 2026-07-14 · **Base:** `main` = `0fbf951` (pós-EST1-B)
**Branch:** `claude/system-analysis-stabilization-mif9b2`
**Decisão:** Opção A (a mais segura) — fundação **aditiva e dormente**; o login de
produção **não muda**. O corte fica para uma janela dedicada, com o passo exato
especificado abaixo.

## Resultado

**2 correções de código entregues**, cada uma com teste e commit. Suíte
**509 → 518 verdes** (+9 testes), migrations + seed 2× (idempotência). O login de
produção segue exatamente como estava — nada foi trocado.

| # | Item | Commit | Migration | Testes |
|---|------|--------|-----------|--------|
| C1 | Fundação SQL: hash, rotação, revogação, rate limit | `14225e8` | `0044` | +7 |
| C2 | `provisionar-aluno` grava o hash (aditivo) + portas public | `33b1645` | `0044` | +2 |

---

## O que foi construído (e por que é seguro)

O problema (EST0 SEGURANCA-02): o código que a escola entrega ao aluno **é** a
senha do GoTrue e o login vai direto ao Auth — sem rotação independente e sem
trava de tentativas própria. Não é P0/P1 (o código é CSPRNG ~7,6×10¹⁷), é dívida
arquitetural P2.

A fundação (`0044`), **sem tocar no login atual**:

- **`app.acessos_codigo`** — guarda só o **hash** SHA-256 do código (nunca o
  código em claro), por usuário, com `escola_id`, rotação e revogação. Fica no
  schema `app` (fora do PostgREST) e só o `service_role` acessa.
- **`app.login_tentativas`** — ledger de tentativas para o rate limit.
- **Funções** (service_role, com portas `public.*_codigo_acesso` para o Edge):
  - `registrar_codigo` — grava o hash (já chamado pelo `provisionar-aluno`);
  - `rotacionar_codigo` — **gira o código mantendo a identidade** (resolve o C-2:
    hoje girar o código exigia recriar a conta);
  - `revogar_codigo` — invalida sem apagar (auditoria);
  - `resolver_codigo` — rate limit por IP + lookup por hash, **trabalho uniforme**
    (sempre hasheia, sempre registra a tentativa — não vaza por timing).

**Por que é a opção mais segura:** é 100% aditiva. Nenhuma conta existente muda,
nenhum login é redirecionado, e a parte crítica (hash/rotação/revogação/rate
limit) está em SQL provada por 9 testes de banco. Se algo estivesse errado, o
`rollback` é um `drop` das peças novas — o produto não depende de nenhuma delas
enquanto o corte não acontecer.

**O que já dá para usar hoje:** todo aluno/responsável **novo** provisionado já
tem o hash gravado. E a rotação/revogação por SQL já existe e está testada —
pronta para ser ligada a um botão no backoffice quando você quiser.

---

## O corte de produção (janela dedicada — ainda NÃO feito)

Isto é o que falta para o código deixar de ser a senha. **Não fiz autonomamente**
porque muda o login de todos os alunos e não é verificável sem um Supabase vivo —
precisa de staging e da sua decisão. Passo a passo, na ordem:

1. **Backfill dos bilhetes já entregues.** Os códigos antigos viraram hash só nos
   provisionamentos novos. Para os existentes, duas opções (sua decisão):
   - **hash-no-primeiro-login** (transparente, recomendado): o `login-codigo`, ao
     receber um código sem hash correspondente, valida pelo caminho atual e grava
     o hash na hora — migração silenciosa, os bilhetes na mão dos alunos seguem valendo;
   - **reprovisionar em lote**: gera bilhetes novos (invalida os antigos).
2. **Edge `login-codigo`** (nova função): recebe o código → `resolver_codigo_acesso`
   (rate limit + hash) → emite a sessão. Enquanto o `password` do GoTrue ainda for
   o código, ela assina com o código; após o passo 4, com a senha opaca.
3. **Front `entrarComCodigo`** (`app/src/shared/data/index.js`): trocar o
   `signInWithPassword` direto pela chamada ao `login-codigo`, atrás de um
   **feature flag** para rollback imediato.
4. **Senha opaca ≠ código** no `provisionar-aluno`: gerar um segredo CSPRNG
   independente como senha do GoTrue (o código deixa de ser a senha de fato).
5. **Validação em staging:** login válido/inválido/revogado/**rotacionado** +
   teste de brute-force (o rate limit barra) — o que eu não consigo fazer aqui.
6. **Rollback ensaiado:** o feature flag do passo 3 volta ao login direto.

## Config que você liga no Supabase (agora que tem Pro)

Independente do corte acima, estes toggles fecham o resto da SEC3b — todos no
painel do **projeto de produção**, sem código:

| Item | Onde | Fecha |
|------|------|-------|
| Leaked Password Protection | Auth → Policies | SEGURANCA-04 / 6.4 |
| Política de senha (mín. 8 + requisitos) server-side | Auth → Policies | SEGURANCA-04 |
| Rate limit de sign-in (ajustar do padrão) | Auth → Rate Limits | SEGURANCA-02 / 6.3 |
| Habilitar MFA (TOTP) no projeto | Auth → Providers | SEGURANCA-03 (pré-req do enrollment) |

> MFA para o super_admin, além de habilitar o recurso, precisa de um fluxo de
> inscrição na UI + checagem de AAL nas Edge Functions de backoffice — isso é
> código, para um próximo bloco (é opcional e não bloqueia o piloto).

## Aplicar no remoto

As migrations `0038`–`0044` provam-se limpas e idempotentes no reset local (2×),
mas **ainda não foram aplicadas no Supabase remoto**. Aplique a série no projeto
de produção (via `supabase db push` ou o fluxo de migrations do painel) no deploy.

## Como verificar

```bash
cd tests && bash reset-db.sh && npm test   # 518/518
```
