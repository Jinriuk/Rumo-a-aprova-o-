# Backup, retenção e LGPD (Fase A.1)

> Este documento consolida, em formato de **política operacional**, o que
> já está levantado em `docs/lgpd-e-infra.md` (inventário de dados, gate
> de região) e `docs/monitoramento-backup.md` (o que monitorar). Aqui o
> foco é: o que fazer, com que frequência, e quem decide.

## Backup

| Item | Status | Responsável |
|---|---|---|
| Backup automático do Supabase (PITR/snapshot diário, conforme plano) | ⚠ pendente — depende do plano contratado (free tier tem retenção curta) | operador/infra |
| Export manual periódico (dump `pg_dump`), guardado fora do Supabase | ⚠ pendente — recomendado enquanto o automático não está confirmado | operador |
| Backup **antes de toda migration sensível** (que apaga/transforma dado) | ✓ já é processo documentado (`deploy-checklist.md`) | quem aplica a migration |
| Teste de restauração (validar que o backup realmente restaura) | ⚠ pendente — fazer ao menos uma vez antes do piloto real | operador/infra |

**Pendência clara para o piloto**: antes de qualquer escola real, confirmar
no painel do Supabase (Settings → Database → Backups) qual é a janela de
retenção do plano ativo, e decidir se um export manual semanal é
suficiente ou se é preciso upgrade de plano. Isto é decisão de
infraestrutura/custo, não de código — registrado aqui para não ser
esquecido, não resolvido a force por este trabalho.

## Retenção de dados

- **Durante a relação com a escola**: dado de aluno/responsável fica
  retido normalmente (é o propósito do sistema).
- **Após a saída de um aluno/escola**: ainda não há uma política de prazo
  definida (ex.: "apagar 90 dias após o fim do contrato"). **Decisão
  pendente do dono do produto** — não é uma decisão técnica que este
  trabalho deva tomar unilateralmente. Quando definida, registrar aqui a
  regra e, se precisar de automação, criar rotina equivalente à
  `virar-semana` (Edge Function agendada) que aplica `lgpd-titular`
  (exclusão) em lote.
- **A pedido do titular** (LGPD, a qualquer momento): já existe e
  funciona — Edge Function `lgpd-titular` com duas ações:
  - `exportar`: devolve o dossiê completo do aluno (dado estruturado,
    sem PII de terceiros).
  - `excluir`: remove o aluno e os dados associados (registros, metas,
    simulados, contas de acesso) — ação irreversível, com confirmação
    explícita na tela (`ListaAlunos.jsx`).

## Trilhas de auditoria relevantes para LGPD

- **`logs_acesso`**: quem leu dado de um aluno específico, quando, qual
  ação (trilha de acesso, exigida pela LGPD para dado de menor).
- **`logs_coordenacao`** (novo, Fase A.8): ações sensíveis da coordenação
  sem aluno associado (turma criada/renomeada/excluída, alunos importados
  em lote, marca alterada) — não é trilha LGPD por titular, é auditoria
  operacional da escola.
- **`admin_logs`**: ações do operador (criação de escola, etc.).

Nenhuma dessas trilhas grava dado sensível em si (nome de aluno, CPF,
etc.) — só identificadores e a ação. Ver `docs/operacao.md` para como
consultar cada uma.

## Checklist de conformidade antes de dado real (resumo)

Já detalhado em `docs/lgpd-e-infra.md` — não duplicado aqui. Os itens que
**bloqueiam** dado real de aluno: projeto em `sa-east-1`, backup
confirmado, e o gate de região respeitado.
