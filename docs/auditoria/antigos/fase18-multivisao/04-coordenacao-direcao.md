# Auditoria — Persona 4: COORDENAÇÃO / DIREÇÃO ESCOLAR

> Auditoria sob a ótica de coordenador pedagógico ou dono de cursinho que decide se usaria
> o sistema como ferramenta de gestão, inclusive com ~300 alunos.
> Base: `app/src/routes/escola/AreaEscola.jsx`, `app/src/modules/desempenho/PainelGestao.jsx`,
> `ClassificacaoTurma.jsx`, `app/src/modules/pessoas/ListaAlunos.jsx`/`CadastroAlunos.jsx`.

---

## 1. Nota geral de maturidade da área: **72/100**

A área da escola é competente e operacional: painel com KPIs e alertas de risco clicáveis,
ranking duplo (estudo e simulado), lista de alunos com filtros úteis e gestão de turmas. Para
uma escola de até ~150–200 alunos, dá para operar de verdade hoje. Perde pontos em escala
(listas sem paginação, tudo carregado de uma vez), na ausência de exportação de relatório, e
porque a comparação entre turmas é rasa frente ao que uma direção precisa para decidir.

## 2. O que está forte

- **Painel que vai direto ao ponto.** `PainelGestao.jsx`: 4 KPIs (alunos, ativos na semana,
  acerto médio, questões em 7 dias) com tom de cor (ok/alerta) e três alertas de risco com
  número grande e **clicáveis** — "Sem atividade (7d)", "Sem credencial", "Meta atrasada" —
  que levam direto ao Ranking/Alunos. Em poucos minutos a coordenação entende o estado.
- **Ranking duplo e honesto.** `ClassificacaoTurma.jsx` separa "Estudos" (questões/acerto/
  tempo/dias, janela 7d ou geral) de "Simulados" (melhor nota por aluno). Critério e janela
  são selecionáveis. Mostra meta da semana inline.
- **Lista de alunos operável.** `ListaAlunos.jsx`: busca por nome, filtro por turma e por
  status (sem credencial / sem consentimento / sem atividade 7d / meta atrasada),
  desempenho inline, e ações por aluno (gerar credencial, trocar turma/concurso, renomear,
  vincular responsável, consentimento, exportar/excluir LGPD).
- **Gestão de turmas com sinal de risco.** Cada turma mostra "X em risco", acerto, questões e
  "sem atividade (7d)", e expande para os alunos.
- **Cadastro em lote.** `cadastrarAlunos` aceita array de nomes, vincula turma/trilha/concurso
  de uma vez — operacionalmente importante para começar o ano.
- **LGPD e marca na própria área** (abas dedicadas), o que dá autonomia à escola.

## 3. O que está fraco

- **Sem paginação nem virtualização.** `AreaEscola` carrega tudo num `Promise.all` (turmas,
  alunos, consentimentos, logs, registros da escola, metas, simulados) e as listas renderizam
  todos os alunos. Com 300 alunos × histórico de registros, a tela fica pesada e a primeira
  carga lenta.
- **Comparação entre turmas é rasa.** Há números por turma, mas não um comparativo lado a
  lado (turma A vs. B em acerto/engajamento/evolução) que uma direção usa para decidir.
- **Sem exportação de relatório.** Não há "baixar CSV/PDF do desempenho da turma/escola" para
  reunião ou prestação de conta aos pais — só a exportação LGPD de um aluno.
- **Acompanhamento por concurso é limitado.** Dá para atribuir concurso ao aluno, mas falta
  um recorte "como está minha turma de EsPCEx vs. minha turma de CN".
- **Gestão pedagógica das fases 15.x não está na tela.** *(verificado, ver
  `13-verificacao-tecnica.md`)* O operacional (cadastrar, gerar credencial, trocar turma/
  concurso, LGPD, marca) está ligado e funciona; mas definir nível do aluno, ajustar missões da
  escola (`missoes_escola`), onboarding e configuração de concurso por escola (`config_escola`)
  existem no banco e estão dormentes — não há UI da coordenação para operá-los.

## 4. O que está confuso

- **Ranking pode gerar distorção.** Ranking de "mais questões" premia volume, não aprendizado;
  exposto a alunos/pais, vira pressão errada. Hoje o ranking é da coordenação (bom), mas falta
  um aviso de leitura ("volume não é nota").
- **Seis abas com pesos diferentes** (Painel, Alunos, Ranking, Turmas, LGPD, Marca) — Marca e
  LGPD são configuração e poderiam viver num "Ajustes" separado do operacional diário.

## 5. O que pode quebrar com uso real

- **Escala de 300 alunos:** carga única + render completo = travamento perceptível e risco de
  o navegador do coordenador (muitas vezes uma máquina modesta na secretaria) engasgar.
- **Estado assíncrono de `AreaEscola`** com várias variáveis (dados, credencial, aluno aberto,
  versão): se uma carga falha no meio, a tela pode ficar inconsistente.
- **Geração de credencial sem confirmação forte** pode ser disparada por engano em lote.

## 6. Problemas críticos

- Nenhum crítico de segurança (a RLS isola a escola; testes de isolamento provam). O ponto
  mais sério é de **escala**: a arquitetura de carregar-tudo-e-renderizar-tudo não está pronta
  para 300+ alunos sem paginação/agregação no servidor.

## 7. Problemas importantes

1. **Falta paginação/virtualização** nas listas e agregação no servidor (hoje o cálculo de
   resumo por aluno é feito no cliente sobre todos os registros).
2. **Sem exportação** de relatório (CSV/PDF) por turma/escola.
3. **Comparação entre turmas** insuficiente para decisão de direção.
4. **Distorção de ranking** sem mediação/aviso.

## 8. Melhorias desejáveis

- Visão "comparar turmas" lado a lado.
- Filtro/recorte por concurso no painel e ranking.
- Exportar relatório da turma.
- Separar "Ajustes" (Marca/LGPD) do operacional.
- Confirmação clara em ações de credencial/exclusão em massa.

## 9. O que não precisa mexer

- Painel de KPIs + alertas clicáveis (excelente como porta de entrada).
- Ranking duplo estudo/simulado com critério e janela.
- Filtros de status na lista de alunos.
- Cadastro em lote.

## 10. O que falta para considerar fechado (visão da coordenação)

1. Paginação + agregação no servidor (uma RPC `resumo_escola` paginada) para operar 300+.
2. Exportação de relatório por turma/escola.
3. Comparação entre turmas e recorte por concurso.
4. Mediação do ranking (aviso de leitura / foco em evolução).

## 11. Lista objetiva de recomendações

| # | Recomendação | Esforço | Prioridade |
|---|--------------|---------|------------|
| 1 | RPC de resumo agregado + paginação nas listas | Alto | Crítica (escala) |
| 2 | Exportar relatório (CSV/PDF) por turma/escola | Médio | Alta |
| 3 | Comparar turmas lado a lado | Médio | Alta |
| 4 | Recorte por concurso no painel/ranking | Médio | Média |
| 5 | Aviso de leitura no ranking | Baixo | Média |
| 6 | Separar aba "Ajustes" (Marca/LGPD) | Baixo | Baixa |

## 12. Veredito final

**Aprovado com ressalvas.** Como ferramenta de gestão para uma escola pequena/média, já é
usável e profissional: o painel orienta, os alertas de risco funcionam, a lista é operável.
Mas o enunciado pede confiança "com 300 alunos", e nesse porte a ausência de paginação/
agregação no servidor e de exportação de relatório impede declarar a área fechada. Resolvido
o desempenho em escala e a exportação, a área chega à faixa de 88.
