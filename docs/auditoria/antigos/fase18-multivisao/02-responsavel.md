# Auditoria — Persona 2: RESPONSÁVEL

> Auditoria sob a ótica de um pai/mãe/responsável leigo, que não entende de concurso militar
> nem de tecnologia, olhando a tela uma ou duas vezes por semana.
> Base: `app/src/routes/responsavel/AreaResponsavel.jsx` (93 linhas) e
> `app/src/modules/desempenho/ResumoResponsavel.jsx` (154 linhas).

---

## 1. Nota geral de maturidade da área: **80/100**

A área do responsável é deliberadamente simples e foi a decisão de produto mais acertada:
uma única tela, sem abas, sem jargão de jogo, com uma frase em português claro abrindo tudo.
Para um leigo, é a parte do sistema que mais "respeita" quem olha. Perde pontos porque o
indicador de risco é raso, falta contexto comparativo ("isso é bom ou ruim?") e a confiança
depende de a escola alimentar os dados.

## 2. O que está forte

- **Uma tela, sem labirinto.** `AreaResponsavel.jsx` entrega só `ResumoResponsavel` —
  sem abas, largura reduzida (760px), pensada para ser lida de cima a baixo no celular.
- **Frase interpretativa no topo.** Em vez de jogar números, abre com algo como
  *"João estudou em 3 dias nesta semana, resolveu 45 questões e está com 72% de acerto"*.
  Isso é exatamente o que um pai precisa: a leitura pronta, não a matéria-prima.
- **Linguagem 100% leiga.** Zero "patente", "XP", "ofensiva". Os cinco cartões são
  autoexplicativos: Meta da semana, Questões, Tempo, Acerto geral, Dias ativos.
- **Sinais de alerta simples.** Lista de bullets em vermelho/dourado: "Poucos dias de
  estudo", "Acerto caindo", "Matérias para reforçar". É o gancho para a conversa com o filho.
- **Dá assunto para a conversa.** Melhor e pior matéria destacadas, último simulado com a
  nota em destaque. Depois de olhar, o responsável sabe o que perguntar: *"por que biologia
  caiu?"*.
- **Privacidade correta.** O responsável só enxerga o aluno vinculado (RLS), e o acesso é
  registrado em log (LGPD). Sem ranking, sem dado de outros alunos.

## 3. O que está fraco

- **"Dias ativos" não é prova de estudo real.** O sistema mostra que houve registro, não que
  houve estudo de verdade — depende do aluno lançar. O responsável pode ter falsa segurança
  (ou falso alarme) se o aluno esquecer de registrar.
- **Falta referência do que é "bom".** "72% de acerto" — isso aprova ou reprova? Não há
  comparação com a meta do concurso nem com a turma. Um leigo não tem como calibrar.
- **Risco de abandono é raso.** Há "poucos dias de estudo", mas não há um indicador claro
  e graduado tipo "atenção: 10 dias sem estudar" com destaque forte.

## 4. O que está confuso

- **"Meta da semana 5/8"** — sem explicar que "meta" são as atividades planejadas da trilha.
  Para o leigo, "meta" pode soar como nota.
- **Acerto "geral" vs. acerto "da semana"** aparecem em lugares diferentes; um pai pode
  comparar maçã com laranja sem perceber.

## 5. O que pode quebrar com uso real

- **Tela vazia se o aluno não registra nada.** Se o filho não usa o app, o responsável vê
  zeros e pode concluir "o sistema não funciona" em vez de "meu filho não estudou".
- **Mesma dependência de rede/erro do resto do front:** falha vira faixa vermelha técnica,
  que assusta um leigo mais do que informa.

## 6. Problemas críticos

- Nenhum problema crítico. A área é segura e simples por construção.

## 7. Problemas importantes

1. **Ausência de referência/benchmark** ("isto está dentro ou fora do esperado?").
2. **Indicador de risco de abandono pouco visível** — devia ser o primeiro elemento quando
   acende.
3. **Estado vazio mal explicado** — precisa distinguir "sem dados" de "aluno não estudou".

## 8. Melhorias desejáveis

- Semáforo único no topo: verde/amarelo/vermelho com uma frase ("Tudo certo" / "Atenção" /
  "Precisa de ajuda").
- Comparação leve com a meta do concurso ("para o Colégio Naval, mira-se ~70% — ele está em
  72%").
- Pequeno texto de rodapé explicando que os dados dependem do aluno registrar.

## 9. O que não precisa mexer

- A decisão de uma tela única sem abas.
- A frase interpretativa de abertura.
- A ausência total de jargão de jogo.
- O isolamento (só o aluno vinculado) e o log de acesso.

## 10. O que falta para considerar fechado (visão do responsável)

1. Um indicador de status único e graduado (semáforo) no topo.
2. Referência do que é "bom" para o concurso do filho.
3. Estado vazio que oriente ("seu filho ainda não registrou estudos esta semana").

## 11. Lista objetiva de recomendações

| # | Recomendação | Esforço | Prioridade |
|---|--------------|---------|------------|
| 1 | Semáforo de status com frase única no topo | Baixo | Alta |
| 2 | Benchmark leve contra a meta do concurso | Médio | Alta |
| 3 | Mensagem de estado vazio orientadora | Baixo | Média |
| 4 | Destaque forte para risco de abandono | Baixo | Média |
| 5 | Microcopy explicando dependência de registro | Baixo | Baixa |

## 12. Veredito final

**Aprovado.** É a área mais "fechada" do sistema para o público a que se destina: simples,
leiga, segura e com leitura pronta. As melhorias (semáforo, benchmark, estado vazio) elevam
a confiança, mas não há nada que impeça um responsável real de usar hoje. Com os ajustes,
chega facilmente a 90.
