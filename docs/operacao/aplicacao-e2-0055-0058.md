# Aplicação da Etapa 2: migrations 0055 a 0058 e Edge Functions

**Origem:** `main` em `efdd9db` (PRs #138, #140, #141, #144, #142 e #145 mergeados nessa ordem).
**Aplicadas por:** operação, via MCP (`apply_migration` e `deploy_edge_function`).

| Fase | Projeto | Situação |
|---|---|---|
| 1 | demo `bdjkgrzfzoamchdpobbl` | aplicada em 2026-09-24; **teste com os olhos pendente** |
| 2 | produção `zckyhihxjjbnqjqilymn` | **não iniciada**; depende de aprovação escrita do dono sobre o resultado da fase 1 |

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
- **Teste com os olhos (passo 10), a cargo do dono:**
  - login de coordenação;
  - salvar a marca;
  - abrir a tela do próximo ciclo sem clicar em abrir;
  - cadastrar um aluno.

### Reversão das funções

Não há SQL para isso. Reverter uma função é republicar a partir de `48ff020`, a `main`
antes do #142. O conteúdo publicado antes da janela não foi comparado byte a byte a um
commit. As funções novas funcionam com o banco antes ou depois das migrations, porque
o porteiro lê `escolas.status` com a chave de serviço. Por isso dá para reverter uma
camada sem a outra.

## Fase 2: produção

Não iniciada. Segue os mesmos passos, na mesma ordem e com as mesmas verificações. A
reversão será gerada do catálogo de produção, em arquivo próprio, antes da primeira
migration. Pontos que o demo não garante:

- **A varredura da 0055 precisa rodar de novo.** Produção tem dado próprio, e o zero
  do demo não vale lá.
- **O retrato de antes é outro.** A comparação final é de novo contra o local da
  `main`, não contra o demo.
- **A espera por aprovação estica a janela.** Vale combinar que as chamadas sejam
  aprovadas em sequência.
