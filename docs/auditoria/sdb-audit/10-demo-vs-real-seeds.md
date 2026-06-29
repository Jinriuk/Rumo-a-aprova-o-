# 10 — Demo vs Real: Seeds e Separacao (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: tabela escolas, auth.users por dominio, contagens.

## 1. Escolas Cadastradas

| Escola | Slug | Plano | Alunos | Tipo |
|--------|------|-------|--------|------|
| Matriz Educacao RM | vitrine | null | 60 | DEMO/SEED — escola vitrine |
| Curso Beta Preparatorio | beta | null | 3 | DEMO/SEED — escola beta |
| Escola Piloto I1 | piloto-i1 | piloto | 5 | TESTE — criada em I1 |
| Colegio e Curso Icone | iconemilitar | padrao | 0 | CANDIDATA REAL — 0 alunos |

## 2. Usuarios por Tipo

| Tipo | Count | Observacao |
|------|-------|-----------|
| Emails .local (fake) | 70 | Criados por seed/EF com dominio falso |
| Emails demo (contendo 'demo') | 3 | Credenciais de demo explicito |
| Emails reais (.com/.net/.br) | 3 | Superadmin + coordenadores reais |

## 3. Dados Demo Ativos em Producao

O projeto atual tem dados de demo misturados com a instancia de producao:
- 60 alunos da escola vitrine (todos com emails .local)
- 3 alunos da escola beta
- 5 alunos da escola piloto-i1
- 1002 eventos de progresso (gerados por demo/seed)
- 110 conquistas (geradas por demo)
- 295 metas semanais (geradas pelo motor semanal para alunos demo)
- 456 registros de estudo (gerados por seed)
- 54 simulados (gerados por seed)

## 4. Seeds do Repositorio

O arquivo supabase/seed.sql popula dados demo de forma idempotente.
Foi rodado 2x em ambiente de teste (DB1) sem problemas.
Contem: escola vitrine, alunos demo, trilha, semanas, metas iniciais.

## 5. Perguntas de Auditoria

| Pergunta | Resposta |
|----------|----------|
| O projeto pode receber aluno real? | SIM — mas na mesma instancia dos demos |
| O que precisa ser separado antes? | Projeto Supabase separado (Opcao A, documentado em SEG2) |
| Risco de aluno real em ranking demo? | SIM — rankings da vitrine incluiriam o aluno real |
| Risco de dados demo em relatorio real? | SIM — coordenacao da Icone veria resumo_escola correto (0 alunos), mas vitrine seria confusa |
| Credenciais demo publicas? | SIM — emails .local com senhas padrao existem |
| Separacao demo x real feita? | NAO — plano documentado, nao executado (SEG2 A-1) |

## 6. Escola Candidata Real (Icone)

| Item | Estado |
|------|--------|
| Escola criada no banco | SIM (criada em 2026-06-22) |
| Coordenacao criada | SIM (pelo menos 1 coordenador) |
| Alunos provisionados | NAO (0 alunos) |
| SMTP validado | NAO |
| Trilha configurada | NAO verificado |
| Primeiro login testado | NAO |

## 7. O Que Precisa Ser Feito Antes do Aluno Real

1. Separar projeto Supabase (demo vs real) — ou aceitar risco documentado
2. Rotacionar/remover credenciais demo da instancia de producao
3. Validar SMTP com dominio real da Icone
4. Provisionar primeiro aluno real via backoffice
5. Testar login end-to-end do aluno real
6. Testar recuperacao de senha com email real
7. Validar que o ranking da Icone NAO inclui dados demo
