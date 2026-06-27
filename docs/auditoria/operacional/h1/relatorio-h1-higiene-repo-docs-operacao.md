# H1 — Higiene de Repositório, Documentação e Pendências Operacionais

**Data:** 2026-06-24  
**Branch:** `claude/h1-higiene-repo-docs-operacao`  
**Pré-requisito:** HF1 mergeada (PR #30, 2026-06-24) ✅

---

## Resumo executivo

A fase H1 foi concluída com sucesso. Foram criados índices consolidados da documentação, relatórios operacionais, plano de implantação de escola nova, investigação de alunos sem credencial, e atualizado o `docs/README.md`. O build de produção passa sem erros. Nenhuma alteração de produto, RLS, migration ou configuração de Supabase remoto foi feita.

---

## Escopo e restrições

| Restrição | Respeitada |
|-----------|-----------|
| Não alterar produto visual | ✅ |
| Não alterar lógica pedagógica | ✅ |
| Não mexer em RLS | ✅ |
| Não criar migration | ✅ |
| Não mexer em Supabase remoto (salvo read-only) | ✅ |
| Não mexer em billing, região, backup, SMTP | ✅ |
| Não apagar branch sem registrar motivo | ✅ |
| Não apagar documento histórico | ✅ |
| Não expor secrets | ✅ |
| Não commitar senha/token/dado sensível | ✅ |

---

## H1-A — Índices principais (docs/00-indices/)

**Criados:**

| Arquivo | Conteúdo |
|---------|---------|
| `docs/00-indices/01-mapa-geral-do-projeto.md` | Stack, fases, escolas, links rápidos |
| `docs/00-indices/02-linha-do-tempo.md` | Cronologia QA1 → H1 → PR1 |
| `docs/00-indices/03-status-atual.md` | Estado do sistema em 2026-06-24 |
| `docs/00-indices/04-o-que-ler-primeiro.md` | Guia de leitura por perfil |
| `docs/00-indices/06-mapa-de-dependencias.md` | Dependências entre fases |
| `docs/00-indices/07-pendencias-para-piloto-real.md` | P0/P1/P2/P3 para PR1 |

---

## H1-B — Mapa de fases (integrado nos índices)

O mapa de fases está em `docs/00-indices/01-mapa-geral-do-projeto.md` e `docs/00-indices/02-linha-do-tempo.md`. Sequência documentada:

```
QA1 → S1 → DB1 → DB2 → D1A → D1B → D1C → HF1 → H1 → PR1
```

Fases futuras planejadas: I1, P1, M1, R1.

---

## H1-C — Relatório de branches

**Criado:** `docs/operacao/github/relatorio-branches-h1.md`

| Branch | Situação | Recomendação |
|--------|---------|-------------|
| `claude/av1-auditoria-geral-jaoscu` | +1 ahead, -2 behind | Preservar |
| `claude/demo-base-realista-auditoria-t5ji99` | +8 ahead, -91 behind | Preservar, revisar |
| `claude/naval-system-build-g9h0t5` | +0 ahead, -52 behind | Pode deletar |
| `claude/hf1-deploy-revogar-responsavel-cpey7k` | Mergeada (PR #30) | Pode deletar |

---

## H1-D — Repositório público — riscos documentados

**Criado:** `docs/operacao/github/repositorio-publico.md`

- Auditoria confirmou: `service_role` não está em `app/src/`
- `app/.env.production` contém apenas chaves públicas (URL + anon key)
- GitHub Secret Scanning ativo
- Procedimentos de resposta a vazamento documentados

---

## H1-E — Leaked Password Protection

**Criado:** `docs/operacao/supabase/leaked-password-protection.md`

- Status: **ATIVA** no projeto `bdjkgrzfzoamchdpobbl`
- Considerações para provisionamento (senhas temporárias) documentadas

---

## H1-F — Plano de implantação de escola nova (I1)

**Criado:** `docs/auditoria/i1/00-plano-implantacao-escola-nova.md`

10 etapas documentadas:
1. Criar escola no banco
2. Criar usuário de coordenação no Auth
3. Criar registro em `usuarios`
4. Definir `app_metadata`
5. Enviar convite de acesso
6. Verificar acesso da coordenadora
7. Criar turmas e importar alunos
8. Vincular responsáveis
9. Smoke test pós-implantação
10. Documentar implantação

---

## H1-G — Alunos sem credencial

**Criado:** `docs/auditoria/h1/alunos-sem-credencial.md`

| Resultado | Valor |
|-----------|-------|
| Total de alunos | 68 |
| Com `usuario_id` | 66 |
| Sem `usuario_id` (orphans) | **2** |
| Escola dos orphans | Curso Beta Preparatório (demo) |
| Nomes | Fernanda Sales Moreira, Thiago Bento Cardoso |
| Risco | P3 — baixo (escola demo, dados fictícios) |
| Ação tomada | Nenhuma (read-only) |

---

## H1-H — Pendências para piloto real

**Criado:** `docs/00-indices/07-pendencias-para-piloto-real.md`

Principais P0 identificados:
- SMTP com domínio real do piloto
- Escola real criada e testada
- Primeiro aluno real provisionado e com login validado

---

## H1-I — Verificações read-only

| Verificação | Resultado |
|-------------|---------|
| Edge Functions Supabase | 6 funções, todas ACTIVE |
| Migrations aplicadas | 32/32, última `0032_d1b_provisionamento_acessos` |
| Escolas cadastradas | 4 (2 demo, 2 reais) |
| Branches não mergeadas | 3 (`av1`, `demo-base`, `naval`) — ver H1-C |
| CI (gate `build-e-unitarios`) | Verde |
| Build de produção | ✅ 926 módulos, 0 erros |

---

## Documentação atualizada

**Atualizado:** `docs/README.md`

Adicionada seção `00-indices/` e atualizadas referências da `auditoria/` (D1A, D1B, D1C, HF1, H1, I1) e `operacao/` (github/, supabase/).

---

## Build de produção

```
npm run build
✓ 926 modules transformed.
✓ built in 7.76s
```

**Status:** ✅ Sem erros, sem regressions.

---

## Critérios de aceite — Status final

| Critério | Status |
|----------|--------|
| `docs/00-indices/` criado com 6 arquivos | ✅ |
| `docs/README.md` atualizado | ✅ |
| Relatório de branches criado | ✅ |
| Repositório público documentado | ✅ |
| Leaked Password Protection documentada | ✅ |
| Plano I1 criado | ✅ |
| Alunos sem credencial investigados | ✅ |
| Pendências PR1 listadas | ✅ |
| Build de produção passa | ✅ |
| Nenhuma alteração de produto/RLS/migration | ✅ |
| Branch commitada e pushada | ✅ |

---

## Próxima fase

**PR1 — Prontidão de Piloto Real**

Ver pendências em `docs/00-indices/07-pendencias-para-piloto-real.md`.
