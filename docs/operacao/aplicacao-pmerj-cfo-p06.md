# Aplicação da P0.6: publicação da trilha CFO PMERJ pré-edital

**Origem:** `main` em `aa7bc7c`, branch `claude/publish-pmerj-track-4v9x4c`.
**Aplicada por:** operação, via MCP (`execute_sql`). Não é migration: o ledger não muda.
**Escopo:** conteúdo novo, só do PMERJ. Nenhuma linha existente é alterada.

| Fase | Projeto | Situação |
|---|---|---|
| 1 | demo `bdjkgrzfzoamchdpobbl` | **pendente** |
| 2 | produção `zckyhihxjjbnqjqilymn` | **aguardando o número de um backup novo, a ser enviado pelo dono** |

## O que é aplicado

Dois comandos, nesta ordem, em cada banco:

1. O SQL do gerador, uma transação só (`begin` a `commit`, com conferência no fim):

   ```bash
   node scripts/gerar-seed-trilha-pmerj-cfo.mjs --inicio 2026-10-05 --turma 1 --publicada --saida pmerj-turma1.sql
   ```

   - 144.444 bytes.
   - sha256 `9b6fda99b2a3d2171fbe2102754fbc0e052718f52bb4825d9c8527a654202d45`.
   - md5 `8e0145cb2e7f8a669081c7f2d1bc28a4`.
   - O arquivo não entra no repositório (depende da data). Duas gerações dão o mesmo
     arquivo, e `tests/p06-publicacao-pmerj.test.mjs` trava isso.

2. O carimbo de maturidade, que é a linha do PMERJ no seed 18:

   ```sql
   update concursos set maturidade = 'pre_edital', conteudo_versao = 1 where codigo = 'pmerj_cfo';
   ```

   Roda só essa linha. O seed 18 inteiro recarimbaria CN, EsPCEx e os outros nos bancos
   remotos, o que a publicação não precisa fazer.

Se o comando 1 falha, nada entra (a transação volta). Se o 2 falha, o concurso fica
`indisponivel`, que é o estado seguro: o front trata o concurso como fechado.

### Por que `--inicio 2026-10-05`

A publicação no demo é de domingo, 04/10/2026. A segunda-feira seguinte é 05/10. As 12
semanas vão de 05/10 a 27/12/2026, de segunda a domingo, sem lacuna.

**Se a produção for aplicada depois de 05/10, o início da turma 1 de lá deixa de ser "a
segunda-feira seguinte à publicação".** Gerar outro SQL com uma segunda-feira posterior é
possível em produção (turma 1 ainda não existe lá), mas o demo ficaria com a turma 1 em
05/10: o SQL recusa mudar a data de uma turma que já existe. Decidir isso antes de aplicar
em produção.

## O que a publicação faz

- Concurso `pmerj_cfo`, "CFO PMERJ, preparação pré-edital", **sem data de prova**
  (`mes_prova` e `dia_prova` nulos) e `pre_edital` depois do carimbo.
- 6 matérias `dir_*`, 219 assuntos (Anexo II, texto literal) e 24 missões, das semanas 1 a 4.
- 1 plano, 24 vínculos plano-missão, 1 trilha (`pmerj-cfo`, turma 1, `publicada = true`), 8
  disciplinas, 12 semanas e 159 atividades-modelo.
- As 48 missões das semanas 5 a 12 **não entram**: continuam pendentes no manifesto.

## Efeitos visíveis depois de publicar

- A trilha aparece no seletor "Trilha de estudo" da lista de alunos de **toda** escola, não só
  de quem prepara o PMERJ. A política `trilhas_select` mostra a qualquer usuário autenticado
  toda trilha publicada.
- Nenhum aluno recebe a trilha sozinho. O front só entrega ao concurso a trilha publicada do
  próprio nicho (`trilhaSemanalDoConcurso`), e as funções de próximo ciclo (0051, 0054) usam
  o nicho da trilha de origem. CN e EsPCEx não mudam.
- Quem for cadastrado no PMERJ recebe 12 semanas de atividades, mas missões só nas semanas 1
  a 4. Depois da semana 4 a fila de missões acaba, e as semanas 5 a 12 trazem só as atividades.
- Sem o front novo no ar, o concurso aparece como indisponível (falha fechado). Sem o banco, o
  front novo avisa que a trilha ainda não foi publicada. A ordem entre os dois não quebra nada.

## Linha de base (04/10/2026, `execute_sql` só com SELECT)

| Contagem | Demo | Produção | Efeito |
|---|---:|---:|---|
| Migrations no ledger | 66 | 66 | 0 |
| Concursos | 6 | 6 | +1 |
| Assuntos (todos) | 11 | 86 | +219 |
| Assuntos do PMERJ | 0 | 0 | +219 |
| Missões (todas) | 8 | 30 | +24 |
| Missões do PMERJ | 0 | 0 | +24 |
| Matérias `dir_*` | 0 | 0 | +6 |
| Planos de trilha | 12 | 14 | +1 |
| Vínculos plano-missão | 3 | 99 | +24 |
| Trilhas (publicadas) | 2 (2) | 2 (2) | +1 (+1) |
| Disciplinas | 16 | 17 | +8 |
| Semanas de trilha | 18 | 18 | +12 |
| Atividades-modelo | 100 | 159 | +159 |
| Alunos | 77 | 2 | 0 |
| Escolas | 5 | 2 | 0 |

Demo e produção não têm o mesmo conteúdo de catálogo (assuntos 11 contra 86, missões 8
contra 30). A publicação não depende disso: tudo o que ela cria é do PMERJ.

## Conferência

`scripts/conferir-publicacao-pmerj-cfo.sql` (somente leitura) dá a contagem e o md5 do
conteúdo do PMERJ por tabela, e um TOTAL. Rodado no Postgres local depois do SQL e do
carimbo, em cima de um banco com o catálogo de produção (86 assuntos, 30 missões):

- concursos 7, assuntos 305, missões 54, semanas 30 (as contagens totais de cada banco);
- TOTAL do PMERJ: 455 linhas, md5 `352873c8f641a26a258c2132641e9fb0`;
- antes de aplicar, o TOTAL é 0 linhas, md5 `fef8542fb7089d033fc33b25511c9f57`.

Em cada banco, depois de aplicar, o TOTAL tem de ser exatamente esse. As contagens totais
esperadas são a linha de base mais o efeito da tabela acima.

## Reversão

`docs/operacao/reversao/p06-pmerj-cfo.sql`, testada em `tests/p06-publicacao-pmerj-db.test.mjs`:
apaga só o que é do PMERJ e confere que nada sobrou. Recusa, e a transação volta, se algum
aluno, progresso, registro de estudo ou missão de escola já apontar para o PMERJ. Com uso
real, o caminho é despublicar (`update trilhas set publicada = false where nicho = 'pmerj-cfo'`).

## Fase 1: demo

_A preencher depois da aplicação._

## Fase 2: produção

_Só depois do número do backup novo, enviado pelo dono._
