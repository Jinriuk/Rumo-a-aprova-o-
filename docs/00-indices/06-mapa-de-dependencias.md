# Mapa de Dependências entre Fases

**Atualizado em:** 2026-06-27 (pós-SEG2)

---

## Grafo de dependências (linha moderna)

```
QA1
 └─► S1
      └─► DB1 ─► DB2
                 └─► D1A ─► D1B ─► D1C ─► HF1 ─► H1
                                                 ├─► AV2        (auditoria funcional)
                                                 ├─► I2         (onboarding)
                                                 ├─► PED-UX1    (plano×trilha/UX)
                                                 ├─► HF2        (provisionar-aluno CORS)
                                                 └─► HF3 ─► SEG1 ─► SEG2 ─► PR1
                                                                            ├─► I1 (implantação)
                                                                            ├─► P1 (pedagógica)
                                                                            └─► M1 (monitoramento)
```

> Fases de build (14.5 → 17) e fases iniciais (A, B-min, C0, C0.5, R, C1, D0)
> precedem toda a linha moderna e estão em `docs/fases/` e `docs/auditoria/antigos/`.

---

## Dependências por fase (resumo)

| Fase | Depende de | Habilita |
|------|-----------|----------|
| S1 | QA1 (vitrine auditável) | DB1 |
| DB1 → DB2 | S1 | alterações de banco seguras |
| D1A → D1B → D1C | DB2 estável | provisionamento e acesso |
| HF1/HF2/HF3 | D1B/D1C (funções e fluxos existentes) | correções de produção |
| H1 | funcionalidades operacionais prontas | docs e higiene |
| AV2 / PED-UX1 | HF2 mergeado | coerência funcional e UX |
| I2 | D1B (provisionamento) | onboarding sem SQL |
| SEG1 → SEG2 | HF3 (`main` estável) | segurança de produção |
| PR1 | SEG2 | I1, P1, M1 |

---

## Dependências técnicas cruzadas

| Componente | Depende de |
|-----------|------------|
| RLS (todas) | Migrations `0001` → `0032`+ em sequência |
| Edge Functions | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (env Supabase) + `ALLOWED_ORIGINS` (CORS) |
| Front-end | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (env Vercel) |
| Email / convites | SMTP no Supabase Auth |
| CI gate | `app/package-lock.json` + `tests/package-lock.json` |

---

## Restrições permanentes (não mudam entre fases)

- **Nunca expor `service_role` no front** — `grep -r "service_role" app/src/` deve retornar vazio (guardado por teste de CI)
- **Nunca criar migration fora de PR revisado** — risco de lock em produção
- **Nunca alterar produto/RLS em fase de higiene ou documentação** — só docs
- **Nunca apagar registro de auditoria histórico** — ele é movido para `auditoria/antigos/`, nunca deletado
