# 11 — Classificacao de Riscos P0/P1/P2/P3 (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: inventario completo desta auditoria.

## P0 — Nenhum

Nenhum P0 identificado. Nao ha vazamento real de dado, quebra de multi-tenant,
dado sensivel exposto, corrupcao ou destruicao de dado.

---

## P1 — Bloqueadores ou Quase-Bloqueadores

### P1-SDB-001: Drift de Migrations (0034, 0035, 0036 nao aplicadas)
- Problema: 3 migrations no repositorio nao estao no banco remoto
- Impacto: codigo de producao pode chamar funcoes inexistentes (motor_virar_semana_escola, lgpd_usuarios_do_aluno) e falhar
- Risco: falha em operacao LGPD e virada de semana por escola
- Tabelas/funcoes: concursos.maturidade, vw_concurso_qualidade, motor_virar_semana_escola, lgpd_usuarios_do_aluno
- Correcao: aplicar 0034, 0035, 0036 via SQL Editor em ordem
- Criterio de aceite: ledger remoto com 36 migrations, funcoes existindo no banco

### P1-SDB-002: Sem Backup Gerenciado
- Problema: projeto no plano Free — sem backup automatico do Supabase
- Impacto: perda irreversivel de dados em caso de falha
- Risco: qualquer bug ou acidente operacional pode destruir todos os dados
- Correcao: upgrade para Pro (julho) + testar restore
- Criterio de aceite: backup diario restaurado com sucesso em ambiente isolado

### P1-SDB-003: Sem Staging Isolado
- Problema: nao ha ambiente separado para QA2 de carga
- Impacto: QA2 seria feita em producao — inaceitavel com dados reais
- Risco: carga de teste pode corromper dados de escola candidata real
- Correcao: criar projeto Supabase separado para staging (julho)
- Criterio de aceite: staging isolado com seeds proprios

### P1-SDB-004: Regiao us-east-1 (LGPD)
- Problema: banco em us-east-1, LGPD exige sa-east-1 para dado de menor no Brasil
- Impacto: nao conformidade legal com LGPD para menores de 18 anos
- Risco: legal/compliance
- Correcao: migrar para sa-east-1 (julho/Pro)
- Criterio de aceite: banco na regiao sa-east-1

### P1-SDB-005: Atomicidade LGPD Comprometida (0036 nao aplicada)
- Problema: lgpd_usuarios_do_aluno nao existe no banco; Edge Function lgpd-titular nao pode garantir atomicidade
- Impacto: exclusao LGPD pode deixar conta Auth orfã (banco apaga, Auth falha)
- Risco: LGPD, dado residual em Auth sem usuario no banco
- Correcao: aplicar migration 0036 (parte do P1-SDB-001)
- Criterio de aceite: funcao lgpd_usuarios_do_aluno existindo no banco

---

## P2 — Importantes, Contornaveis em Piloto Controlado

### P2-SDB-001: Storage Bucket sem Restricoes
- Problema: Logos-escolas publico sem size_limit e allowed_mime_types
- Impacto: qualquer tipo de arquivo de qualquer tamanho pode ser carregado
- Correcao: adicionar size_limit (ex: 2MB) e allowed_mime_types (image/*)

### P2-SDB-002: escolas com seq_scan Excessivo
- Problema: 93488 seq_scans na tabela de 4 rows
- Impacto: com mais escolas, pode causar latencia em queries de isolamento
- Correcao: investigar index parcial em escolas(status, id)

### P2-SDB-003: 13 FKs Sem Index
- Problema: FKs de auditoria e catalogo sem index correspondente
- Impacto: JOINs lentos com carga real
- Correcao: adicionar indexes antes de QA2

### P2-SDB-004: Separacao Demo vs Real Ausente
- Problema: auth.users de demo e real na mesma instancia
- Impacto: aluno real pode cair em ranking demo; credenciais demo em producao
- Correcao: projeto Supabase separado (Opcao A, documentado em SEG2)

### P2-SDB-005: SMTP Nao Validado com Dominio Real
- Problema: recuperacao de senha nao testada com email real
- Impacto: aluno real nao pode recuperar senha
- Correcao: configurar SMTP com dominio da escola candidata

### P2-SDB-006: Leaked Password Protection Ausente
- Problema: recurso Pro nao disponivel no plano Free
- Impacto: usuarios podem usar senhas vazadas
- Correcao: upgrade para Pro (julho)

---

## P3 — Melhorias Futuras

### P3-SDB-001: Tabelas Fase 15 Dormentes
- aluno_xp_eventos, aluno_niveis, aluno_nivel_historico, aluno_missoes, missoes_escola
- Acao: investigar escrita e remover na DB3 se confirmado sem uso

### P3-SDB-002: 16 Indexes com 0 Scans
- Acao: revisar sob carga real (QA2); remover os de tabelas vazias na DB3

### P3-SDB-003: Logs Sem Retencao Automatica
- Acao: definir politica de retencao para logs_acesso, logs_coordenacao, admin_logs

### P3-SDB-004: Trigger trg_nivel_historico em Tabela Vazia
- Acao: remover quando aluno_niveis for removida na DB3

### P3-SDB-005: vinculos_responsaveis sem Historico de Revogacao
- Acao: considerar adicionar revogado_em para auditoria LGPD

### P3-SDB-006: resumo_escola() sem Limite de Rows
- Acao: adicionar LIMIT ou paginacao para escolas com muitos alunos

### P3-SDB-007: config_oficial sem Escola_id
- Acao: verificar se config global e intencional ou se deveria ser por escola

### P3-SDB-008: vw_concurso_qualidade Ausente (0034 nao aplicada)
- Acao: aplicar migration 0034 para habilitar auditoria de qualidade de conteudo

---

## Manual — Depende do Dono

| Item | Descricao |
|------|-----------|
| Manual-1 | Testar backup restore (requer Pro) |
| Manual-2 | Configurar SMTP com dominio real |
| Manual-3 | Rotacionar credenciais demo antes de aluno real |

## Julho/Pro — Depende de Plano Pago

| Item | Descricao |
|------|-----------|
| Julho-1 | Backup automatico gerenciado |
| Julho-2 | Leaked Password Protection |
| Julho-3 | Migracao para sa-east-1 |
| Julho-4 | Staging isolado com projeto Pro |

## QA2 — Depende de Carga/Teste E2E

| Item | Descricao |
|------|-----------|
| QA2-1 | Validar indexes sob carga de 300-500 alunos |
| QA2-2 | Medir latencia de resumo_escola com carga real |
| QA2-3 | Exercitar LGPD ao vivo (exportar e apagar) |
