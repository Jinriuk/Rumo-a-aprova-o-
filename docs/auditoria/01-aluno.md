# Auditoria — Persona 1: ALUNO

> Auditoria de maturidade do "Rumo à Aprovação" sob a ótica de um aluno de cursinho
> preparatório militar usando o sistema todos os dias por 3 meses.
> Base: `app/src/routes/aluno/`, `app/src/modules/motor/`, `app/src/modules/desempenho/`,
> `app/src/modules/conteudo/`. Não é avaliação comercial — é uso real.

---

## 1. Nota geral de maturidade da área: **78/100**

A experiência do aluno é a parte mais cuidada do produto. A tela "Hoje" orienta de
verdade, o registro de estudo é rápido, e a gamificação tem lastro pedagógico (não é
enfeite). Perde pontos porque o conteúdo real só existe para um concurso (Colégio Naval),
a gamificação é calculada na exibição (não há motor que conceda XP automaticamente ainda),
e há excesso de abas competindo pela atenção do aluno fraco.

## 2. O que está forte

- **A tela "Hoje" (`VisaoEstudo.jsx`) realmente orienta.** Abre com patente + XP + ofensiva,
  a missão atual com alvo e prazo ("concluir X objetivos até [data]"), a meta da semana e
  as atividades pendentes destacadas. Não é um despejo de dados — há uma hierarquia de
  "o que fazer agora".
- **Registro de estudo é rápido.** `Registrar.jsx` (171 linhas): 4 campos principais
  (matéria, tópico, questões, acertos) e 3 secundários recolhíveis. Validação em tempo real
  (acertos não pode passar de questões; tempo aceita "45min", "1h30"). Resumo do dia no topo
  e últimos 12 registros com exclusão inline. O cronômetro integrado (`Cronometro.jsx`)
  auto-preenche o tempo e sobrevive a refresh (localStorage + timestamps).
- **Gamificação com lastro.** XP, patentes (8 níveis: Recruta → Aspirante) e conquistas
  (~10 tipos) não premiam volume puro: `gamificacao.js` exige acurácia mínima para pontuar
  ("antigaming") e as conquistas de volume carregam piso de acerto. Patente alta exige
  critério adicional ("nenhuma matéria abaixo do piso"). Isso é maduro: motiva estudar
  certo, não só clicar.
- **Sensação de progresso visível.** Aba "Plano" mostra a jornada como timeline de semanas
  (encerrada / agora / cadeado), e "Desempenho" traz gráficos de evolução, radar por matéria
  e insights ("melhor matéria", "atenção", "evolução geral").
- **Mobile de verdade.** Navegação dupla (barra inferior no celular, sidebar no desktop),
  safe-area para notch iOS, e o registro é confortável no telefone.

## 3. O que está fraco

- **Conteúdo real só para o Colégio Naval.** Só CN tem as 9 semanas de trilha completas e
  33 assuntos. EsPCEx, EEAr, EPCAR e ESA têm apenas estrutura/esqueleto (2–4 assuntos,
  trilha "anual + reta final" sem semanas detalhadas). Um aluno de EsPCEx hoje vê uma casca.
- **XP/conquistas são calculados na exibição, não persistidos.** `jargao.js` deriva o XP em
  tempo real de metas/registros/simulados; não há ainda um motor que **conceda** XP por evento
  e grave histórico. Resultado: a pontuação pode "mudar" se a regra de cálculo mudar, e o
  aluno não recebe um "ganhou +60 XP" no momento da ação — o número simplesmente aparece
  diferente na próxima abertura.
- **Critério de conclusão de missão é texto, não gatilho.** A missão diz "≥60 questões e
  ≥80% nas últimas 30", mas o sistema ainda não fecha a missão sozinho com base nos
  registros — falta o motor de progresso. O aluno não tem certeza de quando "bateu" a missão.

## 4. O que está confuso

- **Sete abas no aluno** (Hoje, Registrar, Desempenho, Simulados, Conquistas, Histórico,
  Plano). Para o aluno forte é riqueza; para o aluno fraco/médio é onde se perde. As três
  abas de "ver progresso" (Desempenho, Conquistas, Histórico, Plano) competem entre si.
- **Dois vocabulários convivem.** A interface mistura linguagem militar/jogo ("patente",
  "ofensiva", "alvos abatidos", "missão") com pedagogia seca ("acerto %", "questões 7d").
  Funciona, mas exige o aluno aprender dois dialetos.
- **"Simulados" aparece como aba do aluno e como leitura — não fica claro se o aluno
  registra o próprio simulado** ou se é algo lançado pela escola.

## 5. O que pode quebrar com uso real

- **Clique duplo em "Registrar"** insere dois registros: não há debounce/trava (`Registrar.jsx`
  dispara o insert sem mutex). Em 3 meses isso acontece e polui os números.
- **Cronômetro esquecido ligado.** Se o aluno fecha a aba sem finalizar, o tempo fica
  persistido e reaparece na próxima sessão somando minutos que não foram estudados.
- **Erro de rede vira mensagem crua.** Toda falha colapsa em `e.message` numa faixa vermelha;
  sem retry nem mensagem amigável. No 4G instável do dia a dia, isso frustra.

## 6. Problemas críticos

- Nenhum problema crítico de segurança ou perda de dado do ponto de vista do aluno (a RLS
  protege o que é dele). O "crítico" aqui é de **proposta de valor**: para qualquer concurso
  que não seja o Colégio Naval, o aluno não tem trilha/missão real para seguir.

## 7. Problemas importantes

1. Falta o **motor de progresso** que concede XP por evento e fecha missões automaticamente
   (hoje tudo é derivado na exibição).
2. **Conteúdo incompleto** para 4 dos 5 concursos.
3. **Sem trava de duplo envio** no registro de estudo e no toggle de atividades.
4. **Excesso de abas** para o aluno mediano — falta um "modo simples".

## 8. Melhorias desejáveis

- Notificação/feedback no momento da conquista ("+60 XP — semana completa").
- Auto-pausar/avisar o cronômetro após inatividade.
- Um "próximo passo único" no topo do Hoje para o aluno fraco ("Hoje: faça 20 questões de
  Geometria").
- Retry automático e mensagens de erro humanas.

## 9. O que não precisa mexer

- Fluxo de registro de estudo (rápido e bem validado).
- Modelo de gamificação anti-grind (conceito está certo).
- Navegação mobile/desktop e o cronômetro.
- A tela "Plano" (timeline) — é uma das melhores da experiência.

## 10. O que falta para considerar fechado (visão do aluno)

1. Motor que **concede e persiste** XP/conquistas e **fecha missões** por evento real.
2. Conteúdo (trilha + missões + assuntos) completo para pelo menos 2–3 concursos além do CN.
3. Trava de duplo envio e tratamento de erro de rede com retry.
4. Um modo "essencial" que esconda abas avançadas para quem só quer saber o que fazer hoje.

## 11. Lista objetiva de recomendações

| # | Recomendação | Esforço | Prioridade |
|---|--------------|---------|------------|
| 1 | Implementar motor de progresso (XP/conquista/missão por evento, persistido) | Alto | Crítica |
| 2 | Completar conteúdo de EsPCEx e EEAr (trilha + missões) | Alto | Alta |
| 3 | Debounce/trava no registro e no toggle de atividade | Baixo | Alta |
| 4 | Feedback imediato de XP ganho | Médio | Média |
| 5 | "Modo essencial" / reduzir abas para aluno fraco | Médio | Média |
| 6 | Retry + mensagens de erro amigáveis | Baixo | Média |

## 12. Veredito final

**Aprovado com ressalvas.** Como experiência, o aluno do Colégio Naval tem hoje um produto
bom, orientado e motivador. Mas o sistema só está "fechado" para esse aluno: para os demais
concursos falta conteúdo, e para todos falta o motor que transforma a gamificação calculada
em gamificação vivida (XP concedido, missão fechada). Resolvido o motor e o conteúdo de mais
2 concursos, a nota do aluno sobe para a faixa de 90.
