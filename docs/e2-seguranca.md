# Etapa 2, primeira fatia — Retirada controlada da `capture-oidc-20260919`

**Data:** 22/09/2026 (consultas entre a leitura do baseline e o fechamento deste
documento, mesma sessão).
**SHA de referência do repositório:** `45843960ccbde01e5652611188ffd03495e47abb`
(`origin/main` no momento desta operação).
**Diagnóstico de origem:** `docs/e0-baseline.md`, Bloco 4.
**Natureza:** execução de escrita, autorizada e escopada ao projeto demo
(`bdjkgrzfzoamchdpobbl`). Produção (`zckyhihxjjbnqjqilymn`) não foi escrita em
nenhum passo — ver verificação final.

## Regra de evidência desta etapa

Mesma regra do baseline, com um estado a mais. Todo item traz a consulta ou
comando usado e a saída.

- **VERIFICADO** — executado e confirmado com evidência abaixo.
- **NÃO VERIFICADO** — não foi possível checar (falta de acesso, dado fora do
  alcance desta sessão).
- **BLOQUEADO** — a ação foi tentada, com evidência de tentativa, e não pôde
  ser concluída por limite de ferramenta ou de permissão desta sessão. Não é
  a mesma coisa que NÃO VERIFICADO: aqui existe certeza sobre o motivo do
  malogro, não incerteza sobre o fato.

## Resultado em uma linha

**Dos três passos planejados, só um foi executável.** A revogação de sessões
e refresh tokens (passo 2) está feita e verificada. A remoção da Edge
Function (passo 1) e a remoção da branch (passo 3) estão **BLOQUEADAS** —
não por decisão, por ausência de ferramenta com permissão para a operação
nesta sessão. C-S01 **não fecha** neste documento. Fica em execução parcial,
com o que falta nomeado e com dono definido (ver "O que precisa acontecer a
seguir").

---

## Ordem executada, e por que não é a do baseline

O baseline (Bloco 4, §3) sugeriu revogar primeiro e remover a função depois.
A tarefa desta etapa pediu o inverso: remover primeiro fecha a emissão de
sessões *novas*; só depois revogar drena o que já existe. Na ordem do
baseline há uma janela — estreita, mas real — em que a sessão é revogada e a
função ainda está viva para emitir uma nova no lugar dela.

**Essa lógica foi conferida, não só aceita, e se sustenta:** com a função
ativa nos dois lados da revogação, reabrir o acesso das mesmas cinco contas
custa uma requisição HTTP a mais para quem já tem o bearer OIDC certo. Não
há razão para preferir a ordem antiga.

Na prática a ordem ficou decidida pelo bloqueio, não pela preferência: a
função não pôde ser removida em nenhum momento desta sessão (ver Passo 1),
então não existiu, para esta execução, uma janela "removido, mas não
revogado" nem o inverso — a torneira seguiu aberta o tempo todo,
independente da ordem escolhida. Revogar imediatamente, assim que confirmado
que a remoção estava bloqueada, continua sendo estritamente melhor do que
esperar: cada hora com as 20 sessões vivas é uma hora a mais de exposição da
coordenação (privilégio mais alto da escola) sem nenhum ganho em troca.

---

## Passo 1 — Remoção da Edge Function `capture-oidc-20260919`

**BLOQUEADO.**

Estado antes (confirmado nesta sessão, `list_edge_functions` em
`bdjkgrzfzoamchdpobbl`): `ACTIVE`, versão 2, `verify_jwt: true`,
`ezbr_sha256: d74f6c5077ffc94acfda2a8926649fede5c184a338821dacc36d488e129bca20`.
Idêntico ao registrado no baseline — nada mudou na função entre 21/09 e hoje.

### O que foi tentado

O MCP Supabase conectado a esta sessão expõe 26 ferramentas. Todas as 26
foram enumeradas por nome nesta sessão: `list_edge_functions`,
`get_edge_function`, `deploy_edge_function`, `list_branches`,
`create_branch`, `delete_branch` (de banco de desenvolvimento, não de Edge
Function), `merge_branch`, `rebase_branch`, `reset_branch`,
`list_extensions`, `list_migrations`, `list_organizations`, `list_tables`,
`list_projects`, `create_project`, `get_project`, `get_organization`,
`get_project_url`, `get_publishable_keys`, `get_advisors`, `query_logs`,
`execute_sql`, `apply_migration`, `generate_typescript_types`,
`pause_project`, `restore_project`, `search_docs`. **Nenhuma delas apaga ou
desativa uma Edge Function.** `deploy_edge_function` cria versão nova; não
existe remoção.

Verificado também: sem CLI da Supabase instalado neste ambiente
(`command -v supabase` não encontra o binário) e sem token de Management API
nas variáveis de ambiente (`env | grep -i supabase` não retorna nenhuma
credencial utilizável para chamar a API de gestão fora do MCP).

**Decisão tomada:** não contornar. Não existe token de Management API
disponível para chamada HTTP direta, e mesmo que existisse, usar uma
credencial fora da interface de ferramentas sancionada para fazer o que a
ferramenta deliberadamente não oferece não é uma linha que esta sessão deve
cruzar sozinha. Sobrescrever a função com um código inerte via
`deploy_edge_function` também foi descartado: isso mudaria o `ezbr_sha256` e
o número de versão, mas a função continuaria **existindo e listada** — o
critério de prova que a própria tarefa pede ("não existe mais na lista") não
seria satisfeito, e o relatório estaria afirmando uma remoção que não
ocorreu.

### O que isso significa

A função **continua ACTIVE, reachable e capaz de emitir magic link** para as
cinco contas, usando a chave de serviço, para quem apresentar um JWT OIDC do
GitHub Actions com as claims certas. A superfície descrita no Bloco 4 não foi
reduzida por esta sessão. Passo 2 (revogação) reduziu o que já estava
emitido; não reduziu o que pode voltar a ser emitido.

---

## Passo 2 — Arquivamento do código-fonte

**VERIFICADO.**

Código obtido via `get_edge_function(bdjkgrzfzoamchdpobbl,
capture-oidc-20260919)` nesta sessão, idêntico ao `ezbr_sha256` acima.
Salvo em [`docs/arquivo/capture-oidc-20260919/index.ts`](../arquivo/capture-oidc-20260919/index.ts).

Conferido linha a linha antes de salvar: as duas únicas leituras de
ambiente no código são `Deno.env.get("SUPABASE_URL")` e
`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` — nomes de variável, nunca
valor. Não há chave, token ou segredo literal no arquivo. `AUD`, `ISS`,
`REPO`, `REF` e o mapa de `profiles` são configuração/lógica pública, não
segredo. A cópia é fiel e sem redação necessária.

---

## Passo 3 — Revogação de sessões e refresh tokens

**VERIFICADO.**

### Estado antes (consulta própria, não copiada do baseline)

```sql
select u.email, u.id as user_id, count(s.id) as sessoes,
       count(r.id) filter (where not r.revoked) as tokens_vivos,
       max(s.created_at) as ultima_sessao_criada
from auth.users u
left join auth.sessions s on s.user_id = u.id
left join auth.refresh_tokens r on r.session_id = s.id
where u.email in (…as seis contas…)
group by 1,2 order by 1;
```

| Conta | Sessões | Tokens vivos | Última sessão |
| --- | --- | --- | --- |
| `coordenacao@meridiano.demo` | 6 | 6 | 2026-09-19 21:29:06Z |
| `merihele2027@codigo.acesso.local` | 7 | 7 | 2026-09-19 21:29:06Z |
| `meriresp2027@codigo.acesso.local` | 6 | 6 | 2026-09-19 21:29:06Z |
| `piloto2026a01@codigo.acesso.local` | 1 | 1 | 2026-06-24 00:03:46Z |
| `merialun0003@codigo.acesso.local` | 0 | 0 | nunca |
| `merialun0007@codigo.acesso.local` | 0 | 0 | nunca |

Total **20**, nas 4 contas com sessão — número idêntico ao que a tarefa
citou como "confirmado hoje" e ao que o baseline tinha em 21/09. As duas
contas de aluno mapeadas no código da função (`merialun0003`,
`merialun0007`) nunca tiveram sessão; não entraram na revogação porque não
havia o que revogar nelas.

### Execução

Dois comandos, nesta ordem — tokens revogados antes das sessões apagadas,
para não depender de comportamento de cascade entre as duas tabelas:

```sql
update auth.refresh_tokens
set revoked = true, updated_at = now()
where user_id in (dddddddd-c000-…-001, dddddddd-b000-…-001,
                   dddddddd-c000-…-002, f1000001-0000-…-001)
  and revoked = false
returning id, user_id, session_id, revoked;
-- 20 linhas, todas revoked=true
```

```sql
delete from auth.sessions
where user_id in (dddddddd-c000-…-001, dddddddd-b000-…-001,
                   dddddddd-c000-…-002, f1000001-0000-…-001)
returning id, user_id, created_at;
-- 20 linhas apagadas
```

Contagem por conta bate exatamente com o estado "antes": 6 + 7 + 6 + 1 = 20
em cada chamada.

### Estado depois

Reconsulta com a mesma query do "antes":

| Conta | Sessões | Tokens vivos |
| --- | --- | --- |
| `coordenacao@meridiano.demo` | 0 | 0 |
| `merihele2027@codigo.acesso.local` | 0 | 0 |
| `meriresp2027@codigo.acesso.local` | 0 | 0 |
| `piloto2026a01@codigo.acesso.local` | 0 | 0 |
| `merialun0003@codigo.acesso.local` | 0 | 0 |
| `merialun0007@codigo.acesso.local` | 0 | 0 |

Zero sessões, zero tokens não revogados, nas 6 contas. Alcance exatamente o
pedido pela tarefa, nem mais nem menos — nenhuma outra conta do projeto foi
tocada.

---

## Passo 4 — Remoção da branch `tmp/triliva-pack-build-20260919`

**BLOQUEADO.**

### Verificação feita antes de cogitar apagar

SHA completo confirmado por `git ls-remote` e por `git fetch`:
`d4b03d7b94a82d8b8e840b11f5703bc8ad6d6739`. Idêntico ao baseline.

A primeira comparação desta sessão (`main` local × branch) apontou 42
commits e 47 arquivos exclusivos da branch — incluindo código de aplicação
(`ProximoCiclo.jsx`, migrations, testes). **Esse resultado estava errado**:
o `main` local deste workspace é um ponteiro obsoleto
(`3e50dd08…`), desatualizado em relação ao `origin/main` real
(`45843960…`, o mesmo SHA do `HEAD` desta sessão). Refeita a comparação
contra o `HEAD` correto:

```
git log HEAD..d4b03d7b --oneline   → 12 commits, todos "tmp: …"
git diff HEAD...d4b03d7b --stat    → 4 arquivos:
  .github/workflows/tmp-export-triliva-dist.yml | 42 ++
  _capture_dist.meta                            |  3 +
  _capture_dist.partaa                          |  1 +
  _capture_dist.partab                          |  1 +
```

Nenhum arquivo de aplicação, teste, seed ou migration é exclusivo da
branch — isso era artefato da comparação errada. O que a branch tem e a
`main` não tem é só o workflow de export e partes de um artefato de build
empacotado. Conteúdo do `tmp-export-triliva-dist.yml` lido por inteiro: faz
checkout do SHA fixo `1ac7c64…` (que está na `main`), `npm ci`, build, empacota
`dist` e sobe artefato com `retention-days: 1`. Sem menção a
`capture-oidc`, sem uso de chave de serviço.

`.github/workflows/tmp-capture-triliva.yml` — o workflow que a função exige
na claim `workflow_ref` — **não está na ponta da branch**
(`git ls-tree d4b03d7b -- .github/workflows/` lista só `ci.yml`,
`codeql.yml`, `manter-banco-acordado.yml`, `tmp-export-triliva-dist.yml`).
Ele existiu na história da branch e foi removido pelo próprio commit de
ponta, `d4b03d7 "tmp: remove capture helper after pack generation"`. Isso
não zera o risco — quem tem push pode recriar o arquivo com um commit novo
na branch existente, e a claim `ref` volta a bater — mas confirma que **não
há nada de valor sendo perdido ao apagar a branch**, e que apagá-la eleva
a barra: sem a branch, rearmar exige criar uma branch nova com esse nome
exato, um evento mais visível do que empurrar para uma branch parada que já
existe. Não achei motivo para "parar e perguntar" — a checagem que a
tarefa pediu se sustenta.

### O que foi tentado

```
git push origin --delete tmp/triliva-pack-build-20260919
  → error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403

git push origin ":refs/heads/tmp/triliva-pack-build-20260919"
  → mesmo erro, HTTP 403, reproduzido numa segunda sintaxe
```

Confirmado que **não** foi falha de leitura minha: a primeira checagem
pós-tentativa usava `grep … || echo "confirmado"`, que mascararia tanto
"branch sumiu" quanto "o próprio `ls-remote` falhou" com a mesma mensagem.
Refeita sem esse mascaramento —
`git ls-remote origin refs/heads/tmp/triliva-pack-build-20260919`, exit
code 0, retorna a branch normalmente. **A branch continua no remoto.**

O MCP GitHub, à parte, não expõe nenhuma ferramenta de remoção de branch ou
de ref (só cria: `create_branch`; a única ferramenta de "delete" do servidor
é `delete_file`, para arquivo, não para ref).

### O que isso significa

O credential de git desta sessão consegue enviar commits para a branch
designada (`claude/triliva-remove-capture-oidc-6qwhsm`) mas não tem
permissão para apagar uma ref arbitrária do repositório — o 403 é
reproduzível, não intermitente. A branch `tmp/triliva-pack-build-20260919`
segue existindo, com a claim `ref` que a função aceita.

---

## Verificação final

### Edge Functions do demo — as outras 7 não mudaram

`list_edge_functions(bdjkgrzfzoamchdpobbl)`, antes e depois dos passos 2–4:
mesmos slugs, mesmas versões, mesmos `ezbr_sha256`, nos dois momentos.
`capture-oidc-20260919` também idêntica nos dois momentos (v2,
`d74f6c50…`) — consistente com "nenhuma escrita foi feita nela", não com
"foi removida".

| slug | versão | `ezbr_sha256` |
| --- | --- | --- |
| `provisionar-aluno` | 7 | `402c5f3c…` |
| `gerar-meta` | 7 | `28e7a1cd…` |
| `virar-semana` | 5 | `deef4ac7…` |
| `lgpd-titular` | 5 | `79cfb079…` |
| `backoffice-coordenador` | 8 | `f1cd2e67…` |
| `revogar-responsavel` | 5 | `6e90f899…` |
| `trocar-senha` | 2 | `d4313842…` |

Idêntico ao baseline (21/09) e a esta sessão antes de qualquer ação —
nenhum dos três achados nesta etapa mexeu nas funções de produto.

### Produção — intacta

`list_edge_functions(zckyhihxjjbnqjqilymn)` nesta sessão: as mesmas 7
funções, mesmas versões, mesmos `ezbr_sha256` do baseline. Nenhuma chamada
de escrita (`execute_sql`, `apply_migration`, `deploy_edge_function` ou
qualquer outra) foi emitida contra `zckyhihxjjbnqjqilymn` nesta sessão — a
única ferramenta usada nesse projeto foi a leitura `list_edge_functions`,
duas vezes (antes e depois), para ter prova de que nada mudou.

### Sessões e branch

Sessões: ver tabela "depois" do Passo 3 — zero nas 6 contas.
Branch: continua no remoto — ver Passo 4. **Não** está apagada.

---

## NÃO VERIFICADO — JWT expiry

Pedido ao dono do repositório no início desta sessão. Sem resposta até o
fechamento deste documento. Por isso, e conforme a própria tarefa instruiu
para esse cenário: entrego o resto e deixo isto como NÃO VERIFICADO em vez
de estimar.

Sem esse número não dá para afirmar por quanto tempo um *access token* já
emitido antes da revogação de hoje continua sendo aceito pela API — a
revogação de sessão e refresh token impede *renovação*, não invalida
imediatamente um JWT de acesso que já foi emitido e ainda não expirou. Como
o Bloco 4 já registrou, isso é o menor dos dois problemas (a renovação
indefinida era o maior, e essa parte está fechada agora), mas segue sendo
um ponto real, não decorativo, enquanto o número não vier.

---

## Encerramento formal — C-S01

| Campo | Valor |
| --- | --- |
| **ID** | C-S01 |
| **Decisão** | **Execução parcial — não fechado.** Revogação de sessões/refresh tokens concluída e verificada. Remoção da Edge Function e remoção da branch: BLOQUEADAS por limite de ferramenta/permissão desta sessão, não por escolha. |
| **SHA** | Repositório: `45843960ccbde01e5652611188ffd03495e47abb`. Branch não apagada: `d4b03d7b94a82d8b8e840b11f5703bc8ad6d6739`. Função arquivada: `ezbr_sha256 d74f6c5077ffc94acfda2a8926649fede5c184a338821dacc36d488e129bca20`. |
| **Ambiente** | DEMO (`bdjkgrzfzoamchdpobbl`) — único ambiente escrito. Produção (`zckyhihxjjbnqjqilymn`) verificada intacta, zero escrita. |
| **Teste** | (a) `list_edge_functions` antes/depois nos dois projetos; (b) `SELECT` de sessões/refresh tokens antes/depois nas 6 contas; (c) `git ls-remote` da branch antes/depois das tentativas de apagar, sem mascarar falha. |
| **Resultado esperado** | Função fora da listagem; branch fora do remoto; zero sessões/tokens nas 4 contas; as outras 7 funções e a produção inalteradas. |
| **Resultado observado** | Zero sessões/tokens: **atingido**. Função ainda `ACTIVE` na listagem, hash inalterado: **não atingido, bloqueado**. Branch ainda no remoto: **não atingido, bloqueado**. Outras 7 funções e produção inalteradas: **atingido**. |
| **Responsável** | Sessão Claude Code, conta `mylenagabriel08@gmail.com`, branch `claude/triliva-remove-capture-oidc-6qwhsm`. |
| **Data** | 2026-09-22. |

### O que precisa acontecer a seguir, para C-S01 fechar de fato

1. Alguém com acesso ao painel do Supabase (ou um token de Management API
   concedido a esta ferramenta) apaga `capture-oidc-20260919` manualmente —
   é uma ação de segundos no painel, sem o bloqueio que esta sessão tem.
2. Alguém com permissão de apagar refs neste repositório (o dono, ou um
   token com esse escopo) apaga `tmp/triliva-pack-build-20260919`.
3. O número de `JWT expiry` do projeto demo, para fechar a última
   pendência do Bloco 4.

Até lá, a mitigação real desta etapa é a do Passo 2: as 20 sessões e
tokens que já existiam estão mortos. A função em si segue podendo emitir
sessões novas para as mesmas cinco contas a quem tiver o OIDC certo.

---

## Achados abertos, registrados e não tocados nesta fatia

Fora do escopo desta operação por instrução explícita. Listados aqui só
para o rastro ficar completo; nenhum dos cinco foi lido, testado ou
alterado nesta sessão.

| ID | Tema |
| --- | --- |
| C-S02 | CORS |
| C-S04 | Fallback permissivo do `tenant_operacional` (já referenciado em `docs/e1-migrations.md:671` como pendência de Etapa 2) |
| C-S05 | Senha vazada (proteção `auth_leaked_password_protection`, já visível como advisory WARN no baseline, Bloco 2) |
| C-S06 | Classificação das RPCs privilegiadas |
| C-S07 | Classificação da chave anon |
| — | Matriz de testes de autorização com duas escolas |

---

## Efeito colateral para quem for apresentar a vitrine

A revogação do Passo 3 **desloga** as quatro contas de demonstração:
`coordenacao@meridiano.demo`, `merihele2027@codigo.acesso.local`,
`meriresp2027@codigo.acesso.local` e `piloto2026a01@codigo.acesso.local`.
Quem for logar nelas hoje precisa entrar de novo — a sessão anterior não
existe mais.

---

## O que contradisse o Bloco 4

O diagnóstico do Bloco 4 sobre **o que a função faz** e **o que estava
emitido** se confirmou ponto a ponto nesta sessão: código idêntico, mesmo
hash, mesmas 5 contas mapeadas, mesmos números de sessão (a única conta que
mudou entre 21/09 e hoje foi a contagem — que não mudou; os números batem
exatos). Nada no comportamento da função ou nos dados divergiu do que o
baseline registrou.

O que o Bloco 4 **não previu**, porque não era o escopo dele investigar
ferramental — foi escopo desta etapa: **nem a remoção da função nem a
remoção da branch são executáveis com o que esta sessão tem em mãos.** O
Bloco 4 tratou os dois como passos de execução direta ("remover a função",
"apagar a branch"); na prática, os dois exigem uma credencial ou ferramenta
que este ambiente não concede a este agente. Isso não é uma falha do
diagnóstico — é uma lacuna que só aparece na hora de agir, e fica registrada
aqui para a próxima sessão não presumir que é só repetir os comandos.
