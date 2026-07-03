# PED2-R2 — Conteúdo/Trilhas Essenciais — Relatório

**Data:** 2026-07-03 · **Branch:** `claude/ped2-r2-content-trails-4uu8h2` (base `origin/main` = `55daf92`, pós-REG1)
**Natureza:** produção de conteúdo condicionada à Fase 0 (investigação de material-fonte). **Nenhuma migration, nenhuma RLS, nenhum código de produto alterado** — só a fonte única de maturidade (1 metadado corrigido), o seed espelho regenerado, o carimbo do espelho no remoto e documentação.

---

## 0. Fase 0 — Investigação de material-fonte (decidiu o escopo)

### 0.1 O que existe no banco remoto (medido, não citado)

```sql
select 'provas_anteriores' t, exam_tag, count(*) from provas_anteriores group by exam_tag
union all select 'questoes_prova', pa.exam_tag, count(qp.id)
  from questoes_prova qp join provas_anteriores pa on pa.id=qp.prova_anterior_id group by pa.exam_tag
union all select 'recorrencia:'||tipo, exam_tag, count(*) from recorrencia_assunto group by exam_tag, tipo;
-- provas_anteriores        cn  1   (CPACN 2024, status 'validar' — só referência, SEM o documento)
-- questoes_prova           cn  3   (amostra do seed 12)
-- recorrencia:estimada     cn  2   (amostra do seed 12)
-- recorrencia:medida       cn  1   (amostra do seed 12)
-- espcex / eear / epcar / esa / cm: ZERO em todas
```

Grau predominante em `recorrencia_assunto`: **estimada** (2 de 3); a única
`medida` vem das 3 questões-amostra. Tudo é o seed demonstrativo da 15.7 —
**não há tagueamento real no sistema**.

### 0.2 Fontes fora do banco

- Repositório: `find . -iname "*.pdf"` e `find . -iname "*edital*"` → **0**
  (fora de node_modules). Nenhum edital, prova ou programa anexado.
- Storage remoto: `select bucket_id, name from storage.objects` → 2 objetos,
  ambos do bucket `Logos-escolas`. **Nenhum material pedagógico.**
- Os documentos `01_DOCUMENTO_CENTRAL…` e `02_MEMORIA…` citados no prompt
  **não existem no repositório** (4ª fase seguida; FIX2 já registrara o mesmo).
  Usei as regras duras do prompt + índices REG1 como contexto normativo.
- PR #49 lido pelo **diff real** (12 arquivos, +1136/−15): confirma fábrica
  (maturidade.js, SeloMaturidade, gates, validador, 0034, seed 18) — coerente
  com a verificação da FIX2 (PR #62, aberto), que já apontou os números errados
  do corpo do PR (0024/seed 13/196 testes → reais: 0034/seed 18).

### 0.3 Veredito por concurso

| Concurso | Fonte real? | Base do veredito |
|---|---|---|
| **CN** | ✅ fonte real | Trilha semanal autorada pelo dono (`trilha-cn-v1.json`: "metodologia autorada pelo dono: NÃO reescrever"); estrutura `oficial` |
| **EsPCEx** | 🟡 parcial | Estrutura de prova `oficial` + 5 assuntos transcritos do doc do dono (cita "Anexo C", não anexado). **Calendário semanal: sem fonte** — decisão 16 do build reserva ao dono o plano "pensado prova a prova" |
| **EEAr** | ❌ sem fonte, gap documentado | Só estrutura `oficial`; 0 assuntos; nenhum edital no projeto |
| **EPCAR** | ❌ sem fonte, gap documentado | Idem (0 assuntos) |
| **ESA** | ❌ sem fonte, gap documentado | Idem (0 assuntos) |
| **CM** | ❌ sem fonte, gap documentado | Nada além do cadastro; cada CM tem edital próprio — exige decisão do dono |

**Decisão de escopo (a regra do prompt aplicada):** nenhuma trilha semanal foi
gerada por inferência do agente. Gerar 9 semanas de EsPCEx "de cabeça" seria
exatamente o erro sem rastro que esta fase existe para não cometer — e
contornaria a decisão 16 do dono. O escopo executado foi: (a) o que a estrutura
de dado real permitia (abaixo), (b) gap exato documentado para os demais.

## 1. O que foi produzido (dentro do que a Fase 0 autorizou)

### 1.1 Espelho de maturidade carimbado no remoto (fábrica, passo 6)

Achado da Fase 0: o seed 18 (espelho da fonte única, entregue no PR #49)
**nunca tinha sido aplicado ao projeto remoto** — os 6 concursos estavam
`indisponivel`/v0, com o CN em produção com trilha e alunos:

```sql
-- ANTES (remoto, 03/07): select codigo, maturidade, conteudo_versao from vw_concurso_qualidade;
-- cn/espcex/eear/epcar/esa/cm → TODOS 'indisponivel', versao 0
```

Aplicados os UPDATEs idempotentes do seed 18 gerado (6 linhas de `concursos`,
tabela de conteúdo global; sem RLS, sem migration, sem dado de aluno):

```sql
-- DEPOIS: select codigo, maturidade, conteudo_versao, tem_prova, n_assuntos, suspeita_incoerencia
--         from vw_concurso_qualidade order by codigo;
-- cm     indisponivel v0  prova=f assuntos=0  suspeita=false
-- cn     completa     v1  prova=t assuntos=6  suspeita=false
-- eear   esqueleto    v1  prova=t assuntos=0  suspeita=false
-- epcar  esqueleto    v1  prova=t assuntos=0  suspeita=false
-- esa    esqueleto    v1  prova=t assuntos=0  suspeita=false
-- espcex beta         v1  prova=t assuntos=5  suspeita=false
```

A UI não depende da coluna (lê a fonte única JS) — o carimbo fecha a
auditabilidade do banco, que era o propósito da 0034.

### 1.2 Correção de metadado medido: CN tem 50 atividades, não 33

O inventário PED2 e a nota do `maturidade.js` diziam "33 atividades-modelo".
Medido em três fontes independentes:

```
python: sum(len(s['tarefas']) for s in trilha-cn-v1.json['semanas'])  → 50
grep -c "'F'\|'P'\|'X'" supabase/seed/02_trilha_cn.sql               → 50
remoto: select count(*) from atividades_modelo (trilha colegio-naval) → 50
```

Corrigida a nota em `maturidade.js`, seed 18 regenerado pelo gerador
(`node scripts/gerar-seed-maturidade.mjs`), validador verde. Sem mudança de
nível nem de versão (metadado, não conteúdo). Adendo datado no inventário.

### 1.3 Gaps documentados (o entregável para os sem-fonte)

`docs/conteudo/gaps-material-fonte-concursos.md` — por concurso: o que tem
lastro, o que falta, **qual material o dono precisa entregar e qual passo da
fábrica cada material destrava**. Destaques:

- **EsPCEx** (beta→completa): falta (1) Anexo C do edital para catalogar
  assuntos de fís/ing/his/geo/red — hoje 3/7 matérias objetivas têm assunto
  (query em §2 abaixo) — e resolver o `validar` ("eletroforese"); (2) a
  metodologia semanal do dono — molde CN: 9 semanas / 50 atividades; faltam
  **todas** (0 de ~9); (3) provas anteriores p/ recorrência medida.
- **EEAr/ESA/EPCAR** (esqueleto→beta): programa oficial de cada edital
  (0 assuntos hoje).
- **CM** (indisponivel→esqueleto): escolher o(s) CM(s) e anexar edital.

## 2. EsPCEx — cobertura antes → depois (com query)

```sql
select pm.materia_codigo, pm.num_questoes,
  (select count(*) from assuntos a
    where a.exam_tag='espcex' and a.materia_codigo=pm.materia_codigo) as assuntos
from prova_materias pm where pm.exam_tag='espcex' order by pm.ordem;
-- por 20q→1 · red→0 · fis 12q→0 · qui 12q→2 · mat 20q→2 · ing 12q→0 · his 12q→0 · geo 12q→0

select count(*) from trilhas where nicho like '%espcex%';  -- 0 (antes E depois)
```

**Antes = depois**: 5 assuntos em 3/7 matérias objetivas; **0 semanas** de
trilha semanal; maturidade `beta`. Sem material-fonte, número igual é o
resultado honesto — o que mudou foi o espelho remoto (indisponivel→beta,
§1.1) e o gap virar documento acionável. O "~70%" da REG1 não foi repetido:
é número sem denominador definido; ficam os medidos acima.

## 3. Recorrência e tagueamento

- **Nenhum bloco de conteúdo novo foi criado**, logo nenhum grau novo foi
  atribuído. Os 3 registros existentes (2 `estimada`, 1 `medida`, todos CN,
  amostra do seed) ficaram como estão; **nenhuma `estimada` foi promovida**
  (regra de ouro do `recorrencia.js` intocada — arquivo sequer alterado).
- **Tagueamento novo: 0 questões.** A única prova real identificada na Fase 0
  (CPACN 2024) existe só como referência em `provas_anteriores` — o documento
  não está no repo nem no storage. Sem prova em mãos, taguear = inventar
  questão/gabarito (proibido).

## 4. Prova final

```
node scripts/validar-conteudo.mjs         → ✓ conteúdo íntegro e maturidade honesta
node --test tests/conteudo-maturidade.test.mjs → fail 0
cd tests && bash reset-db.sh && npm test  → # tests 471 · pass 471 · fail 0   (471 → 471)
cd app && npm run build                   → verde; index 434.47 kB (gzip 124.18)
remoto: vw_concurso_qualidade             → suspeita_incoerencia = false nos 6
```

471 → 471: esta fase não adiciona código, então não adiciona teste. (Os 475 da
FIX2 valem para o PR #62, **ainda aberto** — não estão nesta base.)

## 5. Dupla passada

1. **"Isso tem fonte real por trás?"** aplicado a cada artefato novo: os dois
   docs novos só contêm números com query/comando ao lado; o único dado que
   entrou no produto (nota 33→50) tem três medições independentes; o carimbo
   remoto replica o seed gerado da fonte única mergeada no PR #49. Nenhuma
   linha de trilha, assunto, missão, questão ou recorrência foi criada.
2. **Segunda leitura pegou e ajustei:** (a) a primeira versão do gap doc
   estimava "~9 semanas" para EsPCEx sem dizer que 9 é o molde CN — explicitado
   como molde, não como requisito do edital; (b) evitei repetir o "~70%" da
   REG1 (número sem denominador) e deixei só os medidos; (c) conferi que o
   validador não valida o texto da nota (só maturidade/versão via regex), então
   a correção 33→50 não podia quebrar seed sync — regenerei mesmo assim pelo
   gerador, como o pipeline manda.

## 6. P0/P1 novos e pendências

- **P0/P1 novos: nenhum.** (O espelho remoto não-carimbado era um fio solto de
  auditabilidade, não de segurança/produto — e foi fechado nesta fase.)
- **Pendências desta camada (com dono):**
  - Material-fonte por concurso — **dono** (lista exata e formatos aceitos em
    `conteudo/gaps-material-fonte-concursos.md` §7). É o único bloqueio para
    EsPCEx→completa e EEAr/ESA/EPCAR→beta.
  - Tagueamento real (1.7) — precisa de provas oficiais + gabarito; contínuo.
- **Fora de escopo (inalterado, de outras fases):** observabilidade P1-3, E2E
  secrets, credencial opaca/rate limit, itens FIX2 (PR #62, aberto —
  `aluno_conquistas`/`solicitacoes_acesso` não foram tocados aqui).
- **Risco de merge conhecido:** o PR #62 (FIX2) edita `02-linha-do-tempo.md` e
  `05-camadas-faltantes.md`; esta fase adicionou linhas nos mesmos arquivos.
  Conflito, se houver, é trivial (linhas adjacentes de tabela).

## 7. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `app/src/modules/conteudo/maturidade.js` | nota do CN: 33 → **50** atividades (medido) |
| `supabase/seed/18_maturidade_concursos.sql` | regenerado pelo gerador (só o comentário muda) |
| `docs/conteudo/gaps-material-fonte-concursos.md` | **novo** — gap exato por concurso + material que destrava |
| `docs/auditoria/ped2/inventario-conteudo-concursos.md` | adendo datado (33→50; carimbo remoto; link gaps) |
| `docs/auditoria/ped2-r2/relatorio-ped2-r2-conteudo-trilhas.md` | **novo** — este relatório |
| `docs/00-indices/02-linha-do-tempo.md` | + linha PED2-R2 |
| `docs/00-indices/05-camadas-faltantes.md` | itens 1.7, 2.2, 2.3, 2.4, 2.5 atualizados com o medido em 03/07 |
| *(remoto, sem arquivo)* | `concursos.maturidade/conteudo_versao` carimbados via seed 18 (UPDATE idempotente, 6 linhas) |
