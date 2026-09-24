# Aplicação da Etapa 2: migrations 0055 a 0058 e Edge Functions

**Origem:** `main` em `efdd9db` (PRs #138, #140, #141, #144, #142 e #145 mergeados nessa ordem).
**Aplicadas por:** operação, via MCP (`apply_migration` e `deploy_edge_function`).

| Fase | Projeto | Situação |
|---|---|---|
| 1 | demo `bdjkgrzfzoamchdpobbl` | aplicada em 2026-09-24; teste com os olhos feito pelo dono, sem falha |
| 2 | produção `zckyhihxjjbnqjqilymn` | aplicada em 2026-09-24, com aprovação escrita do dono; **teste de produção pendente** |

Nenhuma das quatro migrations altera ou apaga dado: só constraint, policy, grant e
corpo de função. Por isso não houve `pg_dump`; a reversão é o SQL gerado do estado
anterior (abaixo).

## Fase 1: demo

### Antes de aplicar

**Varredura da 0055 (passo 2).** Para cada uma das 16 FKs compostas novas, contagem de
linhas de uma escola apontando para aluno, usuário, turma ou meta de outra escola.
Resultado: **0 em todas as 16**. A 0055 aplicaria sem limpeza.

**CORS (passo 4).** O default de `_shared/cors.ts` na `main` contém
`https://app.trilivaedu.com.br`, `https://www.trilivaedu.com.br` e
`https://trilivaedu.com.br`, além de `https://rumo-a-aprova-o.vercel.app`. O valor de
`ALLOWED_ORIGINS` no projeto não é legível pelo MCP; se ela estiver definida, é ela que
vale, e o default não entra em jogo.

**Reversão (passo 3).** `docs/operacao/reversao/e2-0055-0058-demo.sql`, gerado do
catálogo do demo às 20:22:11 UTC (Postgres 17.6), antes da primeira migration:

- sha256 `9683e60a71b8d4af699c2b5d6d39999c13e5987c9b20839714ba81a4e053aaa0`;
- recria os grants de `public.escolas` (tabela e colunas) e das 16 funções que a 0057
  toca, a partir de `relacl`, `attacl` e `proacl`;
- restaura os corpos de `app.lgpd_usuarios_do_aluno`, `app.lgpd_excluir`,
  `app.lgpd_exportar` e `app.tenant_operacional` por `pg_get_functiondef`;
- derruba e recria as 24 policies tocadas a partir de `pg_policies`;
- derruba as 16 FKs e as 4 uniques da 0055;
- o gerador foi validado em Postgres 16.13 local. A reversão gerada do local, depois
  de 0055 a 0058, devolve o fingerprint ao de antes, com privilégios iguais por efeito
  (`has_*_privilege`);
- o arquivo do demo foi executado no local dentro de transação, com rollback, sem
  erro. A única edição para esse ensaio foi tirar `MAINTAIN`, que o 16 não conhece.

A reversão não mexe no ledger. O comando para isso está no rodapé do arquivo, comentado.
**Reverter reabre as falhas que as quatro migrations fecham.**

### Aplicado

| Migration | sha256 do arquivo | Versão no ledger (UTC) |
|---|---|---|
| `0055_coerencia_tenant` | `34a8c9fc…60db26` | `20260924202455` |
| `0056_tenant_operacional_nega_por_padrao` | `15cabc3f…1bbc7` | `20260924202532` |
| `0057_revoga_execute_funcoes_internas` | `d2376fb2…451d55` | `20260924202559` |
| `0058_escolas_colunas_por_papel` | `7702209f…bdd8a` | `20260924204724` |

A 0058 foi pedida às 20:26:15. Ela entrou às 20:47:24 porque a chamada ficou esperando
aprovação na sessão. Durante esses 21 minutos o demo ficou com 0055 a 0057 aplicadas
e sem a 0058, o que não causa regressão: é o estado antigo de `escolas`. As funções
novas foram publicadas entre 20:48:34 e 20:55:25. Na produção, o tempo entre a
primeira migration e a última função depende de quão rápido cada chamada for aprovada.

**Edge Functions.** Foram publicadas as 7 funções que os dois PRs tocam. O #142 muda
`_shared/cors.ts`, que as 7 empacotam. O #145 muda 4 delas e cria
`_shared/escola.ts`. As 4 do #145 já estão entre as 7 do #142, então o total
é 7 e não 11.

| Função | Versão | ezbr_sha256 antes | ezbr_sha256 depois |
|---|---|---|---|
| trocar-senha | 2 → 3 | `d43138424b17…` | `6c3fda4c6bba…` |
| gerar-meta | 7 → 8 | `28e7a1cd9e29…` | `1f4ddc8b0a99…` |
| lgpd-titular | 5 → 6 | `79cfb079897b…` | `f7e5c43a9a32…` |
| virar-semana | 5 → 6 | `deef4ac7b570…` | `15c16c014106…` |
| revogar-responsavel | 5 → 6 | `6e90f8992518…` | `a3742329f0b7…` |
| backoffice-coordenador | 8 → 9 | `f1cd2e67c9b2…` | `5b2efe84e9c6…` |
| provisionar-aluno | 7 → 8 | `402c5f3c5b86…` | `19c0cbf6b8f2…` |
| capture-oidc-20260919 | 3 → 3 | `7571153ba692…` | `7571153ba692…` (intocada) |

### Verificação

**Ledger (passo 7).** O ledger passou de 56 para 60 linhas, com os quatro nomes
completos. A comparação equivalente à do `scripts/checar-migrations.mjs` deu
**0 migrations faltando** e 1 linha só no ledger: `0049_normalizar_nome_ledger_onda25`,
que já existia antes da janela.

Verificado depois, na preparação da fase 2: o ledger guarda o SQL aplicado em
`statements`, que é o arquivo sem a quebra de linha final. O md5 dos statements
de 0055 a 0058 no demo é igual ao dos arquivos da `main`, então o que foi aplicado
é exatamente o código do repositório:

| Migration | md5 |
|---|---|
| 0055 | `d3de446245407e5e664f8c49754f3140` |
| 0056 | `a2641401f82ed6149ee02b98395c5c9d` |
| 0057 | `f819d1cf53041292303b25c5ac33ae1a` |
| 0058 | `144e1687cda5bcb541a16a69e978cab3` |

A mesma conta mostrou uma divergência antiga, de fora desta janela: a
`0053_consentimento_registrado_em` do demo tem 988 caracteres no ledger, e o
arquivo tem 2823. Em produção a 0053 bate com o arquivo.

**Fingerprint (passo 8).** O script `scripts/fingerprint-schema.sql` foi estendido,
só nesta verificação, com três categorias:

- `acl_colunas`: `attacl`, porque a 0058 dá privilégio por coluna e o script
  original não enxerga isso;
- `priv_funcoes`: EXECUTE por papel, medido por `has_function_privilege`;
- `priv_escolas`: SELECT, UPDATE e INSERT por coluna em `escolas`, medidos por
  `has_column_privilege`.

A comparação é contra um banco local recriado da `main` com 0055 a 0058
(Postgres 16.13).

| Categoria | Demo antes | Demo depois | Local (main) | Depois × local |
|---|---|---|---|---|
| tabelas | 49 `50d476` | 49 `50d476` | 49 `50d476` | igual |
| colunas | 402 `3ea68d` | 402 `3ea68d` | 402 `3ea68d` | igual |
| constraints | 224 `cea63e` | 244 `fe386e` | 244 `fe386e` | igual (+16 FKs, +4 uniques) |
| indices | 145 `30e078` | 149 `86ff5c` | 149 `86ff5c` | igual (+4, das uniques) |
| policies | 85 `73913f` | 85 `87bdef` | 85 `87bdef` | igual (24 reescritas) |
| triggers | 8 `0bac0f` | 8 `0bac0f` | 8 `0bac0f` | igual |
| views | 3 `e36743` | 3 `e36743` | 3 `e36743` | igual |
| acl_colunas | 10 `237ef4` | 21 `189e74` | 21 `189e74` | igual |
| priv_escolas | 18 `d64fc7` | 18 `c32822` | 18 `c32822` | igual |
| funcoes | 66 `a64f75` | 66 `386a4b` | 66 `f44a25` | 2 itens, já divergentes antes |
| priv_funcoes | 66 `c5c59e` | 66 `b66637` | 66 `50717c` | 1 item, já divergente antes |
| acl_tabelas | 49 `c6aeb8` | 49 `316313` | 49 `1a6f22` | texto de ACL difere por ambiente |
| acl_funcoes | 66 `5bdb93` | 66 `272a47` | 66 `51dc46` | texto de ACL difere por ambiente |
| event_triggers | 7 `a31e20` | 7 `a31e20` | 1 `856ded` | os 6 a mais são da plataforma Supabase |

Os três itens que diferem do local foram isolados por exclusão de hash: a consulta no
demo recebe a lista de md5 do local e devolve só os itens fora dela. Os três já
divergiam no retrato de antes da janela, e nenhum foi tocado pelas migrations:

- `public.backoffice_criar_escola` e `public.backoffice_detalhe_escola`: o corpo difere
  só em espaço em branco. Sem espaços, o md5 é igual ao local
  (`a73cb2…` e `c01d05…`).
- `public.rls_auto_enable()`: `service_role` tem EXECUTE no demo e não no local. Isso
  vem do privilégio padrão da plataforma.

`acl_tabelas` e `acl_funcoes` comparam o texto do ACL. O 17 escreve `m` (MAINTAIN) e o
16 não, e o Supabase concede por padrão a `anon`, `authenticated` e `service_role`. Por
isso essas duas categorias não dão igualdade textual entre ambientes. O efeito sobre
`escolas` está em `priv_escolas` e `acl_colunas`, iguais ao local. O efeito sobre as
funções está em `priv_funcoes`, igual ao local exceto o item acima.

**Edge Functions (passo 9).**

- As 7 funções esperadas mudaram de versão e de ezbr. A `capture-oidc-20260919` ficou
  como estava: v3, mesmo ezbr, `verify_jwt` true.
- Todas estão ACTIVE e as 7 têm `verify_jwt` false, como antes. O `entrypoint_path`
  segue o mesmo formato de antes (`…/source/source/index.ts`).
- O conteúdo publicado foi lido de volta com `get_edge_function`. Cada arquivo de cada
  função é **idêntico byte a byte** ao da `main` em `efdd9db`, `index.ts` e `_shared/*`
  inclusive, também na `trocar-senha`, cujo payload foi montado à mão.

### Não verificado

- **Resposta HTTP das funções** (preflight CORS, 403 de escola parada). Não houve
  chamada HTTP: a rede desta sessão não alcança o projeto.
- **Valor de `ALLOWED_ORIGINS`** no projeto, que o MCP não lê.
- **Teste com os olhos (passo 10), a cargo do dono.** Feito, e o dono informou que
  funcionou sem falha:
  - coordenação: login, marca, tela do próximo ciclo, cadastro e exclusão do
    aluno de teste;
  - login de aluno e de responsável.

### Reversão das funções

Não há SQL para isso. Reverter uma função é republicar a versão anterior, que está em
`docs/arquivo/edge-functions-producao-pre-e2/`. Esse arquivo foi lido de produção na
fase 2, e os 7 ezbr dele são idênticos aos que o demo tinha antes do redeploy, então
ele reverte os dois ambientes. O git em `48ff020` não serve para isso: a
`provisionar-aluno` publicada diferia dele numa linha de comentário. As funções novas
funcionam com o banco antes ou depois das migrations, porque o porteiro lê
`escolas.status` com a chave de serviço. Por isso dá para reverter uma camada sem a
outra.

## Fase 2: produção

Aprovada por escrito pelo dono depois do teste da fase 1, com quatro condições:

1. arquivar e conferir o código das 7 funções antes de publicar;
2. rodar de novo a varredura da 0055 e parar se houver linha;
3. o dono presente para aprovar cada chamada;
4. o registro na `main` por PR.

As mesmas verificações da fase 1 valem aqui, na mesma ordem.

### Antes de aplicar

**Funções: a premissa da condição 1 foi conferida.** Os 7 `ezbr_sha256` de produção
eram idênticos, nos 64 caracteres, aos do demo antes do redeploy. Produção tinha só
essas 7 funções, todas ACTIVE e com `verify_jwt` false.

**Arquivo das funções (condição 1).** Está em
`docs/arquivo/edge-functions-producao-pre-e2/`, com versão, ezbr e sha256 de cada
arquivo no README. Os arquivos foram gravados a partir do retorno bruto de
`get_edge_function`, sem transcrição. Foi publicado no commit `9c84da2` antes da
primeira escrita em produção.

- 16 dos 17 arquivos são idênticos ao git em `48ff020`.
- O `provisionar-aluno/source/index.ts` difere numa linha de comentário: o traço
  decorativo de `// ── Gerar credencial de aluno` tem 37 caracteres `─` em
  produção e 46 no git.

**Varredura da 0055 (condição 2).** As mesmas 16 contagens da fase 1, agora nos dados
de produção: **0 em todas**.

**Ledger.** 56 linhas no Postgres 17.6. Uma linha existe só no ledger, e já existia
antes: `0049_backfill_ledger_onda25`, com nome diferente da equivalente no demo.

**Fingerprint de antes.** Igual ao do demo antes em todas as categorias, inclusive
nos textos de ACL, com uma exceção: `funcoes` (produção `af8e3b`, demo `a64f75`). A
exclusão de hash contra o banco local recriado da `main` antes da 0055 devolveu vazio.
Isso quer dizer que as 66 funções de produção eram idênticas às do repo; a diferença
estava do lado do demo, no espaço em branco das duas `backoffice_*`.

**Reversão.** `docs/operacao/reversao/e2-0055-0058-producao.sql`, gerado do catálogo
de produção às 21:58:57 UTC.

- sha256 `a09e1ef4867bd007aa31165877c1cb1b6e88d0104ec17e08448f0d3cb99da90e`.
- As partes executáveis (grants, policies e constraints) são iguais às do arquivo
  do demo. A diferença está só dentro dos corpos de função: produção guarda CRLF e
  3 linhas de comentário que o demo não tem.
- O arquivo mantém os bytes que o banco devolveu, para o `prosrc` voltar idêntico.
- O arquivo do demo também confere, byte a byte, com o que o banco do demo devolveu.
- Não houve ensaio local deste arquivo: as linhas executáveis são as mesmas do
  arquivo do demo, que foi ensaiado.

**CORS.** O mesmo default da fase 1 (`app`, `www` e apex de `trilivaedu.com.br`),
suficiente para `https://app.trilivaedu.com.br`. O valor de `ALLOWED_ORIGINS` em
produção não é legível pelo MCP.

### Aplicado

| Migration | Versão no ledger (UTC) | md5 dos statements = md5 do arquivo |
|---|---|---|
| `0055_coerencia_tenant` | `20260924220208` | `d3de4462…` sim |
| `0056_tenant_operacional_nega_por_padrao` | `20260924221800` | `a2641401…` sim |
| `0057_revoga_execute_funcoes_internas` | `20260924225137` | `f819d1cf…` sim |
| `0058_escolas_colunas_por_papel` | `20260924225225` | `144e1687…` sim |

A janela foi da primeira migration, às 22:02:08, à última função, às 22:59:47. Houve
dois intervalos longos, de 16 e de 33 minutos, entre 0055 e 0056 e entre 0056 e 0057.
Eles somam o tempo até cada chamada ser aprovada e duas quedas da conexão do MCP com
o Supabase. O registro não permite separar uma causa da outra. Da 0057 à última
função foram 8 minutos. Nenhum estado intermediário é regressão: cada migration só
fecha, e as funções antigas funcionam com o banco novo, como no demo.

| Função | Versão | Publicada (UTC) | ezbr antes | ezbr depois |
|---|---|---|---|---|
| trocar-senha | 2 → 3 | 22:53:19 | `d43138424b17…` | `6c3fda4c6bba…` |
| gerar-meta | 4 → 5 | 22:54:07 | `28e7a1cd9e29…` | `1f4ddc8b0a99…` |
| lgpd-titular | 3 → 4 | 22:55:02 | `79cfb079897b…` | `f7e5c43a9a32…` |
| virar-semana | 3 → 4 | 22:55:45 | `deef4ac7b570…` | `15c16c014106…` |
| revogar-responsavel | 3 → 4 | 22:56:33 | `6e90f8992518…` | `a3742329f0b7…` |
| backoffice-coordenador | 4 → 5 | 22:57:46 | `f1cd2e67c9b2…` | `5b2efe84e9c6…` |
| provisionar-aluno | 4 → 5 | 22:59:47 | `402c5f3c5b86…` | `19c0cbf6b8f2…` |

### Verificação

**Ledger.** O ledger passou de 56 para 60 linhas. Não falta nenhuma migration, e a
única linha só no ledger é a `0049_backfill_ledger_onda25`, que já existia.

**Fingerprint depois.**

| Categoria | Produção antes | Produção depois | Local (main) | Depois × local |
|---|---|---|---|---|
| tabelas | 49 `50d476` | 49 `50d476` | 49 `50d476` | igual |
| colunas | 402 `3ea68d` | 402 `3ea68d` | 402 `3ea68d` | igual |
| constraints | 224 `cea63e` | 244 `fe386e` | 244 `fe386e` | igual |
| indices | 145 `30e078` | 149 `86ff5c` | 149 `86ff5c` | igual |
| policies | 85 `73913f` | 85 `87bdef` | 85 `87bdef` | igual |
| triggers | 8 `0bac0f` | 8 `0bac0f` | 8 `0bac0f` | igual |
| views | 3 `e36743` | 3 `e36743` | 3 `e36743` | igual |
| funcoes | 66 `af8e3b` | 66 `f44a25` | 66 `f44a25` | **igual** |
| acl_colunas | 10 `237ef4` | 21 `189e74` | 21 `189e74` | igual |
| priv_escolas | 18 `d64fc7` | 18 `c32822` | 18 `c32822` | igual |
| priv_funcoes | 66 `c5c59e` | 66 `b66637` | 66 `50717c` | igual ao demo depois |
| acl_tabelas | 49 `c6aeb8` | 49 `316313` | 49 `1a6f22` | igual ao demo depois |
| acl_funcoes | 66 `5bdb93` | 66 `272a47` | 66 `51dc46` | igual ao demo depois |
| event_triggers | 7 `a31e20` | 7 `a31e20` | 1 `856ded` | plataforma |

Produção ficou mais perto do local que o demo: `funcoes` é idêntico, sem as duas
exceções de espaço em branco. `priv_funcoes` difere do local só no item que já
diferia antes, `rls_auto_enable` com EXECUTE para `service_role`, que é padrão da
plataforma. A prova é transitiva: é o mesmo hash do demo depois, onde a exclusão de
hash isolou esse único item. `acl_tabelas` e `acl_funcoes` batem com o demo depois
nos mesmos hashes.

**Edge Functions.**

- As 7 mudaram de versão, e os 7 ezbr novos são **idênticos** aos do demo depois do
  redeploy.
- O conteúdo do demo foi comparado byte a byte com a `main` na fase 1. O ezbr é o
  hash do pacote, então o conteúdo publicado em produção é o mesmo.
- A `provisionar-aluno`, única com payload de risco (a linha de comentário), foi
  lida de volta: os 3 arquivos são iguais à `main`.
- Todas estão ACTIVE e com `verify_jwt` false.

### Não verificado

- Resposta HTTP das funções e valor de `ALLOWED_ORIGINS`, pelo mesmo motivo da fase 1.
- **Teste de produção, a cargo do dono** (roteiro abaixo).

### Roteiro de teste de produção

Produção tem uma escola, a Escola Piloto Teste, com status `implantacao`, que a 0056
trata como operacional. Ela tem 1 conta de coordenação, 1 aluno e nenhum
responsável. Há 1 super admin ativo.

**1. Super admin e backoffice.** Entrar com o e-mail do super admin em
`https://app.trilivaedu.com.br`.

- O app chama `sou_super_admin` e não chama `meuPerfil`, porque o super admin não
  tem linha em `usuarios`.
- A tela precisa abrir a área administrativa.
- Abrir as abas "Visão geral", "Escolas" e "Logs": a lista precisa mostrar a Escola
  Piloto Teste.
- Abrir o detalhe da escola.

O que isso exercita: as RPCs `backoffice_*`, que a 0057 não tocou; o
`tenant_operacional` novo, que para token sem escola só responde verdadeiro para o
super admin; e o CORS novo, que libera `app.trilivaedu.com.br`.

**2. Conta da Escola Piloto Teste.** Entrar com a conta de coordenação.

- O painel precisa abrir sem erro.
- O `meuPerfil` lê 7 colunas de `escolas` (`id`, `nome`, `slug`, `logo_url`,
  `cor_acento`, `status`, `plano`), todas liberadas pela 0058.
- Se aparecer "sem permissão" ou 42501 no carregamento, a 0058 está bloqueando uma
  coluna que o app lê. Nesse caso, pare e me mande a mensagem.

**Opcional.** Salvar a marca sem mudar nada. O UPDATE com os mesmos valores não altera
nenhum dado da escola, mas o app grava uma linha `atualizou-marca` em
`logs_coordenacao`. Esse é o único rastro. A ação exercita o grant de UPDATE por
coluna da 0058 e a policy `logs_coordenacao_insert`, que a 0056 reescreveu.

Não está no roteiro, de propósito:

- cadastrar ou excluir aluno em produção: grava dado real;
- trocar senha;
- provisionar credencial.

### Reversão, se algo falhar

- **Banco:** `docs/operacao/reversao/e2-0055-0058-producao.sql`. Não mexe no ledger;
  o comando para isso está no rodapé.
- **Funções:** republicar `docs/arquivo/edge-functions-producao-pre-e2/` e conferir
  o ezbr pela tabela do README.
- As duas camadas revertem separadas.
- Reverter reabre as falhas que a Etapa 2 fechou.
