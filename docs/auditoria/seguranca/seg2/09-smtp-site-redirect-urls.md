# SEG2 / S2-J — SMTP, Site URL e Redirect URLs

**Fase:** SEG2 · **Data:** 2026-06-26
**Pendência herdada:** D-2 (Manual)
**Referência:** `seg1/04-auth-supabase.md`.

---

## 1. Estado atual (verificado ao vivo pelo dono, 2026-06-26)

| Item | Valor | OK |
|------|-------|----|
| **Site URL** | `https://rumo-a-aprova-o.vercel.app/` | ✅ correta |
| **Redirect URLs** | `https://rumo-a-aprova-o.vercel.app/redefinir-senha` (sem wildcard amplo) | ✅ correta |
| **SMTP customizado** | **Ausente** (esperado no Free) | ⚠️ fallback manual |
| Recovery / convite coordenação | Funciona via **link gerado** (`backoffice-coordenador`) | ✅ |

---

## 2. SMTP — como funciona hoje (fallback manual)

A Edge Function `backoffice-coordenador` **gera o link de recuperação** e o devolve ao
backoffice quando o SMTP não está configurado (estados `…_email_pendente`). Ou seja, **o
sistema funciona sem SMTP**: o super admin **entrega o link manualmente** à coordenação.

- Aluno/responsável **não usam e-mail** (entram por código) → SMTP não os afeta.
- Coordenação: recebe o link de definição de senha pelo fallback manual.

---

## 3. Pendência para piloto amplo

| Cenário | SMTP |
|---------|------|
| **Piloto controlado pequeno** | Fallback manual **aceitável** (documentado) |
| **Piloto real amplo** | SMTP próprio **recomendado/bloqueante** (entrega automática, evita spam) |

**Checklist (julho, com domínio):**
- [ ] Configurar SMTP (Resend/SES/Postmark) em Supabase → Auth → SMTP.
- [ ] Verificar remetente (SPF/DKIM/DMARC no DNS do domínio — ver doc 10).
- [ ] Testar: recovery de senha, convite de coordenação → confirmar entrega (não-spam).
- [ ] Atualizar Site URL/Redirect URLs para o **domínio final** (ver doc 10).

---

## 4. Critério de aceite (SEG2)

> ✅ **Validado.** Site URL e Redirect URLs **corretas e sem wildcard amplo** (verificadas
> ao vivo). SMTP **ausente** mas com **fallback manual documentado e funcional** — aceitável
> para piloto controlado; **bloqueante para piloto amplo** (checklist para julho).
