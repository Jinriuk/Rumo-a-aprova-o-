# SEG2 / S2-B — Leaked Password Protection

**Fase:** SEG2 · **Data:** 2026-06-26
**Projeto:** `bdjkgrzfzoamchdpobbl` (plano **Free**)
**Pendência herdada:** D-1 (P2)

---

## 1. Estado atual (verificado ao vivo pelo dono, 2026-06-26)

| Item | Valor |
|------|-------|
| Leaked Password Protection | **DESATIVADO** |
| Motivo | Recurso **"Only available on Pro plan and above"** — projeto está em **Free** |
| Toggle no painel | **Desabilitado** (não é questão de configuração; é gate de plano) |
| Política de senha da coordenação | **Endurecida hoje:** mín. 6 → **8** caracteres, exigência **"Letters and digits"** (painel confirmou *"Successfully updated settings"*) |

> O endurecimento de senha (comprimento + complexidade) **foi aplicado** e independe do
> plano. Afeta só quem digita senha (**coordenação**); aluno/responsável usam código
> gerado (CSPRNG), não escolhem senha. Senhas atuais continuam válidas — a regra vale
> para novas senhas e redefinições.

---

## 2. Divergência de documentação a corrigir (honestidade)

Há um documento anterior — `docs/operacao/supabase/leaked-password-protection.md` (H1,
2026-06-24) — que afirma a proteção como **"✅ ATIVA"** e "nenhuma ação requerida".
**Isso está desatualizado/incorreto** à luz de:

- SEG1 `04-auth-supabase.md` (2026-06-25): Security Advisor reporta `auth_leaked_password_protection` **disabled** (WARN).
- Verificação ao vivo do dono (2026-06-26): toggle **desabilitado**, **bloqueado pelo plano Free**.

**Ação:** tratar o estado real como **desativado/bloqueado-por-plano**. O doc H1 deve ser
corrigido (ou marcado como histórico) quando o Pro for ativado e a proteção ligada de fato.
Não se deve apresentar a proteção como ativa enquanto o plano não permitir.

---

## 3. Impacto no sistema

- Afeta **apenas** senhas escolhidas por humano → **coordenação**.
- Aluno/responsável: **sem impacto** (código gerado, não é senha de escolha).
- Provisionamento (`provisionar-aluno`, `backoffice-coordenador`) usa `service_role` com
  senha aleatória forte (CSPRNG) — o risco de "senha vazada" não se aplica a essas contas.
- Logo: a ausência da proteção tem **raio de exposição pequeno** hoje (poucas contas de
  coordenação, base demo). **Não é P0/P1.** É **P2 / bloqueado-por-plano**.

---

## 4. Checklist manual — ativar quando o Pro entrar (julho)

- [ ] Assinar o plano **Pro** do projeto (ou do projeto de produção sa-east-1, se a
      migração de região acontecer junto — ver `docs/operacao/plano-migracao-sa-east-1.md`).
- [ ] Supabase → **Authentication → Sign In / Providers → (Password)** →
      ativar **"Leaked password protection"** (HaveIBeenPwned, k-anonimato).
- [ ] Manter comprimento mínimo **≥ 8** + **Letters and digits** (já configurado).
- [ ] Re-rodar `get_advisors(security)` e confirmar que o WARN
      `auth_leaked_password_protection` **sumiu**.
- [ ] Testar criação/reset de senha de coordenação com uma senha sabidamente vazada
      (ex.: `password`) e confirmar **rejeição**.
- [ ] Corrigir/arquivar `docs/operacao/supabase/leaked-password-protection.md` com o
      estado verídico e a data.

---

## 5. Critério de aceite (SEG2)

> ✅ **Atendido como pendência justificada.** A proteção não pôde ser ativada por ser
> **exclusiva do plano Pro** (projeto em Free) — limitação de plano, não de configuração.
> A política de senha foi endurecida no que era possível no Free. Fica **checklist manual
> claro com status pendente para piloto real amplo** (ativar no Pro, em julho).
> **Não bloqueia** piloto controlado pequeno (raio de exposição mínimo).
