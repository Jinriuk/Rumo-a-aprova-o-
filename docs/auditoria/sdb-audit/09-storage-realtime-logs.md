# 09 — Storage, Realtime e Logs (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: storage.buckets, storage.objects, pg_publication_tables, contagens.

## 1. Storage

### Buckets

| Bucket | Publico | Limite de Tamanho | MIME permitidos | Objetos |
|--------|---------|-------------------|-----------------|---------|
| Logos-escolas | SIM | nenhum | nenhum | 2 |

### Objetos no Bucket

| Objeto | Observacao |
|--------|-----------|
| .emptyFolderPlaceholder | Placeholder vazio |
| IMG_9712.jpeg | Imagem real (provavelmente logo de escola) |

### Analise de Seguranca do Storage

O bucket Logos-escolas e PUBLICO — qualquer pessoa com a URL pode acessar.
Isso e aceitavel para logos de escola (dado nao-sensivel, intencional).

Riscos:
- Sem file_size_limit: qualquer arquivo de qualquer tamanho pode ser carregado
- Sem allowed_mime_types: qualquer tipo de arquivo aceito (PDF, EXE, etc.)
- Sem policies de RLS de storage verificadas (podem estar no Supabase UI, nao em pg_policies)
- Objeto IMG_9712.jpeg com nome generico — pode ser de teste ou real

Classificacao: P2 — adicionar size_limit e allowed_mime_types antes de PR1.

## 2. Realtime

| Item | Status |
|------|--------|
| Tabelas na publicacao supabase_realtime | 0 |
| Realtime habilitado para alguma tabela | NAO |

Nenhuma tabela esta publicada no canal Realtime do Supabase.
O sistema nao usa Realtime — updates sao por polling ou refresh manual.
Isso e intencional e correto para o modelo atual.

## 3. Logs de Aplicacao

### logs_acesso
- Rows: 1008
- Periodo: 2026-06-11 a 2026-06-27 (16 dias)
- Colunas: id, escola_id, aluno_id, usuario_id, papel, acao, em
- RLS: sim (isolamento por escola_id)
- Taxa: ~63 registros/dia
- Sem politica de retencao automatica — crescera indefinidamente

### logs_coordenacao
- Rows: 124
- Periodo: 2026-06-19 a 2026-06-27 (8 dias)
- Colunas: id, escola_id, usuario_id, papel, acao, entidade, entidade_id, detalhe, em
- RLS: sim (isolamento por escola_id)
- Taxa: ~15 registros/dia

### admin_logs
- Rows: 14
- Acesso: apenas superadmin (app.eh_super_admin())
- Sem expiracao ou rotacao

## 4. Observabilidade

| Item | Estado |
|------|--------|
| pg_stat_statements | Habilitado — 1838 queries registradas |
| Logs de acesso por aluno | sim (logs_acesso) |
| Logs de coordenacao | sim (logs_coordenacao) |
| Logs de superadmin | sim (admin_logs) |
| Alertas de uptime | NAO configurados |
| Monitoramento externo | NAO (pendente PR1) |

## 5. Riscos Identificados

| Risco | Classificacao |
|-------|---------------|
| Bucket publico sem size_limit | P2 |
| Bucket sem MIME types restritos | P2 |
| Logs sem retencao automatica | P3 |
| Sem alertas de uptime | P3 |
| Nenhum bucket privado para uploads sensiveis | OK para uso atual |
