# Relatório Coordenação — QA0 pós-D0

Login coordenacao@vitrine.demo: ok.

## Avaliação por área

| Área | Funciona | Confiança | Nota |
|------|----------|-----------|------|
| Painel | 60 alunos, 48 ativos, 66% acerto, 1686 questões/7d | Bom, mas Meta atrasada 59/60 assusta (ver COO-1) | 7 |
| Alunos | 60/60, busca, filtros, credencial/consentimento/exam_tag por card; menu Mais (renomear, responsável, consentimento, regerar credencial, exportar/excluir LGPD) | Muito bom | 8.5 |
| Ranking | funciona | Lucas #1 é outlier artificial (ver COO-2) | 6.5 |
| Turmas | CN/EPCAR manhã 16, tarde 15, EsPCEx 14, EsSA/EEAr 13 | Sobrou Turma CN 2026 com só 2 alunos (ver COO-3) | 7 |
| Marca (white-label) | nome, logo URL, cor de acento #CDA349, preview ao vivo | Muito bom | 9 |
| LGPD | consentimentos 18, acessos 100, ações LGPD 0 | Excelente | 9 |
| Ficha do aluno | abre, dados ricos | Ver COO-4 (conteúdo de concurso trocado) | 6 |

## Achados

| ID | Achado | Conta | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|-------|---------|------|----------|---------|------|
| COO-1 | Painel mostra Meta atrasada 59/60 (~98%) | coordenação | Médio. Em print/demo parece que o sistema inteiro está atrasado — péssima primeira impressão | P2 | Ajustar dados demo para distribuição realista, ou rotular como meta da semana em curso | Baixo | C1/demo |
| COO-2 | Ranking: Lucas Demo #1 é outlier artificial (170q/88%/12h45m/6-6 100%) vs resto (~91q/4h/3-6 50%) | coordenação | Médio. Em demo parece dado de teste, não escola real | P2 | Suavizar o perfil forte do Lucas para parecer orgânico | Baixo | demo |
| COO-3 | Turma CN 2026 com apenas 2 alunos — resíduo de seed | coordenação | Baixo/Médio. Aparece em prints de Turmas como sobra | P2 | Remover/realocar antes de gravar demo (sem limpeza de banco agora) | Baixo | demo |
| COO-4 | Aluno de EsPCEx (Alexandre Moraes Pinho) exibindo conteúdo de missão do Colégio Naval | coordenação | Alto para credibilidade pedagógica. Diretor de escola percebe na hora que a trilha não casa com o concurso | P1 | Investigar mapeamento exam_tag para missões na ficha; garantir conteúdo por concurso | Médio | C1 |

## Veredito

Backoffice da coordenação é capaz e o white-label/LGPD impressionam. Mas os dados demo têm tells (COO-1/2/3) e há um bug pedagógico real (COO-4). Nota geral: 7.0.
