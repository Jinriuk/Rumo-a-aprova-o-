# Plano curto: upload do logo da escola (D13)

**Data:** 24/09/2026 · **Status:** só plano, nada implementado (Bloco 4 do documento de
correções de 23/09/2026).

## Hoje

- `escolas.logo_url` é um texto. A tela Marca (`app/src/modules/escola/Marca.jsx`) só aceita um
  **link** http(s), validado por `sanitizarUrlLogo`, que também aceita `data:image` em base64 de
  PNG, JPEG, WebP e GIF, e recusa SVG de propósito. A tela avisa que "upload de arquivo ainda não
  é suportado".
- Nenhuma migration cria bucket de Storage. A CSP já aceita imagem de qualquer origem https
  (`img-src 'self' data: blob: https:`), então uma URL pública do Supabase Storage não exige
  mexer em `vercel.json`.
- A implantação promete "a identidade visual da escola". Na prática, a escola precisa hospedar o
  logo em outro lugar e colar o link, o que quebra quando o link muda.

## Proposta

1. **Bucket `logos-escolas`**, criado por migration (em ambiente compartilhado com produção,
   exige aprovação):
   - `public = true` para leitura. Logo não é dado pessoal, aparece antes do login e em página
     pública, e URL pública evita assinar link a cada render.
   - `file_size_limit = 512 KB`.
   - `allowed_mime_types = image/png, image/jpeg, image/webp`. **Sem SVG**, pelo mesmo motivo do
     `sanitizarUrlLogo`: SVG carrega script.
2. **Caminho do arquivo:** `<escola_id>/logo-<timestamp>.<ext>`. O timestamp no nome derruba o
   cache do CDN a cada troca, sem precisar invalidar nada.
3. **RLS em `storage.objects`** (as políticas de leitura ficam implícitas no bucket público):
   - INSERT, UPDATE e DELETE só quando `bucket_id = 'logos-escolas'`,
     `(storage.foldername(name))[1] = app.tenant_id()::text`, `app.papel() = 'coordenacao'` e
     `app.tenant_operacional()`. É o mesmo trio de funções que as tabelas já usam.
   - Teste de isolamento no molde de `tests/isolamento.test.mjs`: a coordenação da escola A não
     grava, troca nem apaga nada na pasta da escola B, e aluno e responsável não gravam em pasta
     nenhuma.
4. **Front (Marca.jsx):** um campo "Enviar arquivo" ao lado do link atual, que continua valendo.
   O fluxo:
   - valida tipo e tamanho no cliente;
   - envia com `supabase.storage.from('logos-escolas').upload(...)`;
   - pega `getPublicUrl`;
   - passa pelo `sanitizarUrlLogo` e grava em `escolas.logo_url` pelo mesmo caminho de hoje;
   - apaga o arquivo anterior da própria pasta.
   Recomendação na tela: quadrado, a partir de 256×256 px.
5. **Backup:** o backup do Postgres não cobre objetos do Storage. Registrar isso em
   `docs/operacao/backup-e-plano-supabase.md`. Se o arquivo se perder, a escola reenvia o logo,
   e isso é aceitável.

## Custo e riscos

- **Estimativa:** cerca de 1 dia. Migration, políticas e teste de isolamento ~½ dia; front e
  revisão visual ~½ dia.
- **Risco principal:** política de Storage frouxa, que deixaria uma escola sobrescrever o logo
  de outra. Por isso o teste de isolamento é pré-requisito do merge, e não um extra.
- Arquivo órfão (upload feito sem salvar a marca) é aceitável. Uma limpeza periódica pode vir
  depois.
