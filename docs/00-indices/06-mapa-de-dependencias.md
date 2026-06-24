# Mapa de Dependências entre Fases

**Atualizado em:** 2026-06-24 (H1)

---

## Grafo de dependências

```
QA1
 └─► S1
      └─► DB1
           └─► DB2
                └─► D1A
                     └─► D1B
                          └─► D1C
                               └─► HF1
                                    └─► H1
                                         └─► PR1
                                              ├─► I1
                                              ├─► P1
                                              └─► M1
```

---

## Dependências por fase

### QA1 (Motor pedagógico e vitrine)
- **Depende de:** nada (ponto de partida)
- **Bloqueava:** S1, todos os demais

### S1 (Segurança baseline)
- **Depende de:** QA1 (vitrine funcional para auditar)
- **Bloqueava:** DB1 (não faz sentido consolidar banco com segurança não auditada)

### DB1 (Consolidação Supabase)
- **Depende de:** S1 (segurança definida antes de inventariar)
- **Bloqueava:** DB2 (precisa do inventário para reconciliar)

### DB2 (Migrations consolidadas)
- **Depende de:** DB1 (inventário remoto)
- **Bloqueava:** D1A (migrations devem estar sincronizadas antes de alterações)

### D1A (Acesso coordenação)
- **Depende de:** DB2 (banco estável)
- **Bloqueava:** D1B (sem acesso de coordenação não se consegue provisionar)

### D1B (Provisionamento de alunos)
- **Depende de:** D1A (backoffice coordenador acessível)
- **Bloqueava:** D1C (precisa de alunos para testar recuperação de senha)

### D1C (Email e recuperação de acesso)
- **Depende de:** D1B (alunos provisionados para testar convites)
- **Bloqueava:** HF1 (funcionalidade de revogar responsável depende de responsáveis vinculados)

### HF1 (Hotfix revogar-responsavel)
- **Depende de:** D1B (responsáveis existem), D1C (fluxo de acesso completo)
- **Bloqueava:** H1 (higiene só após funcionalidades completas)

### H1 (Higiene e documentação)
- **Depende de:** HF1 (todas as funcionalidades operacionais prontas)
- **Bloqueava:** PR1 (go-live exige documentação e riscos mapeados)

### PR1 (Prontidão de piloto real)
- **Depende de:** H1
- **Bloqueava:** I1, P1, M1

---

## Dependências técnicas cruzadas

| Componente | Depende de |
|-----------|------------|
| RLS (todos) | Migrations `0001` → `0032` em sequência |
| Edge Functions | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (vars de ambiente Supabase) |
| Front-end | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (vars Vercel) |
| Email / convites | SMTP configurado no Supabase Auth |
| CI gate | `app/package-lock.json` + `tests/package-lock.json` |

---

## Restrições permanentes (não mudam entre fases)

- **Nunca expor `service_role` no front** — `grep -r "service_role" app/src/` deve retornar vazio
- **Nunca criar migration fora de PR revisado** — risco de lock em produção
- **Nunca alterar produto/RLS em H1 ou higiene** — apenas documentação
- **Nunca deletar arquivo de auditoria histórico** — registro permanente de decisões
