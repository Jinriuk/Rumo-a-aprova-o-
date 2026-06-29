# 07 — Auth, Usuarios e Identidades (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: auth.users (contagens e padroes), usuarios, internal_admins.
> Nenhum email real exposto neste documento.

## 1. Estado do Auth

| Item | Valor |
|------|-------|
| Total auth.users | 76 |
| Usuarios confirmados (email_confirmed_at NOT NULL) | 76/76 (100%) |
| Usuarios ativos nos ultimos 30 dias | 9 |
| Usuarios novos nos ultimos 7 dias | 10 |
| Identidades (auth.identities) | 65 |
| Provider | email (todos) |

## 2. Padroes de Email (sem expor valores reais)

| Tipo | Count |
|------|-------|
| Emails demo explicitos (*demo*) | 3 |
| Emails com dominio .local (fake) | 70 |
| Emails reais (dominio .com, .net, .br) | 3 |

OBSERVACAO: 73/76 usuarios (96%) tem emails falsos (.local) ou demo.
Apenas 3 usuarios tem email real — provavelmente o superadmin e coordenadores reais.

## 3. Distribuicao de Usuarios por Escola e Papel

| Escola | Papel | Count |
|--------|-------|-------|
| Matriz Educacao RM (vitrine) | aluno | 60 |
| Matriz Educacao RM (vitrine) | coordenacao | 2 |
| Matriz Educacao RM (vitrine) | responsavel | 2 |
| Curso Beta Preparatorio (beta) | aluno | 1 |
| Curso Beta Preparatorio (beta) | coordenacao | 1 |
| Curso Beta Preparatorio (beta) | responsavel | 1 |
| Escola Piloto I1 (piloto-i1) | aluno | 5 |
| Escola Piloto I1 (piloto-i1) | coordenacao | 2 |
| Escola Piloto I1 (piloto-i1) | responsavel | 1 |
| Colegio e Curso Icone (iconemilitar) | coordenacao | 1+ |

## 4. Alunos Sem Vinculo Auth

| Item | Valor |
|------|-------|
| Alunos sem usuario_id | 2 |
| Distribuicao | Provavelmente alunos de demo criados antes do provisionamento Auth |

IMPLICACAO: 2 alunos nao podem fazer login. Risco operacional baixo (sao demo).

## 5. Superadmin

| Item | Valor |
|------|-------|
| internal_admins | 1 |
| Nome | Gabriel Pecanha |
| Ativo | sim |
| Criado em | 2026-06-20 |

## 6. Perguntas de Auditoria

| Pergunta | Resposta |
|----------|----------|
| Ha aluno sem Auth? | SIM — 2 alunos sem usuario_id (demo) |
| Ha Auth sem perfil em usuarios? | NAO verificado diretamente (coluna user_id ausente em usuarios) |
| Ha responsavel revogado ainda com acesso? | NAO — revogacao exclui vinculo fisicamente |
| Ha credencial demo publica? | Sim — emails .local e senhas padrao de demo |
| Ha necessidade de desacoplar codigo de senha? | Verificar — sistema usa email+senha para alunos |
| Ha risco de brute force no login por codigo? | Mitigado — Supabase tem rate limiting nativo |
| Leaked Password Protection ativa? | NAO — recurso Pro apenas (julio) |

## 7. Riscos Identificados

### Credenciais Demo em Producao
Emails .local com senhas possivelmente padrao estao em producao na mesma instancia que
a escola candidata real (Icone). Se um aluno real for provisionado sem rotacionar as credenciais
demo, ha risco de confusao. Recomendacao: rotacionar ou remover credenciais demo antes de PR1.

### Nao ha Separacao de Projetos
Auth.users de demo e real estao na mesma instancia. Conforme documentado em SEG2,
a separacao (Opcao A: projeto separado) ainda nao foi implementada.
Classificacao: P2 — nao bloqueia piloto controlado, mas deve ser feito antes de piloto amplo.
