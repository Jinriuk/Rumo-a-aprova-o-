# EST1-C (SEC3b) — Handoff de configuração e decisão da credencial opaca

**Data:** 2026-07-14 · **Base:** `main` = `0fbf951` (pós-EST1-B / PR #68)
**Natureza:** este bloco é, em boa parte, **configuração do seu projeto Supabase**
(não código) + **uma mudança de auth de risco alto** que precisa de janela dedicada.
Este documento separa o que é seu (config, abaixo) do que é código (a decisão no fim).

> **Por que EST1-C é diferente de A e B.** As correções A1–A5 e B1–B3 eram
> auto-contidas e 100% verificáveis neste ambiente (banco local + build). A SEC3b
> depende de **plano Pro**, de **configuração do GoTrue** e — no caso da credencial
> opaca — de trocar o caminho de login de **todos os alunos**, o que **não é
> verificável sem um Supabase vivo** (é exatamente a lacuna de E2E do EST0). Por
> isso o design (`sec3/modelo-credencial-opaca.md`) sempre reservou isso para uma
> "janela dedicada com rollback ensaiado".

---

## Parte 1 — Configuração que só você aplica (independe de código)

Todos os itens abaixo são toggles/ajustes no painel do Supabase do **projeto de
produção** (o dedicado, `sa-east-1`/Pro — ver EST1-B handoff item 5). Nenhum exige
mudança de código.

| # | Item | Onde | Fecha (EST0) |
|---|------|------|--------------|
| 1 | **Leaked Password Protection** (recusa senhas vazadas via HaveIBeenPwned) | Authentication → Policies → "Leaked password protection" (recurso Pro) | SEGURANCA-04 / 6.4 |
| 2 | **Política de senha server-side** (mín. 8, exigir letra+número) | Authentication → Policies → "Minimum password length" + requisitos | SEGURANCA-04 (a força hoje é validada só no cliente, contornável pela API) |
| 3 | **Rate limit do login** (tentativas por IP em `/token`) | Authentication → Rate Limits → "Token refresh / Sign in" (ajustar do padrão) | SEGURANCA-02 / 6.3 (trava do GoTrue, vigente enquanto o login vai direto) |
| 4 | **MFA (TOTP) habilitado no projeto** | Authentication → Providers → "Multi-Factor Authentication (TOTP)" — habilita o recurso | SEGURANCA-03 (pré-requisito do item de código de MFA abaixo) |

> Item 4 apenas **habilita** o recurso no projeto. Fazer o super_admin de fato
> usar 2FA exige um **fluxo de inscrição (enrollment) na UI** — isso é código
> (front + checagem de AAL nas Edge Functions de backoffice), listado abaixo.

---

## Parte 2 — Decisão sobre o código da credencial opaca (é sua escolha)

O item grande de código da SEC3b é desacoplar o **código que a escola entrega**
(hoje = a senha do GoTrue, `provisionar-aluno:205 password: codigo`) do **segredo
que autentica**, com um proxy `login-codigo` que aplica rate limit próprio e
resolve o código por **hash** (design completo em `sec3/modelo-credencial-opaca.md`).

**Por que não fiz isso autonomamente agora:**

1. **Muda o login de produção de todos os alunos** — o design exige janela
   dedicada com rollback ensaiado ("mudar o caminho de auth sem migração seria
   irresponsável", §2.79 do design).
2. **Não é verificável aqui** — sem GoTrue vivo, não consigo provar que a emissão
   de sessão pelo proxy funciona ponta a ponta; meus testes cobririam só o
   banco/fonte, não o login real.
3. **Precisa de uma decisão sua** — os **códigos (bilhetes) já entregues** aos
   alunos: migrar por hash-no-primeiro-login (transparente) ou reprovisionar em
   lote (novos bilhetes)? Isso afeta o que está na mão dos alunos.
4. **Depende do plano Pro / projeto dedicado** — que ainda não existe (EST1-B §5).

**Mitigação vigente (aceita e documentada):** a entropia do código é CSPRNG
~7,6×10¹⁷, o que já inviabiliza brute-force; o raio é pequeno (piloto controlado);
e o rate limit do GoTrue (item 3 acima) é a trava enquanto o login vai direto.
Ou seja: **não há P0/P1 aberto aqui** — é dívida arquitetural P2, não brecha
explorável barata.

### As três formas de tocar isto (escolha sua)

| Opção | O que eu faço | Risco | Quando faz sentido |
|-------|---------------|-------|--------------------|
| **A — Fundação dormente** | Tabela de hash + rate-limit em SQL (DB-testável) + Edge `login-codigo`, tudo **aditivo**; o login atual segue intacto. O corte de produção fica para sua janela. | Baixo (nada muda em produção) | Se quer adiantar a base agora e cortar depois |
| **B — Só quando houver Pro** | Deixo a fundação para quando o projeto Pro/`sa-east-1` existir, e faço a virada + migração dos bilhetes numa janela sua, com validação em staging | Nenhum agora | Se prefere não ter código dormente no repo |
| **C — DB3 antes** | Pulo a SEC3b e faço o DB3 (remoção física das 4 tabelas deprecadas da 15.5) — mas isso é **destrutivo** (drop de tabelas com dados preservados) e também merece seu OK | Médio (irreversível) | Se quer limpar o schema para auditoria de comprador |

**Minha recomendação:** **Opção A** — construo a fundação da credencial opaca de
forma aditiva e dormente (o login de produção não muda, então é seguro e
reversível), com os testes de banco cobrindo a parte crítica (hash, rotação,
revogação, contagem de rate limit). A virada de produção e a migração dos
bilhetes ficam para a janela em que o projeto Pro estiver de pé — com validação
em staging, como o design manda. Assim adiantamos o trabalho verificável sem
tocar em nada que eu não consiga provar.

Me diga **A, B ou C** (ou outra direção) que eu sigo.
