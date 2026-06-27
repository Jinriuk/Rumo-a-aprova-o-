# AV2 - 07: Matriz de Problemas

**Fase:** AV2 - Auditoria Funcional Total
**Data:** 2026-06-24
**Auditor:** Claude

---

## P0 - Bloqueadores Criticos (seguranca/integridade)

Nenhum P0 identificado nesta auditoria.

O sistema mantem isolamento correto:
- Responsavel so ve aluno vinculado (confirmado)
- Coordenacao so ve sua escola (confirmado)
- Aluno so ve seu proprio progresso (confirmado)
- Superadmin acessa por backoffice proprio (confirmado)

---

## P1 - Bloqueia Demo/Piloto

### BUG-P1-001: Criar escola falha silenciosamente no Backoffice

**Area:** Superadmin / Backoffice
**Tela:** Formulario "Criar escola"
**Acao:** Preencher dados da escola e clicar "+ Criar escola"
**Resultado esperado:** Escola criada, aparece na lista, log registrado
**Resultado real:** Formulario some, nenhuma escola criada, nenhum erro exibido
**Banco confere:** Escola NAO criada (testado: slug "av2-teste" nao apareceu na lista)
**Reproducao:** Preencher bloco A com nome "AV2 TESTE Escola", slug "av2-teste", status Ativa, cidade SP, UF SP. Deixar bloco B vazio. Selecionar "Deixar para depois". Clicar "+ Criar escola".
**Hipotese:** Possivel erro de validacao nao exibido (campo slug ja em uso? campo obrigatorio nao marcado?). Pode ser erro na Edge Function backoffice-coordenador.
**Impacto:** Nao e possivel criar novas escolas pelo backoffice. Bloqueia onboarding de cliente real.

---

## P2 - Importante (nao bloqueia demo mas prejudica operacao)

### BUG-P2-001: Coordenador da vitrine com "E-mail nao registrado"

**Area:** Superadmin / Backoffice
**Tela:** Detalhe da escola Matriz Educacao RM
**Descricao:** Campo "Coordenacao" mostra "Coordenacao Vitrine - E-mail nao registrado (re-provisione para atualizar)"
**Impacto:** Superadmin nao ve o e-mail do coordenador. "Reenviar acesso" pode falhar pois e-mail esta ausente.
**Banco:** Provavel que o campo email_coord na tabela escolas esta NULL para a escola vitrine.

### BUG-P2-002: Checklist item "Contato administrativo informado" incompleto

**Area:** Superadmin / Backoffice
**Tela:** Detalhe da escola Matriz Educacao RM
**Descricao:** Checklist mostra 9/10, com "Contato administrativo informado" pendente (circulo vazio).
**Impacto:** Checklist de implantacao incompleto para a escola demo/vitrine. Pode confundir cliente em demo.
**Acao sugerida:** Preencher contato administrativo no bloco B do formulario de edicao da escola.

### BUG-P2-003: Criar escola nao mostra feedback de validacao

**Area:** Superadmin / Backoffice
**Descricao:** Quando submit do form de criar escola falha, nenhuma mensagem de erro e exibida.
**Impacto:** Superadmin nao sabe por que a criacao falhou.
**Acao sugerida:** Adicionar tratamento de erro com toast/alert explicativo.

---

## P3 - Melhorias (UX/polimento)

### MEL-P3-001: Sem feedback de sucesso ao adicionar registro de estudo

**Area:** Aluno / Aba Registrar
**Descricao:** Apos clicar "Adicionar registro", o formulario e resetado silenciosamente sem toast de confirmacao.
**Impacto:** Aluno pode ficar em duvida se o registro foi salvo.
**Acao sugerida:** Adicionar toast "Registro salvo!" por 2-3 segundos apos submit.

### MEL-P3-002: Cards de tipo de trilha nao sao clicaveis

**Area:** Aluno / Aba Trilha
**Descricao:** Os 4 cards (Trilha Anual, Semestral, Intensiva, Reta Final) sao apenas informativos mas visualmente parecem interativos.
**Impacto:** Aluno pode tentar clicar esperando ver detalhes da trilha.
**Acao sugerida:** Se nao ha destino de clique, remover cursor pointer ou adicionar indicacao visual "informativo".

### MEL-P3-003: Dropdown "... Mais" fecha ao mover cursor para opcoes

**Area:** Coordenacao / Lista de alunos
**Descricao:** O dropdown do botao "... Mais" tem comportamento de fechamento inconsistente.
**Impacto:** Dificuldade em clicar nas opcoes do menu - UX confusa.
**Acao sugerida:** Usar posicionamento absoluto com z-index alto e fechar apenas em click outside.

### MEL-P3-004: Login coordenacao demora ~6 segundos

**Area:** Login / Coordenacao
**Descricao:** Login via e-mail/senha da coordenacao demora significativamente mais que login por codigo do aluno.
**Impacto:** UX inferior no primeiro acesso do coordenador.
**Acao sugerida:** Investigar latencia da Edge Function ou consulta Supabase Auth.

---

## Resumo quantitativo

| Severidade | Quantidade |
|------------|-----------|
| P0 | 0 |
| P1 | 1 |
| P2 | 3 |
| P3 | 4 |
| **Total** | **8** |
