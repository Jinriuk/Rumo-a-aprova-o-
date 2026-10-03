# Trilha CFO PMERJ v1: orçamento da turma de 15 h e gerador

**03/10/2026 · item P0.3 · nada aplicado em demonstração nem em produção.**

Fonte: `supabase/seed/trilha-pmerj-cfo-v1.json`.
Gerador e validador: `scripts/gerar-seed-trilha-pmerj-cfo.mjs`.
Desenho de origem: os dois documentos desta pasta.

## Decisões do dono aplicadas

- Nome público: **"CFO PMERJ, preparação pré-edital"**, sem ano.
- Turma padrão: bacharel em Direito, **15 h por semana**: 5 h de
  leitura, 8 h de questões com correção e 2 h de escrita. Substitui a
  turma de referência de 22 h da seção 6.1.
- Pesos por matéria mantidos: 15/15/15/15/10/10 (de 80).

## Orçamento recalculado (seção 6.2)

Mesmas hipóteses do documento: 3 min por questão já com correção;
simulado completo de 80 questões em 4 h mais 2 h de correção; reserva de
25% para revisão e 10% para bloco misto, arredondadas para baixo; o
saldo vai para questões novas.

| Matéria | Semana normal N / R / S | Total normal | Semana com simulado N / R / S | Total com simulado |
|---|---|---:|---|---:|
| Administrativo | 20 / 7 / 3 | 30 | 4 / 2 / 15 | 21 |
| Constitucional | 20 / 7 / 3 | 30 | 4 / 2 / 15 | 21 |
| Penal | 20 / 7 / 3 | 30 | 4 / 2 / 15 | 21 |
| Processo Penal | 20 / 7 / 3 | 30 | 4 / 2 / 15 | 21 |
| Penal Militar | 13 / 5 / 2 | 20 | 3 / 1 / 10 | 14 |
| Direitos Humanos | 13 / 5 / 2 | 20 | 3 / 1 / 10 | 14 |
| **Total** | **106 / 38 / 16** | **160** | **22 / 10 / 80** | **112** |

N = questões novas dirigidas; R = revisão de erros; S = bloco misto ou
simulado.

- Semana normal: 160 × 3 min = 480 min = as 8 h inteiras.
- Semana de simulado: 240 + 120 min de simulado e correção, mais 32 × 3 =
  96 min, total 456 min. Sobram 24 min, que não viram questões.
- Ciclo de 12 semanas (9 normais + 3 de simulado): **1.776 respostas
  planejadas**, sendo 1.020 novas, 372 de revisão e 384 mistas/simulado.
  Na turma de 22 h eram 2.280.
- Leitura: 5 h = 300 min por semana, 56 min para cada matéria de peso 15
  e 38 min para cada uma de peso 10.

Em relação ao documento, mudou uma regra. O documento arredonda em
blocos de 5, e com 160 questões isso não preserva os pesos (daria 20 em
Penal Militar e 15 em Direitos Humanos, ou o contrário). Aqui o bloco é
**16**, o denominador comum de 15/80 (= 3/16) e 10/80 (= 2/16). Com
ele, cada matéria recebe exatamente a sua parte: 30:20 na semana normal
e 21:14 na de simulado. O validador recalcula a tabela a partir das
horas e reprova se o manifesto divergir.

## O que o manifesto tem

- As 6 matérias, com códigos `dir_adm`, `dir_const`, `dir_pen`,
  `dir_proc_pen`, `dir_pen_mil` e `dir_hum`, iguais em `materias` e em
  `disciplinas`. Há também duas disciplinas operacionais: `esc` (escrita
  jurídica) e `sim` (simulado).
- As **219 linhas** do Anexo II.
  - Texto literal, conferido por teste contra a matriz desta pasta.
  - Chave estável `ADM-01`…`DH-12`.
  - Contagem FGV 2024 e prioridade.
- O **Apêndice A** literal (faixas por semana). O gerador expande as
  faixas e o validador exige exatamente um destino por linha.
- As 12 semanas, com foco (6.3), entrega de escrita (6.3) e sínteses por
  matéria (6.4 e 6.5). **Nenhuma data.**
- **24 missões escritas**, das semanas 1 a 4, e **48 marcadas como
  `pendente`**, das semanas 5 a 12, sem texto e fora do banco.

## Como gerar uma turma

```bash
node scripts/gerar-seed-trilha-pmerj-cfo.mjs --validar
node scripts/gerar-seed-trilha-pmerj-cfo.mjs --inicio 2026-10-05 --turma 1 --saida /tmp/pmerj-turma-1.sql
```

- `--inicio` é obrigatório e precisa ser uma segunda-feira. Não há valor
  padrão. As 12 semanas vão de segunda a domingo, sem lacuna.
- `--turma N` vira `trilhas.versao`. Turma nova é número novo.
- `--publicada` marca a trilha como publicada. Sem esse parâmetro, ela
  nasce não publicada.
- O SQL não é commitado no repositório nem entra na sequência de seeds
  (`NN_*.sql`), porque depende da data escolhida.

Garantias do SQL, testadas em `tests/trilha-pmerj-cfo-db.test.mjs`:

- Rodar duas vezes não duplica nada.
- Mesma turma com outro início: recusado, sem mudar nada.
- Turma nova não mexe nas datas da anterior.
- Turma com meta já gerada aceita o SQL de novo. Nada é apagado, porque
  `meta_atividades` aponta para `atividades_modelo` sem cascata.
- O concurso entra com data vazia, e o SQL não toca uma data que o
  operador tenha posto depois.
- O SQL não carimba `concursos.maturidade`.

## Decisões editoriais que o dono pode querer rever

- **Missões da semana 4 (simulado) são de acompanhamento manual.**
  - O orçamento dá 4 questões novas (3 em Penal Militar e Direitos
    Humanos). Uma missão automática desse tamanho fecharia com qualquer
    registro.
  - Por isso ficam com meta vazia, fora da fila do motor, e com critério
    "simulado corrigido com a causa de cada erro".
- **Acurácia não é exigida para fechar missão nesta primeira
  passagem.**
  - O critério é execução: N questões resolvidas e corrigidas.
  - Exigir acurácia travaria a fila de quem está abaixo dela, e a
  seção 4.5 diz que acurácia é gate de produto, não critério pedagógico.
- **XP**: 3 por questão da meta (60 ou 39). Missão manual vale 30.
- **Assunto principal da missão** é uma linha do Anexo II. As demais
  linhas trabalhadas ficam no manifesto (`linhas`) e no campo `origem`.
  O motor continua creditando por matéria (P0.4 ainda não foi feito):
  o texto das missões não promete acompanhamento por assunto.

## O que falta para publicar (P0.6, não autorizado)

1. Pôr `pmerj_cfo` em `app/src/modules/conteudo/maturidade.js` como
   `pre_edital`, com `trilhaNicho: "pmerj-cfo"`. Depois, rodar o gerador
   do seed 18. Sem isso, a interface trata o concurso como indisponível:
   ele falha fechado.
2. Decidir onde o concurso entra no seed de catálogo (`05_concursos.sql`)
   e no validador de maturidade, que hoje lê só os seeds 05, 07 e 09.
3. Escrever as 48 missões pendentes.
4. Aplicar o SQL de uma turma, primeiro na demonstração, com autorização.
