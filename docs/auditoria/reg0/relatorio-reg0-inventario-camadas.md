# Relatório REG0 — Registro Vivo das Lacunas e Fonte Única de Verdade

**Fase:** REG0 (governança) · **Data:** 2026-06-27
**Branch:** `claude/reg0-registro-vivo-camadas-faltantes`
**Base:** `claude/docs-reorganizacao` (reorg de docs + deploy SEG2; **não** mergeados na `main` ainda)
**Natureza:** somente documentação — **não altera produto, banco, RLS, Auth, segurança, migrations, telas, staging, backup, domínio ou SMTP.**

---

## 1. Objetivo

Persistir o inventário das 10 camadas faltantes como **documento vivo**, substituindo a leitura
defasada da auditoria multivisão (Fase 18, ~74/100), e servir de base para as fases RC1 → ARCH1.

## 2. Entregáveis

| Arquivo | Conteúdo |
|---|---|
| `docs/00-indices/05-camadas-faltantes.md` | Inventário completo (camadas 1–10): status, evidência, fase responsável, prioridade; síntese por prioridade; tabela de dependências; quadro de decisão |
| `docs/00-indices/05-camadas-faltantes-resumo-executivo.md` | Resumo de 1 página (veredito, 4 lajes, decisão) |
| `docs/auditoria/reg0/relatorio-reg0-inventario-camadas.md` | Este relatório (método, evidências, aceite) |

## 3. Método

1. **Catálogo:** as 12 visões da Fase 18 (`auditoria/antigos/fase18-multivisao/01-13`) + verificação
   técnica (13) + matriz AV2 (`auditoria/produto/av2/07-matriz-de-problemas.md`).
2. **Cruzamento:** com SEG1/SEG2 (`auditoria/seguranca/seg1|seg2`), H1, I2, HF2/HF3, DB1/DB2, S1.
3. **Verificação no código atual** (não confiar em texto antigo) para todo item técnico marcado
   concluído/parcial — ver seção 4.
4. **Classificação:** cada item em concluído 🟢 / parcial 🟡 / aberto 🔴 / bloqueado ⛔ (julho/Pro/
   domínio/staging/SMTP) / fora de escopo ⚪.

## 4. Evidências de verificação no código (amostragem)

| Item | Comando/arquivo | Resultado | Marcação |
|---|---|---|---|
| Motor persistido ligado à UI | grep `concederXp/salvarNivelAluno/carregarMissoes/salvarOnboarding` em `routes`/`modules` | não chamados por tela | 🔴 (C1) |
| Ledger C0 visível | `HistoricoProgresso.jsx:31` `carregarEventosProgresso({limite:50})` | ligado | 🟢 (1.6) |
| Agregação servidor | `supabase/migrations/0016_painel_agregado.sql` (usada em PainelGestao) | existe | 🟢 (4.1) |
| Paginação | `ListaAlunos.jsx:10` `import { paginar }`; controles "página X de Y" | pagina | 🟢 (4.2) |
| Índices de escala | `0023_indices_escala_coordenacao.sql` (`escola_id` em registros/metas/simulados/consentimentos) | existe | 🟢 (4.3) |
| Error Boundary | `app/src/shared/ui/ErroFronteira.jsx` | existe | 🟢 (7.1) |
| **Duplo envio** | `Registrar.jsx:49` `!ocupado` em `podeSalvar`; botão `disabled`+"Salvando…" (142-143) | **fechado** (corrigia texto antigo "a confirmar") | 🟢 (7.2) |
| TypeScript | `git ls-files app/src/**/*.ts(x)` | 0 arquivos | 🔴 (7.3) |
| Acessibilidade | `grep -rl htmlFor app/src` | 0 arquivos | 🔴 (8.1) |
| Papel professor | `check (papel in ('coordenacao','aluno','responsavel'))` | sem professor/tutor | 🔴 (3.1) |
| `timingSafeEqual` virada | `virar-semana/index.ts:25` `token !== …` | ainda `!==` | 🔴 (6.5) |
| `.env.production` | `git ls-files app/.env.production` | versionado | 🔴 (6.8) |
| CORS/headers/branch protection | SEG1/SEG2 (deploy 6 funções, sessão 2026-06-26/27) | concluído | 🟢 (6.1) |
| Backup/sa-east-1/E2E efêmero/LPP | docs SEG2 + status atual | bloqueio julho/Pro | ⛔ (5.3/5.4/9.2/6.4) |

## 5. Testes obrigatórios da camada (checklist)

- [x] **Revisão textual completa** dos documentos gerados (legíveis, todas as camadas presentes).
- [x] **Amostragem no código** para validar itens marcados "concluído" (seção 4).
- [x] **Nenhum item 🔴 marcado 🟢 sem evidência** — conferido item a item.
- [x] **Itens julho/Pro (⛔) não tratados como bloqueio de demo** — explicitado no quadro de decisão
      e na nota de governança.
- [x] **Segunda passada** item por item: nenhum requisito da camada ficou pendente, parcial ou
      "apenas documentado como feito" (este relatório é a 2ª passada).

> Observação sobre "revisão dupla como usuário real": REG0 não toca UI nem banco, então a 1ª
> passada (uso real com console) não se aplica; foi substituída por **verificação direta no
> código** dos itens técnicos, conforme regra "não confiar em texto antigo".

## 6. Critérios de aceite

| Critério | Atendido |
|---|---|
| Documento existe, legível, inclui todas as camadas (1–10) | ✅ |
| Cada item tem status, prioridade, evidência e próxima fase | ✅ |
| Itens fechados verificados no código/doc atual | ✅ (seção 4) |
| Itens pendentes não escondidos | ✅ |
| Tabela de dependências (qual camada destrava a seguinte) | ✅ |
| Quadro de decisão (demo / aluno real / Matriz / B2C / modalidades) | ✅ |
| Deixa claro que REG0 não altera produto, banco ou segurança | ✅ |

## 7. Itens fora de escopo (respeitados)

Corrigir bugs · criar telas · criar migrations · mexer em segurança/staging/backup/domínio/SMTP.
Nenhum foi tocado nesta camada.

## 8. Pendência de integração

Os deliverables vivem em `docs/00-indices/` e `docs/auditoria/reg0/`, sobre a branch de reorg.
Para virarem fonte de verdade na `main`, depende do merge de `claude/docs-reorganizacao` (reorg +
SEG2) e desta branch REG0. Recomendação: mergear reorg → REG0 em sequência, ou consolidar.

## 9. Resultado

**REG0 — concluído.** Fonte única de verdade criada e verificada. Próxima fase: **RC1 — varredura
funcional total** (`claude/rc1-varredura-funcional-total`).
