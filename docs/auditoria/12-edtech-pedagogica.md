# Auditoria — Persona 12: EDTECH / PEDAGÓGICA

> Auditoria por especialista em produto educacional e preparação para concursos militares.
> Base: `app/src/modules/conteudo/*.js`, `app/src/shared/regras/regras.js`, seeds
> (`supabase/seed/*`), docs das fases 15.1–15.7.

---

## 1. Nota pedagógica da área: **72/100**

A modelagem pedagógica é inteligente e honesta: trilhas com fases (fundação → consolidação →
reta final), missões acionáveis com critério e XP, níveis por matéria com classificação
conservadora, simulados que leem eliminação (absoluta e relativa) sem inventar, recorrência
por assunto separada por grau de confiança, e gamificação anti-grind. O conceito está certo.
Perde pontos porque o conteúdo real só está completo para o Colégio Naval, o motor que fecha
missões e concede XP por evento ainda não existe (tudo é derivado), e nada disso está ligado à
UI do aluno — a inteligência vive no código e nos testes, não na tela.

## 2. O que está forte

- **Trilhas com lógica de estudo plausível.** CN tem 9 semanas reais (30/05–01/08/2026, 250
  questões/semana) com progressão pedagógica clara: diagnóstico → base crítica (frações,
  potenciação) → geometria → consolidação + redação → reta final (refazer provas + descanso
  estratégico). Prioridades F/P/X (Fechar/Pincelar/Mínimo) orientam o esforço.
- **Missões acionáveis.** Cada missão tem matéria, assunto real, quantidade de questões, tempo
  estimado, XP e critério de conclusão ("≥60 questões e ≥80% nas últimas 30"). Filtráveis por
  nível. Não são decorativas — apontam o quê fazer e quando "fechou".
- **Níveis por matéria honestos.** Classificação por desempenho com piso: abaixo de 20
  questões não classifica; "avançado" exige ≥70% E ≥100 questões. Diferencia fraco/médio/forte
  por matéria, não só geral. Reta final ativa por proximidade da prova (≤90 dias).
- **Simulados com leitura útil.** Eliminação absoluta (CN: <50% em qualquer matéria) e relativa
  (ESA/EsPCEx por mediana, marcada como inferência, não oficial). Nota projetada do Dia 1 do CN
  = (mat+ing)×2,5, preservada e testada. Redação tratada por papel (eliminatória/classificatória).
- **Recorrência por assunto com graus de confiança** (estimada/validada/medida): inferência
  nunca vira prioridade oficial sozinha — exige confirmação. Pedagogicamente correto.
- **Gamificação anti-distração.** XP de missão só pontua com acurácia mínima; conquistas de
  volume carregam piso de acerto; patentes altas exigem critério ("nenhuma matéria abaixo do
  piso"). A gamificação reforça comportamento de estudo certo, não cliques.

## 3. O que está fraco

- **Conteúdo real só para o Colégio Naval.** Só CN tem trilha completa (9 semanas) e 33
  assuntos. EsPCEx tem estrutura + literatura (~70%); EPCAR/ESA/EEAr têm 2–4 assuntos e trilha
  só nos tipos "anual/reta final" (sem semanas detalhadas). Colégio Militar: sem config.
- **Sem motor de progresso que feche missão/conceda XP por evento.** Critério de missão é
  texto descritivo, não gatilho; o XP é derivado na exibição. O aluno não recebe "missão
  concluída" automático nem histórico de XP — a jornada gamificada ainda não "acontece".
- **Tagueamento de recorrência é amostra.** Há ~3 questões tagueadas (CPACN 2024); a
  recorrência "medida" cobre <1% do necessário. A estrutura existe; o dado real, quase não.
- **Nada ligado à UI.** Os módulos pedagógicos (níveis, missões, gamificação, simulado,
  recorrência) não são importados por tela — footprint zero no bundle. A inteligência está em
  `*.js` puro e nos testes, não no produto que o aluno usa.

## 4. O que está confuso

- **Nível calculado vs. manual** convivem sem distinção clara para quem opera — risco de
  confiar em rótulo desatualizado.
- **"Recorrência estimada"** pode ser lida como verdade se a tela não respeitar o grau de
  confiança (a regra existe; depende da UI honrá-la quando for construída).

## 5. O que pode quebrar pedagogicamente

- **Promessa maior que entrega fora do CN:** um aluno de EsPCEx/EEAr não tem trilha/missões
  reais para seguir — a proposta "te guio no estudo" não se sustenta ainda para o nicho inteiro.
- **Gamificação calculada que "muda sozinha"** se a regra de cálculo mudar (sem ledger
  persistido), corroendo a confiança do aluno no XP/patente.

## 6. Problemas críticos (pedagógicos)

- **Falta o motor de progresso** que transforma registros em missões fechadas e XP concedido.
  Sem ele, o coração pedagógico-gamificado é uma maquete bem-feita, não uma jornada vivida.
- **Conteúdo incompleto** para 4 dos 5 concursos — limita o valor educacional ao CN.

## 7. Problemas importantes

1. Ligar os módulos pedagógicos à UI do aluno/professor.
2. Produzir conteúdo real (assuntos/trilha/missões) para EsPCEx e EEAr.
3. Avançar o tagueamento de recorrência para volume útil.
4. Distinguir nível calculado de manual e honrar grau de confiança na tela.

## 8. Melhorias desejáveis

- "O que fazer amanhã" explícito derivado da trilha + nível + recorrência validada.
- Recomendação de reforço automática (matéria fraca × assunto recorrente).
- Feedback de evolução por matéria com leitura ("você saiu de base para intermediário em
  geometria").

## 9. O que não precisa mexer

- O desenho das trilhas por fase e prioridades F/P/X.
- A classificação de níveis conservadora.
- A avaliação de simulados (eliminação absoluta/relativa, inferência vs. oficial).
- A separação de graus de recorrência e a gamificação anti-grind.

## 10. O que falta para considerar fechado (pedagógico)

1. Motor de progresso (missão fecha / XP concedido / histórico) ligado aos registros.
2. Módulos pedagógicos integrados à UI (aluno e professor).
3. Conteúdo real completo para ao menos +2 concursos.
4. Recorrência com tagueamento de volume útil.

## 11. Lista objetiva de recomendações

| # | Recomendação | Prioridade |
|---|--------------|------------|
| 1 | Implementar motor de progresso (evento → missão/XP/conquista persistidos) | Crítica |
| 2 | Ligar níveis/missões/gamificação/simulado à UI | Crítica |
| 3 | Produzir conteúdo completo de EsPCEx e EEAr | Alta |
| 4 | Avançar tagueamento de recorrência | Média |
| 5 | "O que fazer amanhã" + recomendação de reforço | Média |

## 12. Veredito final

**Aprovado com ressalvas.** A proposta pedagógica é, conceitualmente, a parte mais sofisticada
e honesta do sistema — leva a sério a diferença entre inferência e fato, entre volume e
domínio, entre fraco/médio/forte. Mas valor educacional só se realiza quando vira tela e
jornada: hoje, fora do Colégio Naval, e sem o motor de progresso ligado à UI, a entrega
pedagógica é potencial, não realizada. Com o motor + integração + conteúdo de +2 concursos, a
nota pedagógica salta para a faixa de 90.
