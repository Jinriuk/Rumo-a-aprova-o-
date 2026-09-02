# ADR-0004: Congelamento de funcionalidades (Princípio 4)

**Data:** 02/09/2026
**Etapa:** 1

## Contexto
Existe uma branch (`claude/jornada-transformadora-uxg2-r2-806vu0`) com trabalho de produto pronto e não mergeado, e o plano exige congelar tudo que não destrave risco, venda, conteúdo ou receita.

## Decisão
Até decisão em contrário, só entra trabalho de engenharia que resolva:
1. os cinco P1 da auditoria de 25/08 (provisionamento de coordenação, produção apontando pro demo, backup/restore não comprovado, pacote LGPD de menores, conteúdo/coorte sustentável);
2. a migration 0045 (`rls_auto_enable`, ver ADR-0002);
3. a decisão sobre a branch `uxg2-r2` (mergear ou descartar).

Nenhuma funcionalidade nova além disso nesta janela.

## Consequência
Prioriza os bloqueadores que já têm dono, evidência e prazo em vez de abrir frente nova de produto.
