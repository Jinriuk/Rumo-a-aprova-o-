# Fábrica de trilhas e conteúdo por concurso

> Pipeline **versionado** para adicionar, revisar, testar e publicar conteúdo de
> um concurso sem trabalho manual caótico. Substitui o "cada concurso novo vira
> um improviso" por um processo de 6 passos com porteiros automáticos.
>
> Escopo PED2. Não cobre criação de questões oficiais nem conteúdo protegido por
> copyright.

---

## 0. Princípios

1. **Fonte única, banco como espelho.** A maturidade de cada concurso é
   declarada em **um só lugar** — `app/src/modules/conteudo/maturidade.js`. O
   banco (`concursos.maturidade`) é preenchido por um seed **gerado** a partir
   dela; nunca se edita o banco à mão.
2. **Honestidade por padrão.** Concurso novo / desconhecido nasce
   `indisponivel`. A UI nunca exibe conteúdo parcial como pronto — isso é
   garantido por código, não por disciplina humana.
3. **Conteúdo é versionado.** Trilha semanal vem de JSON (`trilha-<nicho>-vN.json`)
   → SQL **gerado** e commitado. Maturidade tem `conteudo_versao`. Nada de SQL
   escrito à mão para conteúdo estruturado.
4. **Nada publica vermelho.** Build, testes e o validador de conteúdo precisam
   passar antes de qualquer publicação.

---

## 1. Anatomia do conteúdo de um concurso

Da menos para a mais pronta, as quatro peças:

| Peça | Tabela | Fonte | Mínimo p/ nível |
|---|---|---|---|
| Estrutura de prova | `prova_materias` (+ `provas`, `prova_dias`) | `07_provas.sql` | `esqueleto` |
| Assuntos catalogados | `assuntos` (+ `subassuntos`) | `07_provas.sql` | `beta` |
| Missões / planos | `missoes`, `trilha_planos` | `09_trilhas_missoes.sql` | (complementar) |
| **Trilha semanal** (calendário) | `trilha_semanas`, `atividades_modelo` | `trilha-<nicho>-vN.json` → `02_trilha_*.sql` | `completa` |

> Os níveis e seus requisitos vivem em `REQUISITOS_MATURIDADE`
> (`maturidade.js`). Mudou a régua? Muda lá, e o validador passa a cobrar o novo
> mínimo.

---

## 2. Pipeline — adicionar/evoluir um concurso

### Passo 1 — Cadastrar o concurso (se ainda não existe)
Adicione a linha em `supabase/seed/05_concursos.sql` (código, nome, organização,
nível, data média). O default de maturidade no banco é `indisponivel`, então ele
**não aparece como pronto** enquanto não houver conteúdo.

### Passo 2 — Estrutura de prova (→ `esqueleto`)
Em `07_provas.sql`: `provas`, `prova_dias`, `prova_materias` com `status_dado`
`oficial` quando vier do edital. Isso já habilita simulado/estrutura.

### Passo 3 — Assuntos (→ `beta`)
Ainda em `07_provas.sql`: `assuntos` (e `subassuntos`) por `materia_codigo`.
Marque `status_dado` honesto: `oficial` (programa do edital catalogado),
`inferencia` (recorte pedagógico nosso) ou `validar` (dúvida de transcrição).

### Passo 4 — Missões e planos (complementar)
Em `09_trilhas_missoes.sql`: `trilha_planos` (anual / reta_final) e `missoes`
ligadas a `exam_tag` + `materia_codigo`. A regra anti-furo já garante que missão
de outro concurso não vaza para o aluno.

### Passo 5 — Trilha semanal (→ `completa`)
1. Crie `supabase/seed/trilha-<nicho>-vN.json` (espelhe `trilha-cn-v1.json`:
   `disciplinas`, `semanas[].tarefas[{s,p,t}]`, `foco` por semana).
2. Gere o SQL: estenda/rode o gerador de seed da trilha
   (`scripts/gerar-seed-trilha.mjs`) e commite o `.sql` gerado.
3. Aponte o arquivo em `maturidade.js` (`trilhaSemanalRef`).

### Passo 6 — Promover a maturidade e gerar o espelho
1. Edite o nível do concurso em `app/src/modules/conteudo/maturidade.js`
   (suba `conteudo_versao` quando o conteúdo mudar de forma relevante).
2. Regenere o seed espelho:
   ```bash
   node scripts/gerar-seed-maturidade.mjs   # → supabase/seed/18_maturidade_concursos.sql
   ```
3. Valide:
   ```bash
   node scripts/validar-conteudo.mjs        # falha se a maturidade prometer mais que o conteúdo
   ```

---

## 3. Revisão e testes (porteiros)

Antes de publicar, **tudo** abaixo precisa passar:

```bash
# 1) Integridade + honestidade de conteúdo (offline, sem banco)
node scripts/validar-conteudo.mjs

# 2) Testes de integridade de conteúdo (puro)
node --test tests/conteudo-maturidade.test.mjs

# 3) Build do front
cd app && npm run build

# 4) Suíte completa contra Postgres real (migrations + seeds + RLS + motor)
cd tests && bash reset-db.sh && npm test
```

O `validar-conteudo.mjs` é o porteiro central. Ele **reprova** quando:
- um concurso é declarado num nível acima do conteúdo real (ex.: `beta` sem
  assunto, `completa` sem trilha semanal);
- a matriz e o seed de concursos divergem (concurso sem maturidade, ou
  maturidade de concurso inexistente);
- há furo de integridade: **semana vazia**, **assunto sem nome**, **matéria sem
  slug/código**, **plano de trilha apontando concurso inexistente**;
- o seed gerado `18_maturidade_concursos.sql` está dessincronizado da fonte
  única (esqueceram de rodar o gerador).

Auditoria no banco a qualquer momento:
```sql
select * from vw_concurso_qualidade order by maturidade, codigo;
-- coluna suspeita_incoerencia = true → concurso vendido além do conteúdo
```

---

## 4. Publicação

1. Os quatro porteiros do §3 estão verdes.
2. Migrations aplicadas pelo pipeline normal (ver
   [`docs/deploy-checklist.md`](../deploy-checklist.md)). **Migration de
   conteúdo só com justificativa, rollback e teste** — a `0034` é o modelo
   (aditiva, idempotente, rollback documentado no topo do arquivo).
3. `node scripts/checar-migrations.mjs` confirma paridade repo × banco antes de
   publicar o front.

---

## 5. Preparar ENEM / Policiais (sem implementar agora)

O terreno já está pronto:

- Adicionar o concurso em `05_concursos.sql` faz ele nascer `indisponivel` no
  banco (default da `0034`).
- `maturidadeDe(codigo)` devolve `indisponivel` para qualquer código que ainda
  não esteja na matriz — então **nada quebra na UI** ao introduzir um concurso
  sem conteúdo: o selo aparece como "Indisponível" e o cadastro recusa alunos.
- Quando houver conteúdo, é só seguir os passos 2→6. Nenhuma modalidade nova
  precisa de código novo de UI.

> **Não** implementar ENEM/Policiais nesta camada (escopo PED2 §7). Este capítulo
> é só o ponto de entrada documentado para o futuro.
