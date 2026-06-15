# Fase 17 — Operação segura, backoffice interno e preparação para cliente real

> Objetivo: deixar o **Rumo à Aprovação** pronto para instalar, operar e
> manter escolas reais **sem gambiarra no banco**, sem risco desnecessário
> de LGPD e sem o ambiente de teste sujando demo/produção.

A Fase 17 é **operação, segurança e implantação** — não é feature
pedagógica. Ver "O que NÃO fazer agora" no fim.

## Contexto que motivou a fase

Durante o fechamento da Fase 16 (PR de performance/escala) apareceram, na
prática, três problemas operacionais:

1. **Produção estava 9 migrations atrás do código** (só até a `0007`). A
   Fase 15 inteira nunca tinha sido aplicada no Supabase. Foi corrigido à
   mão (migrations `0008`–`0018` + seeds de catálogo), mas **não pode
   depender de correção manual** quando houver escola real.
2. **O E2E suja o banco de demo compartilhado** — o teste de marca
   escreve no nome da escola de vitrine (chegou a ficar `"Matriz ⟦e2e⟧"`).
3. **Região/LGPD**: o projeto usado pelo front (`bdjkgrzfzoamchdpobbl`)
   está em **us-east-1** e rotulado "demo"; a doutrina (Doc 6 §7) exige
   **sa-east-1 (Brasil)** para dado de menor.

## Subfases (ordem recomendada)

| # | Nome | Objetivo | Estado |
|---|------|----------|--------|
| 17.1 | Paridade produção/repositório | Produção sempre = código | **feito** (`deploy-checklist.md` + `scripts/checar-migrations.mjs`) |
| 17.2 | Ambiente demo e E2E isolado | Separar demo, teste e produção | **preparado** — CI já isola via secrets; falta criar projeto E2E + setar secrets (`e2e-ambiente.md`) |
| 17.3 | LGPD / região / infra | Supabase na região certa antes de dado real | **preparado** — plano/checklist prontos; falta criar projeto sa-east-1 (`lgpd-e-infra.md`) |
| 17.4 | Backoffice interno seguro | Área interna invisível para escolas | pendente |
| 17.5 | Implantação de escola | Fluxo repetível de cadastrar escola/alunos | pendente |
| 17.6 | Monitoramento, logs e backups | Operar com controle | pendente |
| 17.7 | Checklist de go-live | Validar que pode receber cliente real | pendente |

---

### 17.1 — Paridade produção × repositório
**Problema:** produção ficou atrás das migrations.
**Entregas:** `docs/deploy-checklist.md`; `scripts/checar-migrations.mjs`
(compara migrations aplicadas × arquivos do repo); ordem de deploy
(migration primeiro, front depois, quando o front depender do banco);
política de rollback.
**Conclusão:** existe procedimento claro para o problema não se repetir.

### 17.2 — Ambiente demo e E2E isolado
**Problema:** o E2E escreve no banco de demo compartilhado (marca).
**Ideal:** projeto Supabase **separado** para E2E (resetável, sem valor
comercial); escola demo comercial protegida; E2E não escreve no demo
principal; reset antes da suíte.
**Conclusão:** o E2E roda N vezes sem corromper a escola demo.
**Decisão necessária:** criar um 2º projeto Supabase (ou um schema/escola
descartável) para os testes.

### 17.3 — LGPD, região e infraestrutura
**Crítico:** dados de alunos/responsáveis, muitos menores.
**Fazer:** Supabase em **sa-east-1**; retenção; backup; logs de acesso
(já existe `logs_acesso`); minimização (já: só nome, sem CPF); habilitar
**leaked password protection** no Auth; revisar credenciais/e-mails.
**Decisão:** não colocar cliente real com dado real enquanto região/
compliance estiver pendente.
**Conclusão:** o ambiente para cliente real está definido e documentado.

### 17.4 — Backoffice interno seguro
**Objetivo:** operar sem mexer direto no Supabase.
**Regras:** invisível para aluno/responsável/coordenação; papel novo
`super_admin` (NÃO misturar com `coordenacao`); tabela `internal_admins`
(vínculo por `auth_user_id`, e-mail autorizado, `ativo`); RLS própria;
logs administrativos; ações sensíveis via Edge Function; **nunca**
`service_role` no front.
**Telas mínimas:** lista de escolas; criar escola; detalhe da escola;
checklist de implantação.
**Conclusão:** dá para cadastrar/preparar uma escola sem editar o banco.

### 17.5 — Fluxo de implantação de escola
**Objetivo:** instalação repetível (< 1h, sem tocar no banco).
**Fluxo:** criar escola → coordenador → marca → turmas → importar alunos
→ gerar credenciais → vincular responsáveis → concursos ativos → conferir
trilhas/missões → liberar acesso → treinar coordenação.
**Entregas:** importação CSV/planilha; validação de nomes/e-mails;
geração de credenciais em lote; relatório de importados; modelo de
planilha.

### 17.6 — Monitoramento, logs e backups
**Monitorar:** erros do front; falhas de Edge Functions/RPC; acessos
negados; uso por escola; registros/dia; storage; tamanho do banco.
**Logar:** criação de escola; mudança de plano; suspensão/ativação;
importação; geração de credenciais; alteração de marca; acesso LGPD;
ações de `super_admin`.
**Backups:** automático do Supabase + export manual periódico no começo;
checklist antes de migration sensível.
**Conclusão:** responder "o que aconteceu, quando, quem fez, em qual escola".

### 17.7 — Checklist de go-live
**Técnico:** build verde; unitários verdes; E2E verde (ou flaky
documentado/isolado); RLS validada; **produção alinhada com migrations**;
RPCs ok; demo preservada; backoffice ok.
**Segurança:** sem `service_role` no front; Auth ok; leaked password
protection; região definida; logs administrativos; backup.
**Produto:** aluno/responsável/coordenação ok; trilhas/missões; simulados
por concurso; ranking; white-label; demo apresentável.
**Operação:** processo de implantação; planilha de alunos; modelo de
credenciais; tutorial; suporte; responsável interno.
**Critério final:** instalar uma escola fictícia do zero pelo fluxo
interno, testar os três perfis e liberar acesso **sem tocar no banco**.

---

## O que NÃO fazer na Fase 17
Sem novas features pedagógicas grandes, banco de questões nível 2, IA,
app mobile, CRM/financeiro completos, NF-e, redesign amplo, customização
por escola, expansão de concursos. **Fase 17 é operação, segurança e
implantação.**

## Prioridade
Antes de cliente real: resolver **17.3 (região/LGPD)** e **17.4
(backoffice mínimo)**. Sem isso dá para vender, mas a instalação fica
frágil.
