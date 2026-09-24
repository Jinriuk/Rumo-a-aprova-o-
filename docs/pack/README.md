# Pack de capturas

Como o pack comercial de telas é produzido, onde fica o que é interno e o que falta para a
próxima captura. Código: `scripts/captura/pack-v2.mjs` (runner) e `scripts/captura/pack-v2-lib.mjs`
(funções puras, testadas em `tests/bloco5-captura.test.mjs`). Workflow:
`.github/workflows/captura-pack-v2.yml`.

## O que vai para quem

| Pasta ou artefato | Para quem | O que leva |
|---|---|---|
| `pack-triliva-v2-AAAA-MM-DD/` (artefato `pack-triliva-v2`) | material comercial | telas, `MANIFESTO.md`, `CAPTURA.json`, `COERENCIA-HELENA.md`, `CHANGELOG.md`, `SHA256SUMS.txt`. **Sem** o identificador do projeto Supabase (P07) e sem nenhum valor de segredo: o runner confere e apaga o pack se achar um dos dois. |
| `interno-AAAA-MM-DD/` (artefato `interno-captura`) | só nós | id do projeto, commit, modo, falhas, avisos de recorte, requisições bloqueadas, checagem a 360 px e, se pedida, a tela 18. |
| `docs/pack/AAAA-MM-DD/` (neste repositório) | só nós | arquivos de controle de cada pack publicado. O de 19/09 está em [`docs/pack/2026-09-19/`](./2026-09-19/README.md). |

**O repositório é público.** "Interno" aqui quer dizer fora do pack comercial, não secreto: os
artefatos do Actions ficam baixáveis por qualquer conta do GitHub enquanto existirem (retenção de 3
dias; baixe, publique e apague o artefato), e o que for para `docs/pack/` fica visível a todos. O
identificador do projeto já é público em `app/.env.production`; o P07 é sobre ele não aparecer no
material que vai para a escola.

A tela 18 (LGPD) **não entra no material comercial** até a validação jurídica do D02. O runner só
a captura quando pedido (`tela_18`) e grava na pasta interna.

## Quando capturar

Sábado depois das 18:00 de Brasília, com a semana 4 em repetição no ar (`docs/demo/HISTORIA.md`).
É só nessa janela que os números batem com as apresentações (seção 3.3 do documento de 23/09).
O modo `oficial` recusa rodar fora dela; o `ensaio` roda em qualquer dia e sai com o sufixo
`-ensaio` no nome, para não ser confundido.

## Segredos (cadastrar em Settings → Secrets and variables → Actions)

| Segredo | Conta (demonstração, Instituto Meridiano) |
|---|---|
| `TRILIVA_CAPTURA_COORD_EMAIL` | e-mail da coordenação do Meridiano |
| `TRILIVA_CAPTURA_COORD_SENHA` | senha dessa coordenação |
| `TRILIVA_CAPTURA_ALUNO_CODIGO` | código de acesso da Helena Vasconcelos |
| `TRILIVA_CAPTURA_ALUNO_SENHA` | senha da Helena |
| `TRILIVA_CAPTURA_RESP_CODIGO` | código de acesso do responsável vinculado à Helena |
| `TRILIVA_CAPTURA_RESP_SENHA` | senha desse responsável |

Nenhum valor vai para chat, PR, arquivo ou log: o runner lê só do ambiente, não grava a sessão em
disco e passa toda mensagem de erro por um filtro que troca qualquer segredo por `•••` (o GitHub
também mascara os valores cadastrados).

Se a senha de alguma conta não for conhecida, "Resetar senha" (coordenação, aba Alunos) gera uma
temporária, e a conta passa a pedir troca no primeiro acesso. O runner **não troca senha**: se cair
na tela "Escolha sua senha", ele para e avisa. Faça esse primeiro acesso à mão e cadastre a senha
definitiva.

A captura de 19/09 não usou segredo nenhum: entrou por OIDC do GitHub Actions e pela função
`capture-oidc-20260919`, que emitia link de acesso com a service role. A Etapa 2 (#131) manda
remover essa função, e o v2 não depende dela.

## O que o runner garante

- **Nada é escrito no banco pelo navegador.** Passa só leitura (GET), login e renovação de token
  (`/auth/v1/`) e as duas RPCs que leem por POST (`resumo_escola`, `sou_super_admin`). Todo o resto
  é bloqueado e listado no arquivo interno. Isso inclui `logs_acesso`: a captura não é um acesso
  de pessoa e não entra na trilha de auditoria.
- **Tela 21 sem credencial nova.** O botão "Gerar credencial" chama `provisionar-aluno` na hora e
  cria a conta do Enzo, o que desmancharia o D01. Na captura, a resposta é simulada no navegador
  com código `ENZO••••` e senha `••••••••`, e o manifesto diz isso.
- **Nenhum outro tenant e nenhum código na tela:** a captura falha se aparecer o nome de uma das
  quatro escolas protegidas, um campo de senha preenchido ou um dos códigos de acesso.
- **P03:** o recorte sai da captura integral, com 24 px de margem, e nenhum vizinho (caixa ou linha
  de texto) sai cortado ao meio. Quando o vizinho está a menos de 24 px, a margem daquele lado
  encolhe até ele e o recorte fica marcado como `margem_reduzida` no interno, para revisão. Se nem
  assim fechar, não há recorte (`sem_recorte_valido`): fica só a integral. Decoração marcada
  `aria-hidden` e camadas de fundo que contêm o alvo inteiro não contam como vizinho.
- **Modais (21 e 22):** a integral é a janela, não a página inteira (uma camada `position: fixed`
  não tem posição garantida numa captura de página inteira), e só contam os vizinhos de dentro do
  modal: a lista atrás do fundo escuro está coberta.
- **Conferência (P05):** `COERENCIA-HELENA.md` calcula os números esperados do banco no momento da
  captura (`resumo_escola`, alunos e XP, com a conta da coordenação) e diz em que tela cada um
  aparece: Helena (acerto no ciclo, D15; o resto da semana) e agregados da turma no Painel, em
  Turmas e no Ranking.

## Telas

Mesma lista de 19/09 (01 a 22), com 06 refeita (em 19/09 ela mostrava "Trilha temporariamente
indisponível", defeito corrigido em `62abef2`), 21 com o modal (P02), 22 com o modal inteiro (P06)
e Hoje, Ficha e Responsável em página inteira no celular. Toda captura é integral; no celular sai
também a primeira dobra.

Não recapturadas no v2: **04** troca de senha obrigatória e **25** trilha não configurada (as de
19/09 seguem válidas; nenhuma correção dos Blocos 1 a 4 muda essas telas).

## Tela 24 (Onboarding): por último, com preparo e restauração

O estado da 24 exige deixar o onboarding da Helena pendente, e isso muda a tela Hoje dela; por isso
ela é capturada **depois** de tudo, em execução própria que completa o pack da execução principal.
O D12 mudou o exemplo do objetivo, então a de 19/09 não serve.

No sábado, nesta ordem (SQL no projeto de demonstração, só a Helena do Meridiano):

1. Critério de aceite (seção 3.3) e captura principal (`modo: oficial`). Anotar o id da execução.
2. V9b e `supabase/demo/captura/tela24_conferir.sql` (antes).
3. `tela24_preparar.sql`: guarda do tenant, backup da linha de `aluno_onboarding` e do
   `must_change_password` em `demo.backup_20260926_tela24`, `concluido_em = null`,
   `must_change_password = false`. Conferir de novo (pendente = true).
4. Workflow com `modo: oficial` e `tela_24_completa_run: <id da execução principal>`. Ele baixa o
   pack da execução principal, captura só a 24 (celular) e devolve o pack inteiro, com manifesto,
   `CAPTURA.json` e somas refeitos. Se a 24 falhar, ela fica NÃO INCLUÍDA com o motivo.
5. `tela24_restaurar.sql` (sempre, dê a captura certo ou não): devolve a linha e o
   `must_change_password` exatamente como no backup. Conferir (igual ao passo 2) e V9b.
6. Critério de aceite de novo.

Os scripts rodam duas vezes sem estragar o backup, e a restauração sem backup não faz nada
(`tests/bloco5-tela24-db.test.mjs`).

## Rodar

Só à mão, pela aba Actions → captura-pack-v2 → Run workflow, a partir da `main` (um workflow com
`workflow_dispatch` só aparece depois do merge). Não há disparo por push, PR ou agenda.

- Ensaio (qualquer dia, sai com `-ensaio` no nome): valida logins e telas antes do sábado.
- Oficial: sábado depois das 18:00 de Brasília.
- Tela 24: ver a seção acima.
- Local (só o que não depende de login, porque o proxy do ambiente de desenvolvimento pode barrar
  o Supabase): `cd app && npm run build`, servir `dist` em 127.0.0.1:4173 e
  `CHROME_PATH=... node scripts/captura/pack-v2.mjs`.

## O que é publicado

Nada de trace, vídeo ou HAR do Playwright: o runner abre o navegador direto (não pelo test runner,
que é quem lê `playwright.config`), não liga `tracing`/`recordVideo`/`recordHar` (teste estático) e
recusa rodar com `DEBUG=pw:*` ou `PWDEBUG`, que registrariam o que é digitado no login.

Antes de publicar, o passo "Confere o que vai ser publicado" derruba a publicação se houver qualquer
arquivo além de: PNGs, `MANIFESTO.md`, `CAPTURA.json`, `CHANGELOG.md`, `COERENCIA-HELENA.md`,
`SHA256SUMS.txt` (pack comercial) e `CAPTURA-INTERNA*.json` (artefato interno). Os textos são os
que a seção 9 pede (P01, P05, P07) e passam pela checagem de segredo e de id do projeto.
