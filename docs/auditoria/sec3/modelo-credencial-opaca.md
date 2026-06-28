# SEC3 — Modelo de credencial opaca (login por código)

**Fase:** SEC3 · **Data:** 2026-06-28
**Tarefas:** 69 (auditar credencial atual) · 70 (desacoplar código público da senha Auth) · 71 (rate limiting)
**Status:** **PLANEJADO / PARCIAL** — auditoria concluída, desenho fechado, implementação do
proxy deixada como migração planejada (fora do escopo "não rearquitetar Auth sem migração").

---

## 1. Como é hoje (auditoria — tarefa 69)

A escola provisiona aluno/responsável em `provisionar-aluno` (Edge Function, service role):

```
codigo  = CSPRNG, alfabeto sem 0/O/1/I/L, formato XXXX-XXXX-XXXX  (≈ 31^12 ≈ 7.6e17)
email   = <codigo-sem-hifen>@codigo.acesso.local
password = <codigo-sem-hifen>            ← a senha do Auth É o próprio código
```

No login (`app/src/shared/data/index.js → entrarComCodigo`):

```js
supabase.auth.signInWithPassword({
  email: `${canonico.toLowerCase()}@codigo.acesso.local`,
  password: canonico,                    ← mesmo código, reutilizável
});
```

### Riscos classificados

| # | Risco | Severidade | Observação |
|---|-------|-----------|------------|
| C-1 | **O código público É a senha reutilizável.** Quem vê o código uma vez (bilhete, foto, ombro) autentica para sempre. | **P2** | Mitigado pela entropia alta (CSPRNG) e raio pequeno (base demo/piloto). Não é segredo derivável. |
| C-2 | **Não há rotação independente.** Trocar o código = recriar a conta Auth (revogar+reprovisionar). Não dá para "girar a senha" mantendo a identidade. | P2 | Hoje o fluxo de revogação existe; é manual. |
| C-3 | **Login vai direto ao GoTrue** sem proxy → o rate limiting fica restrito ao que o GoTrue oferece de fábrica (ver tarefa 71). | P2 | Sem brute-force barato por causa da entropia, mas sem trava de tentativas própria. |
| C-4 | E-mail sintético `@codigo.acesso.local` **expõe o código no e-mail** (o local-part É o código). | P3 | O e-mail nunca é mostrado ao usuário; vive só no Auth interno. |

**Conclusão da auditoria:** não é P0/P1. A entropia do código (CSPRNG, ~10^17) torna o
brute-force inviável e o código não é adivinhável a partir de nome/escola. O problema real é
**arquitetural** (acoplamento código↔senha, rotação cara), não uma brecha explorável barata.

---

## 2. Modelo-alvo: credencial opaca desacoplada (tarefa 70)

Separar **o que a escola entrega** (código público, amigável, descartável) de **o que autentica**
(segredo opaco, alto, rotacionável), com um **proxy de login** no servidor no meio.

```
┌─────────────┐   código    ┌──────────────────────┐   senha opaca   ┌─────────┐
│   Front     │ ──────────▶ │  Edge: login-codigo   │ ──────────────▶ │ GoTrue  │
│ (só o código)│            │  (service role)        │  (nunca no front)│  Auth   │
└─────────────┘ ◀────────── └──────────────────────┘ ◀────────────── └─────────┘
                 sessão                rate limit + lookup por HASH do código
```

### Peças

1. **Tabela `acessos_codigo`** (schema `app`, sem PostgREST, só service role):
   - `usuario_id uuid`, `codigo_hash bytea` (SHA-256 do código normalizado + sal por linha),
     `escola_id`, `revogado_em`, `expira_em null`, `criado_em`.
   - O código em claro **nunca** é persistido (nem no Auth): só o hash.
2. **Senha Auth = segredo opaco** independente (CSPRNG ≥ 32 bytes), **diferente do código**.
   Guardada cifrada/derivável só no servidor (ou substituída por sessão emitida via
   `admin.generateLink`/`createSession`). O front nunca a vê.
3. **`provisionar-aluno`** passa a: gerar código (devolve uma vez), gerar senha opaca, gravar
   `acessos_codigo` com o **hash** do código, criar o usuário Auth com a senha opaca.
4. **`login-codigo`** (nova Edge Function):
   - recebe o código; aplica **rate limit** (tarefa 71) por IP+código;
   - resolve `usuario_id` por `codigo_hash` com **comparação em tempo constante**;
   - autentica no GoTrue com a senha opaca e devolve a sessão ao front.
5. **Rotação** (C-2 resolvido): girar o código = novo hash em `acessos_codigo` + nova senha
   opaca, **mantendo `usuario_id`** (mesma identidade, mesmo histórico). Revogar = `revogado_em`.

### Por que não foi implementado agora

- O front autentica **direto** no GoTrue. Desacoplar de verdade **exige** o proxy `login-codigo`
  emitindo a sessão — mudar o caminho de autenticação de todos os alunos/responsáveis.
- O escopo da camada proíbe "**alterar toda a arquitetura de Auth sem migração planejada**".
  Trocar o login de produção sem janela e rollback ensaiado seria irresponsável.
- Mitigação vigente aceita: **entropia CSPRNG alta + raio pequeno (piloto controlado)**, com
  este desenho pronto para executar numa janela dedicada (ver checklist abaixo).

---

## 3. Rate limiting do login por código (tarefa 71)

| Camada | Estado | Decisão |
|--------|--------|---------|
| GoTrue (Supabase Auth) | **Ativo de fábrica** | O Supabase aplica rate limit por IP em `/token` (sign-in). É a trava vigente enquanto o login vai direto ao GoTrue. |
| Proxy `login-codigo` + tabela `tentativas_login` | **Planejado** | Quando o proxy entrar (item 2 acima), trava própria: N tentativas/janela por IP+código, backoff, sem DoS (conta tentativa, não bloqueia conta legítima). |

**Risco aceito documentado:** hoje não há tabela de tentativas própria porque o login não passa
por servidor nosso. A trava efetiva é a do GoTrue + a entropia do código. Quando o proxy
`login-codigo` for implementado (junto do desacoplamento), a contagem própria entra com ele.
Critério de aceite da camada ("tentativas excessivas são limitadas **ou** bloqueio documentado
com risco aceito") fica satisfeito pela trava do GoTrue + este registro.

---

## 4. Checklist de execução (janela dedicada, pós-SEC3)

- [ ] Migration: tabela `app.acessos_codigo` (hash + sal), grants só service_role, sem PostgREST.
- [ ] `provisionar-aluno`: gerar senha opaca ≠ código; gravar hash do código; criar Auth com senha opaca.
- [ ] Edge `login-codigo`: rate limit + lookup por hash (tempo constante) + emissão de sessão.
- [ ] Front `entrarComCodigo`: trocar `signInWithPassword` direto por chamada ao `login-codigo`.
- [ ] Migração das contas existentes: gerar hash a partir do código atual no primeiro login OU
      reprovisionar em lote (decisão de produto — afeta os bilhetes já entregues).
- [ ] Testes: login válido/ inválido/ expirado/ revogado/ **rotacionado** + brute force em staging.
- [ ] Rollback ensaiado: feature flag para voltar ao login direto se o proxy falhar.

---

## 5. Veredito SEC3

- **Tarefa 69 (auditar):** ✅ concluída — riscos C-1..C-4 classificados (P2/P3, sem P0/P1).
- **Tarefa 70 (desacoplar):** 🟡 **planejado** — desenho fechado e executável; implementação do
  proxy fica para janela dedicada (restrição de escopo). Mitigação vigente: entropia CSPRNG.
- **Tarefa 71 (rate limit):** 🟡 trava do GoTrue vigente + plano do proxy; **risco aceito documentado**.

> Critério de aceite "credencial pública não funciona como senha reutilizável **sem mitigação
> documentada**": atendido como **mitigação documentada** (entropia + raio pequeno + desenho de
> desacoplamento pronto). O acoplamento permanece até a janela do proxy — declarado aqui, não escondido.
