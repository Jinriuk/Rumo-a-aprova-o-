# Documento 1 — Visão Geral

## O que é

Sistema de acompanhamento de estudos para alunos de cursinhos/colégios preparatórios para concursos militares, vendido **para a escola** (white-label: o sistema leva o nome da escola). Nasceu de um painel construído para um aluno individual (projeto “Rumo ao Naval”, preparação para o Colégio Naval) e está sendo transformado em produto B2B.

## Origem

O produto começou como uma ferramenta pessoal: um painel para acompanhar a preparação de um aluno (Lucas) para o Colégio Naval 2026. Já existe e está no ar. A ideia de vender para escolas partiu de uma terceira pessoa (a tia do idealizador), que também assumiria a parte comercial.

## O que já existe (feito)

- **App “Rumo ao Naval”** publicado (React + Vite, deploy no Vercel), com backend em banco.
- Funções: registro diário de questões/acertos/tempo, checklist semanal do plano, gráficos de progresso, simulados com nota projetada, modo Aluno vs Acompanhamento, virada automática de semana por data.
- Camada de dados isolada (objeto `db`) — ponto único de troca para backend.
- **Metodologia do nicho** (este é o ativo mais valioso, mais que o código):
  - Plano de estudos de 9 semanas para o Colégio Naval.
  - Análise das provas de 2021–2025 (com correções relevantes sobre o peso real de cada matéria).
  - Mapa de capítulos por livro ligado a prioridades (Fechar/Pincelar/Pular).
  - Estratégia de simulados e de estudo das pegadinhas da banca.

## O que NÃO existe ainda (a construir)

- Multiusuário real (multi-tenant): várias escolas, cada uma com seus alunos isolados.
- Área da escola (enxergar todos os alunos cadastrados).
- Cadastro de turma fácil para a escola.
- Autenticação e permissões reais (hoje o modo “Acompanhamento” só esconde botões).
- Painel de professor (em avaliação — pode ser fase 2).
- Nivelamento do aluno (base/intermediário/avançado) — fase 2.
- Reconhecimento do modelo da prova e indicação de livro por IA — fase 2.
- Estrutura jurídica/fiscal própria (CNPJ dedicado), contrato e cláusula de operador (LGPD).

## Modelo de negócio escolhido

**B2B — licença para a escola**, em vez de SaaS por aluno. Motivos: um decisor (a coordenação), um contrato, um pagamento; a escola distribui aos alunos (adoção não depende de convencer aluno por aluno); receita previsível. O SaaS por aluno foi descartado para o início por ter três decisores no caminho (aluno usa, pai paga, escola libera) e churn alto.

**Cobrança híbrida:** taxa de implantação (setup) + mensalidade de manutenção. Exemplo a validar: setup ~R$ 5–15 mil + manutenção ~R$ 600–2.000/mês, conforme o porte da escola. Números são hipótese — confirmar no estudo de mercado.

## Nicho (foco inicial)

Cursinhos e colégios preparatórios para concursos militares no **Rio de Janeiro**: Colégio Naval, EsPCEx, EEAr, Colégio Militar. **Fora do escopo inicial:** IME e ITA (base de estudo muito diferente e mais complexa). Expansão futura possível: ENEM e concursos públicos em geral.

## Pessoas

- **Idealizador (Gabriel):** construção do sistema, tráfego/estratégia.
- **Tia:** parte comercial (apresentações nas escolas). Ex-nutricionista, sem atuação atual, boa em vendas. Foi quem propôs vender.
- **Mário (contador):** já cuida do fiscal/tributário da Alinhatta; cuidará da parte fiscal deste negócio.
- **Vinicius:** sócio de palavra na Alinhatta (50/50), militar, não pode ter empresa no papel.

## Estado atual da validação

Nenhum real entrou ainda. Próximos passos de validação estão no Documento 2.