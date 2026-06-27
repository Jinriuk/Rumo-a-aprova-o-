# Relatório Área do Aluno — QA0 pós-D0

Login LUCASDEMO2026: ok. Testado desktop. Mobile não verificado visualmente nesta sessão (breakpoints existem no CSS: 560px / 1023px / 1024px + sidebar e bottom-nav).

## Avaliação por aba (funciona? / parece produto pronto?)

| Aba | Funciona | Confiança/acabamento | Nota |
|-----|----------|----------------------|------|
| Hoje | Missão 3 Concluída 6/6, botão Ver próxima missão leva ao Plano | Bom. Resolve o medo de missão travada | 8.5 |
| Plano | Timeline Sua jornada, 9 missões, estados A desbloquear como preview | Muito bom. Os 4 estados (andamento/concluída/atrasada/próxima bloqueada) ficam claros | 9 |
| Trilha | 4 variantes + missões do edital com critério claro | Bom | 8 |
| Registrar | Formulário + Registros recentes com Ver mais (8 registros) | Bom. Paginação já existe, não é scroll infinito | 8.5 |
| Desempenho | Rico (matéria, melhor/reforçar, simulado projetado) | Ver DES-1: lógica de nível por matéria inconsistente | 6.5 |
| Simulados | Form CN Dia1/Dia2 por matéria, limpo no desktop | Bom. Checar overflow no mobile (não verificado) | 7.5 |
| Conquistas/Patentes | Cabo/Sargento, Ver carreira completa (13 patentes), categorias com Ver mais | Muito bom. Crescimento de lista resolvido; estética militar madura | 9 |
| Histórico | Cards por semana (Agora/Concluída/Parcial) | Bom. Mostra bem o estado atrasada | 8 |

## Achados

| ID | Achado | Conta | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|-------|---------|------|----------|---------|------|
| DES-1 | Estimativa de nível por matéria inconsistente: Matemática 75% com 150 questões = Avançado, mas Português 76% com 25 questões = Intermediário; Química 54% = Intermediário. Não pondera volume/acerto de forma coerente | aluno | Médio. Mina credibilidade do dado mais inteligente da tela; comprador percebe | P2 | Rebaixar para Estimativa inicial quando volume baixo; estrutura em blocos (1: dado sólido; 2: estimativa; 3: insuficiente); regra clara de volume x acerto | Médio | C1 |
| ALU-1 | Mobile não verificado visualmente nesta sessão | aluno | Não verificado | P2 | Validar iPhone 14 Plus/430px: Simulados (overflow de cards) e Desempenho | Baixo | C1 |

## Veredito área do aluno

Funciona bem e passa confiança. As preocupações originais (missão travada, scroll infinito, listas crescendo, estética) já estão resolvidas. O único ponto que destoa é a lógica de nível por matéria (DES-1). Nota geral: 8.0.
