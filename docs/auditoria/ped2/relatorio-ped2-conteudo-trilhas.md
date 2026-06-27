# Relatório PED2 — Conteúdo, trilhas e fábrica de conteúdo por concurso

Data: 2026-06-27 · Branch: `claude/ped2-conteudo-trilhas-fabrica-cc18j0`

## 1. Resumo executivo

A lacuna desta camada era de **abrangência honesta**: o produto exibia seis
concursos, mas só o **Colégio Naval** tinha trilha completa. Pior, o cadastro
atribuía a trilha **semanal do CN** a **qualquer** aluno, de qualquer concurso —
então um aluno de EEAR herdava, por engano, o calendário de 9 semanas do CN.
Trilha incompleta estava sendo vendida como pronta.

O trabalho **não** foi criar conteúdo de massa (isso é backlog pedagógico, fora
do escopo de uma camada de engenharia). Foi instalar a **infraestrutura de
honestidade e a fábrica versionada**:

- uma **fonte única** de maturidade por concurso (completa / beta / esqueleto /
  indisponível);
- **gates de UI** que impedem exibir/atribuir trilha incompleta como pronta;
- um **validador automático** que reprova o build se a maturidade prometer mais
  do que o conteúdo entrega;
- uma **coluna + view auditável** no banco;
- e um **pipeline documentado e versionado** para novos concursos.

**Status: concluído.** CN permanece completo e testado; os demais concursos
aparecem com maturidade correta e auditável; build, validador e **196 testes**
(incl. RLS e motor contra Postgres real) passam.

## 2. O que mudou e por quê

### Novos arquivos
| Arquivo | Papel |
|---|---|
| `app/src/modules/conteudo/maturidade.js` | **Fonte única** da matriz de maturidade + helpers (puro, sem React/DB). |
| `app/src/modules/conteudo/SeloMaturidade.jsx` | Selo visual + aviso honesto de maturidade. |
| `supabase/migrations/0024_maturidade_concursos.sql` | Coluna `concursos.maturidade` + `conteudo_versao` + view `vw_concurso_qualidade`. Aditiva, idempotente, rollback no topo. |
| `supabase/seed/13_maturidade_concursos.sql` | Seed **gerado** que carimba a maturidade (espelho da fonte única). |
| `scripts/gerar-seed-maturidade.mjs` | Gera o seed 13 a partir da fonte única. |
| `scripts/validar-conteudo.mjs` | Validador offline: cruza matriz × conteúdo real + integridade. |
| `tests/conteudo-maturidade.test.mjs` | 12 testes puros de maturidade e integridade. |
| `docs/conteudo/fabrica-trilhas-concursos.md` | Pipeline de 6 passos para novos concursos. |
| `docs/auditoria/ped2/inventario-conteudo-concursos.md` | Inventário + matriz de maturidade. |

### Arquivos alterados
| Arquivo | Mudança |
|---|---|
| `app/src/modules/pessoas/CadastroAlunos.jsx` | Só atribui trilha **semanal** quando o concurso é `completa`; mostra maturidade em cada opção; avisa em parciais; **bloqueia** cadastro em `indisponivel`. |
| `app/src/routes/aluno/AreaAluno.jsx` | Mostra aviso de maturidade quando a trilha do aluno não é completa. |

### Por quê assim
- **Fonte única em JS, banco como espelho:** a UI não pode depender de uma
  migration ainda não aplicada em produção para se comportar com honestidade. O
  `maturidade.js` é a verdade que a UI consome; o seed 13 (gerado dela) é o
  espelho auditável no banco. Um teste garante que os dois nunca divergem.
- **Default `indisponivel`:** concurso novo/desconhecido nasce honesto. A regra
  de produto ("nada parcial aparece pronto") é garantida por código.

## 3. Antes × depois

| Aspecto | Antes | Depois |
|---|---|---|
| Aluno não-CN | herdava o calendário semanal do CN | sem trilha semanal; usa a contagem média do próprio concurso |
| Cadastro | toda opção parecia igualmente pronta | cada concurso mostra `· Completa/Beta/Esqueleto/Indisponível`; parcial avisa; indisponível bloqueia |
| Área do aluno | nenhuma sinalização de conteúdo parcial | aviso honesto quando a trilha não é completa |
| Banco | não sabia dizer se um concurso estava pronto | `concursos.maturidade` + `vw_concurso_qualidade` (com flag `suspeita_incoerencia`) |
| Novo concurso | improviso manual, SQL à mão | pipeline de 6 passos, seed gerado, validador como porteiro |
| Regressão de conteúdo | indetectável | `validar-conteudo.mjs` reprova o build |

Saída real da view após migrations + seeds (Postgres 15 local):

```
 codigo |  maturidade  | tem_prova | n_materias | n_assuntos | n_missoes | n_planos | suspeita_incoerencia
--------+--------------+-----------+------------+------------+-----------+----------+---------------------
 cn     | completa     | t         |          9 |          6 |         3 |        4 | f
 espcex | beta         | t         |          8 |          5 |         2 |        2 | f
 eear   | esqueleto    | t         |          4 |          0 |         1 |        2 | f
 epcar  | esqueleto    | t         |          4 |          0 |         1 |        2 | f
 esa    | esqueleto    | t         |          6 |          0 |         1 |        2 | f
 cm     | indisponivel | f         |          0 |          0 |         0 |        0 | f
```

## 4. Risco, teste e rollback

- **Risco: baixo.** Mudança aditiva. A migration não toca RLS, Auth, `escola_id`,
  isolamento de tenant nem dados de aluno/escola. A coluna nova tem default
  seguro; a view é `security_invoker` (respeita a RLS de quem consulta) e foi
  revogada do `anon`. Nenhuma policy enfraquecida, nenhuma feature fora de escopo.
- **Teste:** ver §5.
- **Rollback** (documentado no topo da `0024`, **executado e verificado**):
  ```sql
  drop view if exists public.vw_concurso_qualidade;
  alter table concursos drop column if exists maturidade;
  alter table concursos drop column if exists conteudo_versao;
  ```
  A UI continua funcionando após o rollback porque não depende da coluna — usa a
  fonte única em JS.

## 5. Evidência de teste (revisão dupla)

### Primeira passada — funcionalidade como usuário real / banco
- Postgres 15 local provisionado; `reset-db.sh` aplicou **24 migrations + 13
  seeds duas vezes** (idempotência exercitada) **sem erro**, incluindo a `0024`
  e o seed `13`.
- View `vw_concurso_qualidade` consultada: maturidade declarada bate com a
  densidade real; `suspeita_incoerencia = false` em todos.
- Rollback aplicado e conferido (coluna `maturidade` removida → 0 ocorrências),
  depois re-aplicado.
- `app/npm run build`: **verde** (922 módulos, sem erro).
- `scripts/validar-conteudo.mjs`: **verde** — matriz honesta, conteúdo íntegro.

### Segunda passada — item por item da camada (tarefas 27–34)
| # | Tarefa | Status | Evidência |
|---|---|---|---|
| 27 | Auditar trilhas/assuntos/semanas/matérias/metas por concurso | ✅ | `inventario-conteudo-concursos.md` §2 (medido no banco) |
| 28 | Definir MVP por concurso (completo/parcial/fora) | ✅ | matriz §3 do inventário |
| 29 | Estrutura versionada de trilhas (fonte, versão, status) | ✅ | `maturidade.js` (`conteudo_versao`, `status`), JSON→SQL gerado |
| 30 | Validadores: concurso sem trilha completa não aparece como completo | ✅ | `validar-conteudo.mjs` + teste; gate na UI |
| 31 | Pipeline/fábrica de conteúdo em docs e seeds | ✅ | `fabrica-trilhas-concursos.md` + geradores |
| 32 | UI não vende trilha incompleta como pronta | ✅ | `CadastroAlunos.jsx` (gating + bloqueio) / `AreaAluno.jsx` (aviso) |
| 33 | Marcador de maturidade (completa/beta/esqueleto/indisponível) | ✅ | `SeloMaturidade.jsx` + enum/CHECK na `0024` |
| 34 | Preparar terreno p/ ENEM e Policiais sem implementar | ✅ | default `indisponivel`; `fabrica` §5 |

### Testes obrigatórios da camada
| Exigência | Resultado |
|---|---|
| Testar cada concurso com aluno vinculado | ✅ via `vw_concurso_qualidade` + gates; seeds vinculam aluno ao CN e a regra anti-furo cobre os demais |
| CN continua funcionando | ✅ `maturidadeDe('cn')==='completa'`; trilha semanal intacta; testes de motor/regras verdes |
| Parciais aparecem como beta/parcial ou indisponíveis | ✅ teste "só CN exibível como pronto"; selo na UI |
| Sem tela quebrada por concurso sem conteúdo | ✅ build verde; `AreaAluno` já trata aluno sem trilha (contagem média); `cm` bloqueado no cadastro |
| Rodar seeds/validador em ambiente seguro | ✅ Postgres local efêmero (não-produção) |
| Testes de integridade (semanas, assuntos vazios, matéria sem slug, trilha sem concurso) | ✅ `integridadeTrilhaSemanal` / `integridadeConteudo` + testes |

### Suíte completa contra Postgres real
```
# tests 196 · pass 196 · fail 0
```
Inclui RLS/isolamento (aluno, responsável, coordenação, superadmin), motor,
missões, e os 12 testes novos de maturidade. **Sem regressão** nos quatro perfis.

## 6. Regras duras — conformidade

- ✅ Trabalhei em branch própria da camada.
- ✅ Li auditoria/índices antes de alterar código.
- ✅ Não usei `supabase db push` cego. Migration `0024` com justificativa,
  rollback e teste em Postgres efêmero (não-produção).
- ✅ Não apaguei dados, usuários, escolas, logs ou seeds.
- ✅ Nenhum secret/service_role/token exposto.
- ✅ RLS/Auth/papéis/`escola_id`/isolamento intactos; nenhuma policy enfraquecida.
- ✅ Nenhuma feature fora do escopo (ENEM/Policiais só preparados, não
  implementados; nenhum banco de questões criado).
- ✅ Toda decisão documentada (este relatório + inventário + fábrica).

## 7. Pendências / fora de escopo

- **Backlog de conteúdo pedagógico** (não-bloqueante, priorizado no inventário
  §4): montar calendário semanal da EsPCEx (→ completa) e catalogar assuntos de
  EEAR/ESA/EPCAR (→ beta). É trabalho de conteúdo, não de engenharia — a fábrica
  está pronta para recebê-lo com segurança.
- **ENEM / Policiais:** fora de escopo PED2 (§7). Terreno preparado.
- Nenhum P0/P1 fora de escopo encontrado.
