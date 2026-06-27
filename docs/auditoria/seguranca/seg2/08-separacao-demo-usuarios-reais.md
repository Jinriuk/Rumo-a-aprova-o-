# SEG2 / S2-I — Separação demo × usuários reais

**Fase:** SEG2 · **Data:** 2026-06-26
**Pendência herdada:** A-1 / B-1 (P2)

---

## 1. O problema (da SEG1)

`scripts/seed-auth-usuarios.mjs` e seeds de vitrine contêm **senhas de contas de demo em
texto claro**, e o repositório é **público**. Qualquer pessoa pode logar como coordenação
da escola de **vitrine**. O raio é **limitado pela RLS à própria escola demo** (não vaza
outra escola), mas permite **escrever na vitrine**. Não há dado de aluno **real** nessas
escolas hoje.

---

## 2. Opções

### Opção A — Projeto separado para real (recomendado para piloto)
- Projeto **demo** continua com dados/credenciais de vitrine públicos.
- Projeto **real** (idealmente **sa-east-1**, Pro) recebe alunos reais; **sem** seeds de demo.
- Alinha com `docs/operacao/lgpd-e-infra.md` (gate: dado real **não** em us-east-1 demo) e
  com a criação do staging (doc 07).

### Opção B — Rotacionar demo (se mantiver um único projeto)
- Rotacionar as senhas/códigos de demo e **parar de versioná-las**.
- Marcar a **escola demo** claramente (flag/nome) e **separar** dos dados reais.
- Impedir que dados de demo entrem em relatórios/decisões reais.

---

## 3. Decisão e plano

> Decisão do dono: Pro + (provável) projeto de produção em **julho**, após a 1ª escola.
> Até lá, a base é **demo pública assumida**. **Antes do 1º aluno real:** executar a
> **Opção A** (projeto real separado) — é a que respeita o gate LGPD para menores.

**Checklist antes do 1º aluno real:**
- [ ] Criar projeto de produção separado (sa-east-1, Pro) — ver docs 06/07 e
      `operacao/plano-migracao-sa-east-1.md`.
- [ ] Aplicar migrations + **só seeds de catálogo** (sem seeds de demo).
- [ ] Apontar o front de produção para o projeto real (`VITE_*` na Vercel).
- [ ] Reprovisionar Edge Functions + `SUPABASE_SERVICE_ROLE_KEY` no projeto real.
- [ ] Manter o demo público como vitrine, claramente rotulado.
- [ ] Garantir que nenhum seed/script com dado **real** seja versionado (repo público — doc 02 §5).

---

## 4. Critério de aceite (SEG2)

> ✅ **Plano de separação definido.** Demo × real não estão separados hoje (base ainda é
> demo), mas a **Opção A está escolhida e com checklist** para antes do 1º aluno real.
> **Bloqueante para piloto com aluno real**, não para demo.
