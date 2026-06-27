# Auditoria — Persona 3: PROFESSOR / TUTOR

> Auditoria sob a ótica de um professor/tutor de cursinho militar que precisa acompanhar
> alunos e tomar decisões pedagógicas com base no sistema.
> Base: `app/src/modules/desempenho/` (FichaAluno, ClassificacaoTurma, Insights, Niveis,
> RadarDesempenho), `app/src/modules/conteudo/` e a modelagem de níveis/recorrência.

---

## 1. Nota geral de maturidade da área: **62/100**

O sistema dá ao professor matéria-prima boa (registro por matéria, níveis por matéria,
simulados com leitura de eliminação, recorrência por assunto), mas falta o **papel explícito
de professor/tutor**: hoje quem opera a visão pedagógica é a "coordenação". Não há tela
pensada para o tutor conduzir uma turma, marcar intervenção, registrar acompanhamento ou
diferenciar "não estudou" de "estudou e não aprende" de forma destacada. A inteligência
existe nos dados; falta a camada de decisão pedagógica.

## 2. O que está forte

- **Níveis por matéria com origem rastreável.** `aluno_niveis` guarda nível por escopo
  (geral + cada matéria) com `origem` (`calculado`/`manual`/`diagnostico`/`validar`) e
  histórico append-only (`aluno_nivel_historico`, gatilho que grava quem mudou e de quê para
  quê). Isso é ouro para reunião pedagógica — *no banco*. Ressalva: ainda não há tela que
  exponha esse histórico (ver seção 3), então o valor está modelado, não acessível.
- **Classificação por desempenho honesta.** `niveisAluno.js`: abaixo de 20 questões não
  classifica (marca "validar"); "avançado" exige ≥70% E ≥100 questões. Não cria falsa
  precisão — o professor confia mais no rótulo.
- **Simulados com leitura útil.** `simuladoConcurso.js` modela eliminação absoluta (CN: <50%
  em qualquer matéria elimina) e relativa (ESA/EsPCEx por mediana, marcada como inferência,
  não oficial). Aponta matéria de risco, não só a nota.
- **Recorrência por assunto separada por confiança** (estimada/validada/medida). O professor
  sabe distinguir "achismo" de "contado na prova" antes de mandar o aluno priorizar.
- **Diferenciação fraco/médio/forte existe na regra.** A combinação nível por matéria +
  volume + acurácia permite ver onde o aluno trava.

## 3. O que está fraco

- **Não há papel "professor/tutor".** O schema tem `papel in ('coordenacao','aluno',
  'responsavel')` — o professor teria que entrar como coordenação, com acesso total à escola.
  Falta o perfil intermediário (vê só suas turmas, registra acompanhamento).
- **"Falta de estudo" vs. "dificuldade real" não está destacado.** Os dados permitem inferir
  (dias ativos baixos = não estudou; volume alto + acurácia baixa = dificuldade), mas não há
  um indicador que separe os dois casos para o professor de relance.
- **Conteúdo real só para o CN.** Para orientar reforço em EsPCEx/EEAr, o professor não tem
  trilha/missões/assuntos completos — só CN tem as 9 semanas e 33 assuntos.
- **O sistema de níveis persistido (`aluno_niveis`) está dormente.** *(verificado, ver
  `13-verificacao-tecnica.md`)* As funções `salvarNivelAluno`/`carregarNivelAluno` não são
  chamadas por nenhuma tela — coordenação/professor **não conseguem hoje definir nem ver** o
  nível gravado via UI. O nível que aparece ao aluno (`Niveis.jsx`) é **calculado ao vivo das
  métricas**, não o que a escola gravaria. Logo, o histórico de níveis bem modelado é, na
  prática, inacessível pela interface.

## 4. O que está confuso

- **Quem move o nível?** Coexistem nível calculado (automático) e manual. Sem uma tela que
  mostre "este nível foi calculado / foi você que pôs", o professor pode confiar num rótulo
  desatualizado.
- **Recorrência "estimada" pode ser lida como verdade** se a UI não destacar bem o grau de
  confiança (a regra existe em `recorrencia.js`, mas depende da tela respeitá-la).

## 5. O que pode quebrar com uso real

- **Sem o motor de progresso, missões não fecham sozinhas** — o professor não consegue usar
  "missão concluída" como sinal de acompanhamento; teria que olhar registros crus.
- **Listas sem paginação** (`ClassificacaoTurma` renderiza todos os alunos): com turmas
  grandes some a fluidez na hora da reunião.

## 6. Problemas críticos

- **Ausência do papel professor/tutor** com escopo de turma. Hoje, para o professor operar,
  ele recebe acesso de coordenação — o que viola o princípio de menor privilégio e
  inviabiliza confiar a tela a vários tutores numa escola grande.

## 7. Problemas importantes

1. Falta indicador explícito **"não estudou" × "estuda e não rende"**.
2. Falta visão de **intervenção pedagógica** (marcar aluno, registrar ação, acompanhar).
3. **Conteúdo incompleto** fora do CN limita a orientação de reforço.
4. **Nível calculado vs. manual** sem distinção clara na operação.

## 8. Melhorias desejáveis

- Papel `professor`/`tutor` com RLS por turma (vê e acompanha só as turmas que leciona).
- "Lista de intervenção": alunos ordenados por risco com o motivo (sumiu / caiu / trava em
  matéria X).
- Campo de anotação pedagógica por aluno (acompanhamento longitudinal).
- Sugestão automática de reforço a partir de nível por matéria + recorrência validada.

## 9. O que não precisa mexer

- Modelo de níveis por matéria com origem e histórico (está muito bem desenhado).
- Lógica de classificação por desempenho (limiar conservador é o certo).
- Avaliação de simulados com eliminação absoluta/relativa e separação inferência/oficial.

## 10. O que falta para considerar fechado (visão do professor)

1. Papel professor/tutor com escopo de turma (schema + RLS + tela).
2. Indicador que separe falta de estudo de dificuldade real.
3. Fluxo de intervenção pedagógica (lista de risco + anotação + acompanhamento).
4. Conteúdo completo para mais concursos.

## 11. Lista objetiva de recomendações

| # | Recomendação | Esforço | Prioridade |
|---|--------------|---------|------------|
| 1 | Criar papel professor/tutor com RLS por turma | Alto | Crítica |
| 2 | Indicador "sumiu × trava na matéria" na lista | Médio | Alta |
| 3 | Anotação/acompanhamento pedagógico por aluno | Médio | Alta |
| 4 | Completar conteúdo (assuntos/trilha) de 2 concursos | Alto | Alta |
| 5 | Distinguir nível calculado de manual na UI | Baixo | Média |

## 12. Veredito final

**Aprovado com ressalvas (tendendo a reprovado para uso multi-tutor).** A fundação de dados
pedagógicos é forte e honesta, mas o sistema ainda não tem o **professor como ator de
primeira classe**: sem papel próprio, sem visão de intervenção e com conteúdo restrito ao CN,
o tutor de uma turma real é forçado a usar a tela da coordenação e a interpretar dados crus.
Com o papel professor + lista de intervenção + conteúdo de mais concursos, a área salta para
a faixa de 85.
