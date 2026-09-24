# Etapa 2 — Segurança: registro corrente

**O que é este documento.** O registro da Etapa 2 do roadmap: para cada item
C-S01 a C-S07 e cada complemento do relatório G, a decisão e a prova. É
atualizado ao fim de CADA fatia. Se uma sessão acabar no meio da etapa, a
próxima retoma daqui: a tabela "Estado corrente" diz o que já fechou, o que
depende do dono e o que falta fazer.

**Regra de evidência.** A mesma do baseline (`docs/e0-baseline.md`) e da
primeira execução (Anexo A, no fim deste arquivo): cada afirmação traz a
consulta, o comando ou o arquivo com linha. Estados possíveis:

- **FECHADO**: decisão tomada e prova registrada aqui.
- **PENDENTE DO DONO**: o que falta é uma ação que só o dono do projeto faz
  (painel, permissão, decisão de produto).
- **PENDENTE DE ETAPA**: depende de outra etapa do roadmap (E3, E5, E6, E8).
- **NÃO VERIFICADO**: não deu para checar nesta sessão, e não se afirma.

"Implementado" sem verificação não é encerramento. PENDENTE nunca recebe
rótulo de seguro.

**Travas desta etapa.** Produção e demo: só leitura. Nenhuma migration nova e
nenhuma Edge Function alterada é aplicada em ambiente hospedado; cada uma sai
num PR com a condição de aprovação escrita. Testes em Postgres local
descartável. Nenhum valor de secret, senha ou token neste arquivo.

---

## ⚠️ Falha entre escolas aberta (achada na Fatia 2)

**Registrada em 24/09/2026, antes de continuar a matriz.** Correção no
**PR #138** (`0055_coerencia_tenant`), marcado URGENTE, não aplicado em
ambiente nenhum.

As policies de escrita conferem `escola_id = tenant` na linha, mas as FKs
apontam só para o `id`, e FK não passa por RLS. A coordenação da escola A
grava na própria escola uma linha que aponta para aluno, turma ou conta
da escola B. Provado em Postgres local, em transação desfeita:

1. **Exclusão de conta entre escolas.** A aponta o `usuario_id` de um aluno
   seu (ou um vínculo de responsável) para a conta da coordenação de B e
   pede a exclusão LGPD desse aluno. `lgpd_usuarios_do_aluno` devolve a
   conta de B; `lgpd-titular` apaga no Auth e no banco.
2. **Leitura entre escolas.** A planta `aluno_onboarding` para o aluno de
   B; quando ele responde, as respostas vão para a linha de A. A lê, B não.
3. **Leitura entre escolas pela exportação LGPD.** Turma de B matriculada
   num aluno de A aparece na exportação desse aluno. Linhas plantadas por
   A também entram na exportação que B fizer do próprio aluno.

**Condição:** conhecer o UUID do alvo, que a API não entrega. **Hoje não
há vítima:** produção tem uma escola de teste só; vale a partir da segunda
escola real. **Gate G2 não fecha com isto aberto.**

**O que NÃO se confirmou:** repontar a própria `meta_atividades` para a
meta de outra escola, para ganhar XP pelo gatilho `progresso_de_missao`,
é barrado. Com `WHERE` na atualização (o PostgREST sempre manda filtro, e
`safeupdate` recusa UPDATE sem filtro), a linha nova precisa passar na
policy de SELECT, e a meta de B é invisível para o aluno de A.

## Estado corrente

**Atualizado em:** 24/09/2026, fim da Fatia 6.
**SHA de referência:** `fc564124bf7f735ddbb32d89b65169e11be18a33` (`main`).

| Item | Estado | O que falta | Prova |
| --- | --- | --- | --- |
| **C-S01** capture-oidc | **PENDENTE DO DONO** | Apagar a função no painel do Supabase (demo); apagar a branch `tmp/triliva-pack-build-20260919`; ler o JWT expiry no painel | [Fatia 1](#fatia-1--c-s01-com-o-estado-de-2409) |
| C-S02 CORS | **PENDENTE DO DONO** (correção pronta) | Ler se `ALLOWED_ORIGINS` existe em cada projeto; aprovar o redeploy das 7 funções (#142); decidir se produção aceita preview | [Fatia 5](#fatia-5--c-s02-cors) |
| C-S03 credenciais no Vercel | **PENDENTE DO DONO** (remoção feita e provada; rotação planejada) | Executar o plano de rotação (`docs/operacao/plano-rotacao-chaves-supabase.md`, #143): passo 0 no painel e aprovações. Prazo: antes do primeiro aluno real e até 01/12/2026, porque as chaves legadas param no fim de 2026. Conferir as variáveis compartilhadas do time Vercel | [Fatia 6](#fatia-6--c-s03-c-s05-e-c-s07) |
| C-S04 `tenant_operacional` | **PENDENTE DO DONO** (correção pronta) | Aprovar a aplicação da 0056 (#140, empilhado no #138) em demo e produção | [Fatia 3](#fatia-3--c-s04-tenant_operacional-nega-por-padrão) |
| C-S05 senha vazada | **PENDENTE DE ETAPA (E8)** | Ligar e testar na ativação do Pro, pela lista em `auth-credenciais-checklist.md` (#143). Testar se a checagem vale no caminho da `trocar-senha` (API de admin) | [Fatia 6](#fatia-6--c-s03-c-s05-e-c-s07) |
| C-S06 SECURITY DEFINER | **PENDENTE DO DONO** (correção pronta) | Aprovar a 0057 (#141); conferir no painel se `app` está em "Exposed schemas" (o advisor da Supabase indica que não está, ver Fatia 6) | [Fatia 4](#fatia-4--c-s06-security-definer) |
| C-S07 chave anon | **PENDENTE DE ETAPA (E3)**, só a leitura do deploy de produção | Banco provado: `anon` não lê, não altera, não executa nada. Falta ver, por HTTP, que o bundle publicado em produção usa uma chave de papel `anon` do projeto de produção (o valor no Vercel não é legível e a rede desta sessão não alcança o domínio) | [Fatia 6](#fatia-6--c-s03-c-s05-e-c-s07) |
| Matriz de autorização | **camada banco: FEITA** · camada HTTP: **PENDENTE DE ETAPA (E3)** | 45 divergências registradas, cada uma com a correção; 14 casos HTTP especificados para a E3 | #139, [Fatia 2](#fatia-2--matriz-de-autorização) |
| Complementos G | em andamento (Fatia 7) | — | — |

## PRs da etapa

| Fatia | PR | Condição de merge |
| --- | --- | --- |
| 1 · C-S01 e sessões da captura | #131 (este) | CI verde. Não aplica nada em ambiente hospedado. Ver "Condição de merge" na Fatia 1. |
| **URGENTE** · 0055 coerência de tenant | #138 | CI verde para o merge. **Aplicação em demo e produção só com aprovação do dono**, antes da segunda escola real. |
| 2 · matriz de autorização | #139 | CI verde. Só testes e evidência; nada aplicado. Ordem com o #138 indiferente. |
| 3 · C-S04 (0056) | #140, **base = #138** | Merge depois do #138 (numeração contígua de migrations). Aplicação só com aprovação. |
| 4 · C-S06 (0057) | #141, **base = #140** | Merge depois do #140. Aplicação só com aprovação. |
| 5 · C-S02 CORS | #142 (da `main`) | CI verde. Aplicação = redeploy das 7 funções, só com aprovação. |
| 6 · C-S03, C-S05, C-S07 | #143 (da `main`) | CI verde. Só testes e documentação; nada aplicado. O plano de rotação não foi executado. |

---

## Fatia 1 — C-S01 com o estado de 24/09

**Data:** 24/09/2026. Consultas de leitura, sem nenhuma escrita em demo ou
produção.

### O que mudou desde 22/09

#### A função virou lápide, mas continua existindo

`get_edge_function(bdjkgrzfzoamchdpobbl, capture-oidc-20260919)` em 24/09:

| Campo | 22/09 (Anexo A) | 24/09 |
| --- | --- | --- |
| Versão | 2 | **3** |
| `ezbr_sha256` | `d74f6c50…` | `7571153ba692201c2435f7b77ec84c93232fcbbf58d522626efdcb3a398ebab1` |
| Atualizada em | 19/09 | 24/09 13:27:33 UTC |
| Status | ACTIVE | ACTIVE |
| `verify_jwt` | true | true |

O código publicado da versão 3 é uma lápide: `Deno.serve` devolve **410**
com `{"error":"desativada"}` para qualquer requisição. Não lê variável de
ambiente, não instancia cliente Supabase, não toca banco, não emite link. O
comentário no topo diz que foi desativada a pedido do dono e que falta apagar
pelo painel. Quem publicou a versão 3 não está registrado em lugar que esta
sessão alcance; o que se afirma é o conteúdo publicado, não a autoria.

**Consequência.** A emissão de sessões está fechada: com a versão 3, nenhum
bearer OIDC, válido ou não, gera magic link. O risco de "rearmar" descrito no
baseline (recriar o workflow na branch `tmp/`) deixou de existir **enquanto a
versão 3 for a publicada**, porque o código que validava o OIDC e chamava
`generateLink` não está mais lá. Voltar a emitir exigiria publicar outra versão
da função, e isso já exige acesso de gestão ao projeto. Mesmo assim o item não
fecha: a função ainda aparece na listagem, e o critério do roadmap é ela
deixar de existir.

#### Sessões: zero, reconferido hoje

```sql
select (select count(*) from auth.sessions) as sessoes_total,
       (select count(*) from auth.refresh_tokens where not revoked) as refresh_vivos,
       (select count(*) from auth.sessions where not_after is null) as sessoes_sem_not_after,
       (select max(last_sign_in_at) from auth.users) as ultimo_login,
       (select max(created_at) from auth.sessions) as ultima_sessao;
```

Demo (`bdjkgrzfzoamchdpobbl`), 24/09 por volta de 17:50 UTC:
`sessoes_total 0 · refresh_vivos 0 · sessoes_sem_not_after 0 · ultimo_login 2026-09-19 21:29:06Z · ultima_sessao null`.

Nenhuma conta do demo tem sessão. O último login continua sendo o de 19/09:
ninguém entrou no demo depois da revogação de 22/09 (incluindo a captura v2,
que ainda não teve execução oficial).

#### Branch `tmp/triliva-pack-build-20260919`: continua no remoto

`list_branches` em 24/09: `tmp/triliva-pack-build-20260919` →
`d4b03d7b94a82d8b8e840b11f5703bc8ad6d6739`, o mesmo SHA do baseline. Esta
sessão também não tem permissão para apagar ref (o Anexo A documenta o 403).
Com a função na versão 3 a branch não arma mais nada; apagá-la é limpeza, e
fecha o item.

#### JWT expiry: evidência indireta, leitura do painel pendente

**NÃO VERIFICADO no painel.** O que esta sessão alcança é o banco. Os dois
projetos têm, em `pg_db_role_setting`, a configuração de banco inteiro
`app.settings.jwt_exp=3600`:

```sql
select coalesce(pg_get_userbyid(setrole), '*'), array_to_string(setconfig, ' ; ')
from pg_db_role_setting;
-- linha com setrole = 0 (vale para o banco todo): app.settings.jwt_exp=3600
```

Demo e produção devolvem o mesmo valor. É o número que a plataforma grava no
banco, e ele indica **3600 segundos (1 hora)** de validade do access token. É
indício forte, não leitura da configuração do Auth. O dono confirma no painel
do Supabase, na configuração de expiração do JWT (access token) de cada
projeto. Se o painel disser 3600, a janela residual de um token emitido antes
de uma revogação é de no máximo 1 hora.

### A sucessora da C-S01: a captura v2 deixava sessões para sempre

`scripts/captura/pack-v2.mjs` entra pela tela com os segredos do Actions.
Cada execução fazia **quatro** logins, não três: aluno, responsável e
coordenação pelo navegador, e mais um da coordenação pelo supabase-js, para
a conferência dos números. Nenhum era encerrado, e o comentário na linha 469
explicava o motivo: o `signOut()` padrão do supabase-js é global e derrubaria
as outras sessões da conta. Como `not_after` é nulo nos dois projetos, cada
execução deixava quatro sessões que nunca expiram. O refresh token morria
com o runner, então não era acesso vivo. Era acúmulo que ninguém limpava.

**O que mudou (este PR):**

- `scripts/captura/pack-v2-lib.mjs`: função pura `sessaoDoEstado`, que tira
  o par de tokens do estado do navegador (`localStorage`, chave
  `sb-<projeto>-auth-token`, a padrão do supabase-js, que o app não
  sobrescreve em `app/src/lib/supabase.js`).
- `scripts/captura/pack-v2.mjs`:
  - depois de cada login, guarda o par de tokens **só em memória**;
  - cada aba que reabre um estado guarda o estado mais novo ao fechar, porque
    o app pode renovar o token e girar o refresh token;
  - no fim, encerra cada sessão com `setSession` + `signOut({ scope: "local" })`.
    O Auth apaga só a sessão cujo id está no token, a que a execução abriu, e
    as outras sessões da conta ficam intactas;
  - a sessão da conferência é encerrada do mesmo jeito, num `finally`, mesmo
    que a conferência falhe;
  - o resultado vai para o arquivo interno (`sessoesEncerradas`: perfil e
    "encerrada (scope local)" ou "NÃO encerrada: motivo"), sem token. Falha em
    encerrar vira aviso no log do Actions, não derruba o pack;
  - os tokens entram na lista de valores proibidos: `redigir()` troca por
    `•••` em qualquer mensagem, e a conferência final derruba o pack se algum
    aparecer em arquivo.
- `tests/bloco5-captura.test.mjs`, seção "Etapa 2, Fatia 1": 8 testes em três
  camadas (no arquivo de testes da captura que já existia, para não mexer na
  contagem de arquivos do índice e não criar conflito entre os PRs da etapa):
  1. `sessaoDoEstado` acha o par na chave certa e devolve `null` para outro
     projeto, JSON quebrado, par incompleto ou estado vazio;
  2. inspeção do runner: todo `signOut` tem `scope: "local"`, nenhum
     `storageState` com `path`, o encerramento vem depois da conferência;
  3. o **supabase-js real do app contra um Auth falso local**: o caminho do
     runner manda `POST /auth/v1/logout?scope=local` com o bearer daquela
     sessão, e o `signOut()` sem escopo manda `scope=global`.

**Mutação conferida:** trocar um `signOut({ scope: "local" })` do runner por
`signOut()` derruba o teste "todo signOut tem scope local". Resultado local:
`bloco5-captura` inteiro, 39/39. Suíte completa: **1063/1063** em Postgres
16.13 local descartável (os hospedados são 17.6; a diferença não toca estes
testes, que não usam banco).

**Limite honesto.** O teste 3 prova o que o supabase-js envia, contra um
servidor falso. Que o Auth real do Supabase apague só aquela sessão com
`scope=local` é contrato documentado do GoTrue, não algo executado aqui (a
rede desta sessão não alcança `*.supabase.co`). A prova de ponta a ponta é a
próxima execução da captura: depois dela, `auth.sessions` do demo tem que
voltar a zero.

### O artefato do workflow não guarda sessão

`.github/workflows/captura-pack-v2.yml`, conferido em 24/09:

- `storageState` só existe em memória (`c.storageState()` sem `path`).
- Sem trace, vídeo ou HAR. O runner recusa rodar com `DEBUG=pw:*` ou
  `PWDEBUG`, e o workflow zera os dois.
- O passo "Confere o que vai ser publicado" é uma lista fechada: só `*.png`,
  `MANIFESTO.md`, `CAPTURA.json`, `CHANGELOG.md`, `COERENCIA-HELENA.md`,
  `SHA256SUMS.txt` e `CAPTURA-INTERNA*.json`. Qualquer outro arquivo derruba
  a publicação.
- O arquivo interno leva falhas redigidas, avisos, método e caminho das
  requisições bloqueadas (sem query string) e agora `sessoesEncerradas`.
  Nenhum cookie: o supabase-js guarda a sessão em `localStorage`, não em
  cookie.
- Só roda por `workflow_dispatch`, a partir da `main`, com `contents: read`.
  PR de fork não recebe os seis segredos.

### O botão "Sair" do app faz logout GLOBAL

`app/src/shared/data/index.js:74`: `sair()` chama `supabase.auth.signOut()`
sem escopo. No supabase-js 2.116 (o do app) o padrão é `global`, e o teste 3
acima prova o que é enviado. **Comportamento de produto, registrado e não
alterado nesta etapa:** sair num aparelho desloga a mesma conta em todos os
outros. Para aluno e responsável, que entram por código, isso quer dizer que
duas pessoas usando a mesma credencial se derrubam. Nas contas de
demonstração, quem clica em "Sair" durante uma apresentação derruba a captura
que estiver rodando, e vice-versa. Se o produto preferir `local`, é uma linha
em `sair()` e a troca do teste que trava o comportamento atual.

### Encerramento da C-S01, pronto para o dono

| Campo | Valor |
| --- | --- |
| **ID** | C-S01 |
| **Decisão** | Retirar a função e a branch. Sessões já revogadas (22/09). Emissão já neutralizada (lápide v3, 24/09). |
| **SHA** | Repositório `fc564124bf7f735ddbb32d89b65169e11be18a33`. Branch `d4b03d7b94a82d8b8e840b11f5703bc8ad6d6739`. Função v3 `7571153ba692201c2435f7b77ec84c93232fcbbf58d522626efdcb3a398ebab1`. |
| **Ambiente** | Demo (`bdjkgrzfzoamchdpobbl`). A função nunca existiu em produção. |
| **Teste** | (a) `list_edge_functions` do demo sem `capture-oidc-20260919`; (b) `list_branches` sem `tmp/triliva-pack-build-20260919`; (c) sessões e refresh tokens em zero (feito 24/09); (d) JWT expiry lido no painel. |
| **Esperado** | (a) ausente; (b) ausente; (c) 0/0; (d) um número, em segundos. |
| **Observado** | (a) **ainda listada**, v3 lápide; (b) **ainda no remoto**; (c) **0/0**, 24/09; (d) **NÃO VERIFICADO** no painel; indício de 3600 s no banco. |
| **Responsável** | Dono do projeto, para (a), (b) e (d). |
| **Data** | 24/09/2026 (estado). Fecha na data em que (a), (b) e (d) forem confirmados. |

**Para fechar:** o dono apaga a função no painel do Supabase (projeto demo,
Edge Functions), apaga a branch no GitHub e lê o JWT expiry. Depois, uma
sessão com leitura roda (a) e (b) de novo e muda o estado para FECHADO nesta
tabela.

### Condição de merge deste PR

- Só documentação, um script de operador (`pack-v2`) e testes. Nada é
  aplicado em ambiente hospedado.
- CI verde: `build-e-unitarios` roda os 8 testes novos junto com a suíte.
- Efeito em produção: nenhum. Efeito no demo: a próxima execução da captura
  passa a apagar as quatro sessões que ela mesma abrir.

---

## Fatia 2 — Matriz de autorização

**Data:** 24/09/2026. **PR:** #139. **Evidência gerada:**
`docs/evidencias/e2-matriz-autorizacao.json` (commit `4e3fe57`, Postgres
16.13 local; os hospedados estão no 17.6).

### O que é

318 casos na **camada banco**, rodando no CI (`build-e-unitarios`):

- **Fixture só local:** escolas A e B na mesma trilha, C com outra, uma
  suspensa, uma cancelada, e um token de escola inexistente.
- **20 personas:** anônimo, alunos, responsáveis vinculado, sem vínculo e
  revogado, coordenações de cada escola, sem escola no token e com
  claims antigas, super admin ativo, falso e inativo.
- **Superfícies:**
  - tabelas com tenant: ler, alterar, apagar, inserir na outra escola,
    mover o `escola_id`, UPSERT com id alheio, FK cruzada;
  - as nove tabelas do catálogo compartilhado;
  - aluno contra colega;
  - responsável;
  - backoffice;
  - RPCs com ID de outro tenant;
  - funções `app.*` com EXECUTE amplo;
  - claims antigas;
  - escola não operacional;
  - anônimo;
  - cenários de várias etapas.

**Como prova:**
- Transação `REPEATABLE READ`, sempre desfeita no fim.
- Hash de todas as linhas das tabelas envolvidas antes e depois de cada caso.
- O mesmo comando sem RLS precisa afetar linha, senão a negação é vazia.
- Escritas sem RETURNING, que é o caminho da API com `return=minimal`.
- Os grants do hospedado são reproduzidos na transação: lá `anon` e
  `authenticated` têm DML de tabela e só a RLS segura.
- Trava de destino: só roda em `127.0.0.1` e em banco `rumo_teste*`.

**Mutações conferidas:**
- policy `update using (true)` em `trilhas`: a matriz pega (achado NOVO);
- `select using (true)` em `registros_estudo`: 6 casos caem.

### Placar

| Camada | Provados | Divergentes (registrados) | PENDENTE-E3 |
| --- | --- | --- | --- |
| Banco | 273 conformes de 318 | 45: FK cruzada e cenários (18) → 0055/#138 · C-S04 (20) → 0056 · C-S06 (6) → 0057 · E1-ACHADO-2 (1) | — |
| HTTP | 0 | — | 14 (ver `camada_http` no JSON: Accept-Profile, login por persona, PostgREST, as 7 Edge Functions sem bearer / malformado / expirado / outro tenant / método / OPTIONS, refresh com claims antigas, limite do login por código) |

### O que a matriz mostrou, além da falha do topo

- **Barrado, e provado:**
  - leitura e escrita entre A e B nas 23 tabelas com tenant, nos dois
    sentidos;
  - UPSERT com id alheio;
  - mudança de `escola_id` (WITH CHECK);
  - escrita no catálogo pelas nove tabelas;
  - aluno contra colega;
  - responsável sem vínculo ou revogado;
  - coordenação, super admin falso e inativo, e anônimo no backoffice;
  - aluno marcando atividade de meta alheia.
- **Achado C-S04b, mais largo que o C-S04:** a 0027 bloqueou escola
  suspensa ou cancelada só em parte das policies. A coordenação dessas
  escolas ainda grava configuração, missões, log de coordenação,
  onboarding e toda a gamificação (XP, conquistas, missões, níveis,
  eventos de progresso). Não é entre escolas, mas fura a suspensão.
  Correção na Fatia 3 (0056).
- **C-S06 medido:** 6 funções `app.*` SECURITY DEFINER com EXECUTE para
  `authenticated` e parâmetro de escola ou aluno (`backfill_progresso`,
  `motor_avaliar_aluno`, `motor_conquista_xp`,
  `desbloquear_conquista_basica`, `exam_tag_do_aluno`,
  `motor_streak_dias`) executam com o ID da escola B. Só são
  alcançáveis pela API se `app` estiver entre os schemas expostos do
  PostgREST: **NÃO VERIFICADO**, porque a rede desta sessão não alcança
  `*.supabase.co`. `anon` não tem USAGE em `app` nos dois projetos
  (medido), então o EXECUTE de `anon` nelas não tem efeito. Correção na
  Fatia 4 (0057).
- **E1-ACHADO-2, variante entre escolas:** a coordenação A cria edição
  nova no catálogo de uma trilha que só a escola C usa. Continua aberto
  como decisão de produto (docs/e1-migrations.md).

### Comportamentos registrados, não tratados como falha

- **Claims antigas:** a ex-coordenação (`usuarios.papel` já trocado)
  continua coordenação enquanto o token valer, porque as policies leem o
  papel do JWT. A janela é o JWT expiry (indício de 3600 s). Se o
  `app_metadata` não for trocado no Auth, o refresh reemite as claims
  antigas e a janela vira indefinida. Esse teste é HTTP: PENDENTE-E3
  (`H.auth.refresh_reemite_claims`).
- **Responsável revogado:** perde o aluno na hora, porque o vínculo é
  lido ao vivo. A conta segue autenticada e lê a configuração da escola.
- **Catálogo** publicado é legível por qualquer token autenticado,
  inclusive de escola inexistente. Decisão registrada: não é dado de
  escola.

---

## Fatia 3 — C-S04: `tenant_operacional` nega por padrão

**PR:** #140 (0056), empilhado sobre o #138, porque um teste exige
numeração contígua de migrations. **Não aplicada em ambiente nenhum.**

### Mapa de todo uso de `app.tenant_operacional()`

| Onde | Uso | Quem passava só pelo fallback `true` |
| --- | --- | --- |
| 12 policies (alunos, usuarios, turmas, alunos_turmas, vínculos, consentimentos, escolas update, logs_acesso select, metas, registros, simulados) | `and app.tenant_operacional()` | **ninguém:** todas também exigem `escola_id = app.tenant_id()`, que não casa com escola inexistente nem nula |
| `app.meu_aluno_id()` e `app.sou_responsavel_de()` | anulam a identidade de aluno e responsável | ninguém: exigem linha de aluno ou vínculo com `escola_id = tenant` |
| `public.resumo_escola()` | devolve vazio | ninguém: filtra `a.escola_id = tenant` |
| Turma de escola fantasma (inserção) | a RLS deixava passar | barrada pela FK de `escolas` |

**Super admin:** não passa pelo porteiro. Opera pelas RPCs do backoffice
(`eh_super_admin`), e as policies com porteiro exigem escola, que ele
não tem. Com a 0056, recebe `true` por regra explícita.

**Conclusão:** era regra incompleta, não furo explorável. A 0056 tira a
dependência de duas coincidências (a policy exigir escola e a FK
existir).

### C-S04b, achado da matriz

A 0027 deixou sem porteiro a escrita da coordenação em nove tabelas:
`config_escola`, `missoes_escola`, `logs_coordenacao`,
`aluno_xp_eventos`, `aluno_conquistas`, `aluno_missoes`, `aluno_niveis`,
`aluno_onboarding` e `aluno_eventos_progresso`. Escola suspensa ou
cancelada, com sessão aberta, seguia gravando. A 0056 põe o porteiro nas
nove.

### Encerramento

| Campo | Valor |
| --- | --- |
| ID | C-S04 (e C-S04b) |
| Decisão | Negar por padrão: escola ausente ou inexistente → `false`; super admin por regra explícita. Porteiro nas nove escritas descobertas. |
| SHA | `c87815a` (branch do #140) |
| Ambiente | Postgres 16.13 local. Hospedados: **não aplicado**. |
| Teste | `tests/e2-cs04-tenant-operacional-db.test.mjs` (5), mais a matriz com 0055 + 0056 |
| Esperado | Escola ausente, inexistente, suspensa e cancelada negadas; escola ativa e super admin ativo passam; nenhum caso legítimo da matriz regride |
| Observado | 5/5. Contrafactual: 4/5 falham sem a migration (o quinto é controle). Matriz: os 20 casos C-S04/C-S04b batem, zero regressão, sobram só as 7 divergências de C-S06 e E1 |
| Responsável | Dono: aprovar a aplicação da 0055 e depois da 0056 |
| Estado | **PENDENTE DO DONO** (aplicação). Correção e prova prontas. |

**Decisão deixada ao produto:** a coordenação de escola suspensa ainda
lê a própria configuração, missões e gamificação. É dado da própria
escola, sem impacto entre escolas.

---

## Fatia 4 — C-S06: SECURITY DEFINER

**PR:** #141 (0057), empilhado sobre o #140. **Não aplicada.**

**Recontagem (24/09, só leitura), idêntica em demo, produção e local:**
50 SECURITY DEFINER em `public` e `app`, 28 com EXECUTE para `anon` ou
`authenticated`, todas com `search_path` fixo, dono `postgres` (que tem
BYPASSRLS nos hospedados). As três views são `security_invoker`, dono
`postgres`. Com isso a RLS de quem consulta vale.

| Classe | Funções | Decisão |
| --- | --- | --- |
| (a) exposta, confere autorização no corpo | 12 em `public` | mantém; a matriz prova cada checagem |
| (b) helper de policy | `eh_super_admin`, `meu_aluno_id`, `sou_responsavel_de`, `tenant_operacional` | mantém; a policy roda como quem consulta; só leem |
| (c) gatilho | 6 | revoga; o gatilho dispara sem EXECUTE (testado) |
| (d) interna | `backfill_progresso`, `desbloquear_conquista_basica`, `motor_avaliar_aluno`, `motor_conquista_xp`, `motor_streak_dias`, `exam_tag_do_aluno` | revoga de public, anon e authenticated; `service_role` fica |
| servidor | 22 | já não tinham EXECUTE de usuário |

**Accept-Profile `app`: NÃO VERIFICADO por HTTP** (a rede da sessão não
alcança `*.supabase.co`). O que o banco mostra:
- `anon` não tem USAGE no schema `app` nos dois projetos;
- `authenticated` tem;
- não há `pgrst.db_schemas` gravado em papel nenhum;
- `pg_graphql` não está instalado.

A lista de schemas expostos mora no painel, não no banco. **O dono
confere** em *Project Settings → Data API → Exposed schemas*. Se `app`
estiver lá, as seis (d) eram alcançáveis pela API hoje, e a 0057 é
urgente. Depois da 0057, a resposta não muda nada para elas.

| Campo | Valor |
| --- | --- |
| ID | C-S06 |
| Decisão | Classe e decisão por função, registradas no teste `e2-cs06-secdef-db` (função nova sem classe derruba o CI). Revogação só das (c) e (d), com justificativa por função. |
| SHA | `4df4a3c` (branch do #141) |
| Teste | 8 testes, mais a matriz com 0055 + 0056 + 0057 (sobra só a E1-ACHADO-2) |
| Observado | 8/8; contrafactual 2/8 falham sem a migration; os gatilhos continuam disparando; suíte 1076/1076 |
| Estado | **PENDENTE DO DONO:** aplicação e leitura de "Exposed schemas" |

---

## Fatia 5 — C-S02: CORS

**PR:** #142, a partir da `main`, independente. **Não aplicado:** a
aplicação exige redeploy das 7 funções.

**Achado confirmado por execução:** o `cors.ts` importado no Node, com
`Deno.env` simulado, respondia `Access-Control-Allow-Origin:
http://localhost:5173` sem `ALLOWED_ORIGINS`. O mesmo valia para
`:3000`. Com a mudança, `localhost`, `127.0.0.1`, origem arbitrária, a
string `null` e sufixo enganoso não recebem o cabeçalho. A resposta
nunca é curinga, sempre tem `Vary: Origin`, e `ALLOWED_ORIGINS` substitui
a lista inteira.

**Registrado para o dono decidir:**
- o `triliva-producao` tem as `VITE_` em Production **e Preview**, então
  preview de qualquer branch fala com o banco de produção;
- o CORS das funções aceita `triliva-producao-*.vercel.app` sempre, e o
  `ALLOWED_ORIGINS` **não** desliga isso (um comentário do código dizia
  que desligava; corrigido).

| Campo | Valor |
| --- | --- |
| ID | C-S02 |
| Decisão | Origens exatas por ambiente; `localhost` só pelo env local das funções |
| SHA | `e540438` (branch do #142) |
| Teste | 5 testes de comportamento em `onda1-cors-modais` |
| Observado | 17/17 no arquivo; contrafactual: 2 falham com o `cors.ts` antigo; suíte 1060/1060 |
| Pendente | (1) o dono lê se `ALLOWED_ORIGINS` existe em cada projeto e se tem `localhost`; (2) aprova o redeploy; (3) decide sobre o preview. OPTIONS por HTTP nas funções publicadas: PENDENTE-E3 |
| Estado | **PENDENTE DO DONO** |

---

## Fatia 6 — C-S03, C-S05 e C-S07

**PR:** #143, a partir da `main`, independente. Só testes e documentação.
**Nada aplicado**, e o plano de rotação **não foi executado**.

### C-S03: credenciais de servidor no Vercel

**Remoção: feita e medida (24/09, só leitura).** Os dois projetos Vercel
(`triliva-producao` e `rumo-a-aprova-o`) têm só `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`, com `hiddenProductionEnvCount: 0`. Em 21/09 o de
produção tinha 8 (`docs/e0-baseline.md`), entre elas
`SUPABASE_SERVICE_ROLE_KEY` em Production e Preview. A remoção aconteceu
entre 21/09 e 24/09; quem removeu e quando não é visível por ferramenta.

**Bundle:**
- `vite.config.js` não liga sourcemap, e o build local não gera `.map`.
- O único JWT no bundle tem papel `anon`. O único `sb_secret_` é o prefixo
  que a biblioteca testa, não uma chave.
- Teste novo no CI, sobre o build do próprio job, trava as três coisas.
- **Bundle publicado em produção: NÃO VERIFICADO diretamente.** A
  ferramenta do Vercel não lê os arquivos do deploy (`File tree not
  found`), e a rede desta sessão não alcança o domínio.

**Logs e uso: nada a ler.** Produção não tem nenhuma requisição HTTP nos
logs de 22/09 e de 23-24/09 (só `postgres_logs` e `postgrest_logs` de
arranque). O Vercel não guarda o que um build leu do ambiente.

**Exposição: potencial, não consumada.** A chave ficou no ambiente de build
de todo preview, inclusive de branch de bot, onde qualquer script de
instalação de dependência a lia. Não há indício de uso indevido, e não há
como descartá-lo. Por isso a rotação se justifica, e há um motivo mais
forte: **as chaves legadas `anon` e `service_role` param no fim de 2026**,
segundo a Supabase, e o **JWT secret legado não pode mais ser
rotacionado**. A rotação é a troca pela chave secreta nova e a
desativação das legadas.

**Plano:** `docs/operacao/plano-rotacao-chaves-supabase.md` (#143). Resumo:
0. o dono confere no painel se a chave secreta `default` existe (a
   publicável `default` existe nos dois projetos, medido);
1. PR das funções para ler `SUPABASE_SECRET_KEYS`, com a legada como
   alternativa só na transição, e a `virar-semana` aceitando a secreta no
   `apikey`;
2. publicar no demo;
3. front com a publicável (Vercel e `app/.env.production`);
4. keepalive sem `Authorization: Bearer`;
5. scripts de operador;
6. desativar as legadas, demo antes, produção depois (reversível).

**Achado para a E0:** o keepalive manda a chave também em
`Authorization: Bearer`, e a Supabase recusa chave publicável nesse
cabeçalho. **Os secrets do keepalive devem receber a `anon` legada** até
o passo 4.

| Campo | Valor |
| --- | --- |
| ID | C-S03 |
| Decisão | Variáveis de servidor fora do Vercel (feito); bundle travado por teste; rotação pela migração para a chave secreta nova |
| SHA | `2f1e929` (branch do #143) |
| Teste | `E2/C-S03` em `tests/sec3-endurecimento-edge.test.mjs` |
| Observado | Passa no build atual; falha com `.map` no `dist` e com JWT `service_role` plantado (contraprova) |
| Estado | **PENDENTE DO DONO:** passo 0 do plano, aprovações dos passos 1 a 6, e conferir as variáveis compartilhadas do time Vercel (a ferramenta não lista) |

### C-S05: senha vazada e o fluxo de troca que existe hoje

**Plano Pro, conferido na documentação em 24/09:** a proteção de senha
vazada, a sessão com prazo, o tempo de inatividade e a sessão única são
exclusivas do Pro. Comprimento mínimo, caracteres obrigatórios e o JWT
expiry valem em todos os planos. O advisor
`auth_leaked_password_protection` está WARN nos dois projetos.

**Lista de ativação da E8:** em `docs/operacao/auth-credenciais-checklist.md`
(#143), com valor proposto e teste de cada controle. Dois cuidados que a
lista registra:
- **A `trocar-senha` troca pela API de admin.** A documentação não diz se
  a checagem de senha vazada vale nesse caminho. Se não valer, a proteção
  não cobre alunos e responsáveis, que trocam a senha por ali.
- **Não exigir classes de caractere antes de mudar o gerador:** a senha
  temporária tem 16 caracteres de `[A-Za-z2-9]`, sem símbolo e às vezes sem
  dígito.

**Testado no banco local (8 testes, bloco `E2/C-S05`):**
- `authenticated` não tem UPDATE em `usuarios`, **igual aos hospedados**
  (medido em demo e produção). O aluno tentando zerar o próprio
  `must_change_password` leva 42501.
- Mesmo com um grant vazado, nem o aluno nem a coordenação mudam
  `must_change_password`, `credencial_status`, `papel` ou `escola_id`: a
  RLS não tem policy de UPDATE. 0 linhas, linha intacta.
- `anon` tem SELECT e UPDATE em `usuarios` nos hospedados; com os dois,
  altera 0 linhas.
- O caminho do servidor (`service_role`) zera a troca, revoga e reativa.

**Comportamentos registrados, com teste de REGISTRO:**
- `must_change_password` é trava de tela. Quem tem a senha temporária e
  fala direto com a API usa a conta sem trocar a senha. Não cruza escola.
- Credencial revogada lê até o token expirar: nenhuma policy lê
  `credencial_status`, e o banimento só impede o refresh. Janela = JWT
  expiry.

**Recuperação de senha:** acontece no GoTrue (`PATCH /auth/v1/user` com o
token do link, `app/src/shared/data/index.js:807-830`). Não há parte de
banco para testar localmente. Se o reset feito pela coordenação encerra as
sessões abertas do aluno: **PENDENTE-E3** (a `provisionar-aluno` não chama
nenhum encerramento de sessão).

| Campo | Valor |
| --- | --- |
| ID | C-S05 |
| Decisão | Ligar na ativação do Pro, pela lista; no Free, só o servidor mexe na credencial (provado) |
| Teste | 8 testes em `tests/etapa7-bloco-b-credencial.test.mjs` |
| Observado | 8/8. Contraprova: policy de UPDATE em `usuarios` derruba 2; grant permanente de UPDATE derruba o do 42501 |
| Estado | **PENDENTE DE ETAPA (E8)** |

### C-S07: o que a chave anon alcança

**Não é `service_role`:** a chave de `app/.env.production` tem papel
`anon` e `ref` do demo (teste T76). O bundle do CI só carrega JWT `anon`
(teste C-S03). As duas chaves publicáveis de cada projeto (`anon` legada
e `sb_publishable_` `default`) estão ativas.

**Enumeração, 24/09, idêntica em demo e produção (só leitura):**

| Superfície | Alcance de `anon` |
| --- | --- |
| 50 objetos de `public` | grant de DML em 48 (faltam `logs_coordenacao` e `vw_concurso_qualidade`) |
| Policies | 85 em `public`, **nenhuma** para `anon` ou PUBLIC |
| RLS | ligada em todas as tabelas |
| Views | as 3 são `security_invoker` |
| Funções de `public` e `app` | **nenhuma** alcançável (`app` sem USAGE; as de `public` sem EXECUTE) |
| Sequências | USAGE em 4 (`logs_acesso_id_seq`, `aluno_nivel_historico_id_seq`, `admin_logs_id_seq`, `logs_coordenacao_id_seq`); o PostgREST não expõe `nextval`, efeito nulo |
| Realtime | publicação `supabase_realtime` sem tabela, então `postgres_changes` não entrega nada; o app não usa Realtime |
| Storage | produção: nenhum bucket; demo: `Logos-escolas` público, sem policy (Fatia 7) |

**Testado no banco local (5 testes, bloco `E2/C-S07`):** com DML concedido
em **todos** os 50 objetos (mais do que o hospedado dá), `anon` lê 0,
altera 0 e apaga 0 em cada um, e o INSERT é recusado pela RLS. As 5
tabelas que o seed deixa vazias estão listadas no teste; nelas só o
INSERT prova. Contraprova: policy para `anon`, RLS desligada, USAGE em
`app` e view sem `security_invoker` derrubam o teste esperado.

**O que falta:** ver, por HTTP, que o bundle **publicado** em produção
usa uma chave de papel `anon` do projeto de produção. O valor no Vercel é
`sensitive` (ilegível), e a rede desta sessão não alcança o domínio.
PENDENTE-E3; o dono pode adiantar abrindo `app.trilivaedu.com.br` e
conferindo, na aba de rede do navegador, que as chamadas vão para
`zckyhihxjjbnqjqilymn.supabase.co`.

**Sugestão, sem urgência:** como o app não usa Realtime, desligar o
acesso público de Realtime no painel. Hoje qualquer um com a chave `anon`
pode usar canais de broadcast como retransmissor. Não expõe dado.

| Campo | Valor |
| --- | --- |
| ID | C-S07 |
| Decisão | A chave `anon` é pública por desenho; a segurança está no banco, e o banco foi provado |
| Teste | 5 testes em `tests/sec3-endurecimento-edge.test.mjs` |
| Observado | 5/5 e contraprova; enumeração hospedada idêntica à local |
| Estado | **PENDENTE DE ETAPA (E3):** só a leitura do deploy de produção |

### C-S06: indício novo sobre "Exposed schemas"

O advisor de segurança da Supabase (`get_advisors`, 24/09, demo e
produção) lista em `authenticated_security_definer_function_executable`
as 12 funções SECURITY DEFINER de `public`, cada uma "via
`/rest/v1/rpc/...`", e **nenhuma das 6 internas de `app`**, que também são
SECURITY DEFINER com EXECUTE e USAGE para `authenticated`. Esse lint olha
os schemas expostos pela API. É **indício forte** de que `app` não está
exposto: não é prova, porque a regra do lint não está no banco. A leitura
do painel continua sendo o fechamento.

---

## Anexo A · Registro original de 22/09 — Retirada controlada da `capture-oidc-20260919`

> Texto da primeira execução (22/09), preservado. Só mudaram os níveis de título (um a mais, para caber como anexo) e o link do código arquivado, que apontava para `../arquivo/` e não abria.


**Data:** 22/09/2026 (consultas entre a leitura do baseline e o fechamento deste
documento, mesma sessão).
**SHA de referência do repositório:** `45843960ccbde01e5652611188ffd03495e47abb`
(`origin/main` no momento desta operação).
**Diagnóstico de origem:** `docs/e0-baseline.md`, Bloco 4.
**Natureza:** execução de escrita, autorizada e escopada ao projeto demo
(`bdjkgrzfzoamchdpobbl`). Produção (`zckyhihxjjbnqjqilymn`) não foi escrita em
nenhum passo — ver verificação final.

### Regra de evidência desta etapa

Mesma regra do baseline, com um estado a mais. Todo item traz a consulta ou
comando usado e a saída.

- **VERIFICADO** — executado e confirmado com evidência abaixo.
- **NÃO VERIFICADO** — não foi possível checar (falta de acesso, dado fora do
  alcance desta sessão).
- **BLOQUEADO** — a ação foi tentada, com evidência de tentativa, e não pôde
  ser concluída por limite de ferramenta ou de permissão desta sessão. Não é
  a mesma coisa que NÃO VERIFICADO: aqui existe certeza sobre o motivo do
  malogro, não incerteza sobre o fato.

### Resultado em uma linha

**Dos três passos planejados, só um foi executável.** A revogação de sessões
e refresh tokens (passo 2) está feita e verificada. A remoção da Edge
Function (passo 1) e a remoção da branch (passo 3) estão **BLOQUEADAS** —
não por decisão, por ausência de ferramenta com permissão para a operação
nesta sessão. C-S01 **não fecha** neste documento. Fica em execução parcial,
com o que falta nomeado e com dono definido (ver "O que precisa acontecer a
seguir").

---

### Ordem executada, e por que não é a do baseline

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

### Passo 1 — Remoção da Edge Function `capture-oidc-20260919`

**BLOQUEADO.**

Estado antes (confirmado nesta sessão, `list_edge_functions` em
`bdjkgrzfzoamchdpobbl`): `ACTIVE`, versão 2, `verify_jwt: true`,
`ezbr_sha256: d74f6c5077ffc94acfda2a8926649fede5c184a338821dacc36d488e129bca20`.
Idêntico ao registrado no baseline — nada mudou na função entre 21/09 e hoje.

#### O que foi tentado

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

#### O que isso significa

A função **continua ACTIVE, reachable e capaz de emitir magic link** para as
cinco contas, usando a chave de serviço, para quem apresentar um JWT OIDC do
GitHub Actions com as claims certas. A superfície descrita no Bloco 4 não foi
reduzida por esta sessão. Passo 2 (revogação) reduziu o que já estava
emitido; não reduziu o que pode voltar a ser emitido.

---

### Passo 2 — Arquivamento do código-fonte

**VERIFICADO.**

Código obtido via `get_edge_function(bdjkgrzfzoamchdpobbl,
capture-oidc-20260919)` nesta sessão, idêntico ao `ezbr_sha256` acima.
Salvo em [`docs/arquivo/capture-oidc-20260919/index.ts`](arquivo/capture-oidc-20260919/index.ts).

Conferido linha a linha antes de salvar: as duas únicas leituras de
ambiente no código são `Deno.env.get("SUPABASE_URL")` e
`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` — nomes de variável, nunca
valor. Não há chave, token ou segredo literal no arquivo. `AUD`, `ISS`,
`REPO`, `REF` e o mapa de `profiles` são configuração/lógica pública, não
segredo. A cópia é fiel e sem redação necessária.

---

### Passo 3 — Revogação de sessões e refresh tokens

**VERIFICADO.**

#### Estado antes (consulta própria, não copiada do baseline)

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

#### Execução

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

#### Estado depois

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

### Passo 4 — Remoção da branch `tmp/triliva-pack-build-20260919`

**BLOQUEADO.**

#### Verificação feita antes de cogitar apagar

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

#### O que foi tentado

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

#### O que isso significa

O credential de git desta sessão consegue enviar commits para a branch
designada (`claude/triliva-remove-capture-oidc-6qwhsm`) mas não tem
permissão para apagar uma ref arbitrária do repositório — o 403 é
reproduzível, não intermitente. A branch `tmp/triliva-pack-build-20260919`
segue existindo, com a claim `ref` que a função aceita.

---

### Verificação final

#### Edge Functions do demo — as outras 7 não mudaram

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

#### Produção — intacta

`list_edge_functions(zckyhihxjjbnqjqilymn)` nesta sessão: as mesmas 7
funções, mesmas versões, mesmos `ezbr_sha256` do baseline. Nenhuma chamada
de escrita (`execute_sql`, `apply_migration`, `deploy_edge_function` ou
qualquer outra) foi emitida contra `zckyhihxjjbnqjqilymn` nesta sessão — a
única ferramenta usada nesse projeto foi a leitura `list_edge_functions`,
duas vezes (antes e depois), para ter prova de que nada mudou.

#### Sessões e branch

Sessões: ver tabela "depois" do Passo 3 — zero nas 6 contas.
Branch: continua no remoto — ver Passo 4. **Não** está apagada.

---

### NÃO VERIFICADO — JWT expiry

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

### Encerramento formal — C-S01

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

#### O que precisa acontecer a seguir, para C-S01 fechar de fato

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

### Achados abertos, registrados e não tocados nesta fatia

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

### Efeito colateral para quem for apresentar a vitrine

A revogação do Passo 3 **desloga** as quatro contas de demonstração:
`coordenacao@meridiano.demo`, `merihele2027@codigo.acesso.local`,
`meriresp2027@codigo.acesso.local` e `piloto2026a01@codigo.acesso.local`.
Quem for logar nelas hoje precisa entrar de novo — a sessão anterior não
existe mais.

---

### O que contradisse o Bloco 4

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
