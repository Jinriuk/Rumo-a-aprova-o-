# Checklist de go-live do piloto (Fase A.9)

> Diferença em relação a `docs/go-live-checklist.md`: aquele é sobre o
> **sistema** estar pronto para receber o primeiro cliente real (uma vez
> só). Este é o checklist a rodar **a cada escola** que entra no piloto —
> antes de entregar acesso a ela.

## Antes de criar a escola

- [ ] Sistema passou pelo gate de `docs/go-live-checklist.md` (build,
      testes, RLS, região do banco adequada ao dado real).
- [ ] Backup confirmado e testado (`docs/backup-retencao-lgpd.md`).
- [ ] Política de rollback conhecida pela pessoa que vai operar
      (`docs/rollback.md`).
- [ ] Canal de suporte e responsável definidos (quem a escola contata se
      algo der errado).
- [ ] Canal de emergência definido (quem decide suspender acesso, e como
      — `docs/rollback.md`, Cenário 4).
- [ ] Confirmado que esta escola vai para a **base correta** (separação
      demo/piloto — nunca misturar dado real de aluno com a base
      `bdjkgrzfzoamchdpobbl` rotulada demo, ver `docs/lgpd-e-infra.md`).

## Criação e configuração da escola

- [ ] Escola criada pelo backoffice (`backoffice_criar_escola`) — RLS
      confirma isolamento automático (nova escola não vê dado de nenhuma
      outra, por construção).
- [ ] Coordenação provisionada (`scripts/criar-coordenacao.mjs`).
- [ ] Marca configurada (nome, logo, cor) — opcional, mas confirmar com a
      escola antes de liberar acesso.
- [ ] Concurso(s)-alvo configurado(s) para a escola (`config_escola`,
      se houver override do edital oficial).
- [ ] Trilha(s)/missões aplicáveis confirmadas (a trilha padrão é global;
      confirmar que cobre o concurso da escola).
- [ ] Simulados/config de simulado por concurso revisados, se a escola for
      usar simulados desde o início.

## Alunos e responsáveis

- [ ] Turma(s) criadas.
- [ ] Alunos importados (um a um ou em lote) — confirmar quantidade
      esperada bate com o cadastro da escola.
- [ ] Consentimento registrado para os alunos que precisam (LGPD,
      responsável menor).
- [ ] Credenciais geradas e **entregues** (o código só aparece uma vez na
      tela — confirmar que a escola já anotou/entregou antes de fechar a
      tela).
- [ ] Responsáveis vinculados e com credencial, onde aplicável.

## Verificação final antes de liberar

- [ ] Checklist de implantação do backoffice (`DetalheEscola`) mostra
      todos os itens relevantes concluídos.
- [ ] Login testado com pelo menos um aluno, um responsável (se houver) e
      a coordenação — os três perfis carregam sem erro.
- [ ] Confirmar nos logs (`logs_coordenacao`, `logs_acesso`) que as ações
      de implantação desta escola aparecem corretamente.

## Pós-ativação (primeiros dias)

- [ ] Monitorar `logs_acesso`/`logs_coordenacao` da escola para uso
      normal (sem erro recorrente).
- [ ] Confirmar com a escola, depois do primeiro uso real, que não houve
      problema de acesso ou de dado incorreto.
