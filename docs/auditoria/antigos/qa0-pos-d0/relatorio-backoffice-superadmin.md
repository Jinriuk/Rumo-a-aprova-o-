# Relatório Backoffice / Superadmin — QA0 pós-D0

## Status

- Login de superadmin NÃO foi executado (regra: não faço login com senha em nome do usuário). Avaliação de telas internas e ações de estado (criar/editar/suspender/reativar escola, vincular coordenador) requer operador humano dirigindo o login.
- O que foi possível afirmar indiretamente, com evidência:
  - As RPCs de backoffice existem (backoffice_criar_escola, backoffice_dashboard, backoffice_definir_status, backoffice_detalhe_escola, backoffice_editar_escola, backoffice_escolas) — vistas no Security Advisor.
  - São SECURITY DEFINER e o Advisor as marca como chamáveis por usuário logado (ver SEC-1).
  - Pela Coordenação (não-admin): sou_super_admin() = false, internal_admins e admin_logs retornam vazio. Ou seja, a checagem de privilégio interna está barrando quem não é admin — bom sinal, mas a superfície segue exposta (SEC-1).
  - Migration 0025_backoffice_d0 aplicada — backoffice D0 está no banco.

## Achados

| ID | Achado | Área | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|------|---------|------|----------|---------|------|
| BO-1 | RPCs de backoffice expostas a authenticated (SECURITY DEFINER sem REVOKE) | superadmin | Médio (detalhe em SEC-1) | P1 | REVOKE EXECUTE / SECURITY INVOKER / schema fora da API | Médio | S1 |
| BO-2 | Bloqueio de rota /admin-interno para não-admin não testado ativamente | superadmin | Não verificado | P1 | Operador: logar como coordenação e confirmar que /admin-interno é bloqueada no front E no banco | Baixo | C1 |
| BO-3 | Ciclo criar/editar/suspender/reativar escola + admin_logs não testado | superadmin | Não verificado (ações de escrita; fora de escopo read-only) | P1 | Operador executar em escola de teste e conferir registro em admin_logs | Médio | C1 |

## Pendência declarada

Esta área é a menos coberta por exigir login privilegiado e ações de escrita. Não inventei avaliação do que não testei. Recomendo uma sessão guiada com o operador. Trocar a senha do superadmin ao encerrar a auditoria.
