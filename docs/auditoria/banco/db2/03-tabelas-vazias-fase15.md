# DB2-D — Tabelas vazias da Fase 15

> Objetivo: decidir se as tabelas vazias da Fase 15 são **futuras**,
> **incompletas**, **esquecidas** ou **desnecessárias**.

## 1. Tabelas vazias em produção

| Tabela | Linhas | RLS | FKs | Referenciada no front | Seed |
|---|---|---|---|---|---|
| `aluno_xp_eventos` | 0 | ✅ | escola_id, aluno_id, exam_tag, concedido_por | sim (leitura) | 10_gamificacao |
| `aluno_niveis` | 0 | ✅ | escola_id, definido_por; trigger histórico | sim (leitura) | 08_niveis_dev |
| `aluno_nivel_historico` | 0 | ✅ | escola_id | indireta (via níveis) | — |
| `aluno_onboarding` | 0 | ✅ | escola_id | sim (leitura) | — |
| `missoes_escola` | 0 | ✅ | escola_id, missao_id, ajustado_por | sim (leitura) | — |

## 2. Análise

- **Referenciadas?** Sim — o front tem caminhos de **leitura** para
  `aluno_xp_eventos`, `aluno_niveis`, `aluno_onboarding`, `missoes_escola`.
  Não foram encontrados caminhos de **escrita** ativos (o XP efetivo é
  gravado em `aluno_eventos_progresso` pelo C0; os níveis/onboarding não
  têm produtor ativo identificado).
- **Seeds planejadas?** Há seeds históricos (08/10) que populam parte
  delas em ambiente de teste, mas em produção estão vazias.
- **Em types/queries?** Sim, no front (leitura).
- **RLS/FKs?** Todas com RLS e FKs íntegras (inclusive os índices
  `escola_id` aditivos da DB1).

## 3. Decisão (conservadora)

São **possível modelo futuro / incompletas**, não comprovadamente
desnecessárias. Como há referência de leitura no front e FKs, **não há
prova suficiente de morte** → **não remover na DB2**.

### Documentação obrigatória (por que ficam)
- **Por que existem:** parte do desenho de gamificação/níveis da Fase 15.
- **Quem vai usá-las:** o produto de níveis/onboarding/missões-por-escola,
  caso seja retomado; hoje o XP vive no C0.
- **Quando serão populadas:** quando (e se) o fluxo de níveis/onboarding/
  ativação de missões por escola for ligado no produto.
- **Risco de ficarem mortas:** médio — se o C0 cobrir definitivamente XP e
  níveis, viram legado morto. Mitigação: **marcadas no banco** (migration
  `0030`, `COMMENT ON ... [DB3]`) para revisão na DB3 com prova de
  ausência de escrita (varredura de front+edge+RPC).

## 4. Encaminhamento DB3

Antes de qualquer `drop` na DB3:
1. Provar (grep front + edge + RPC + triggers) que **não há escrita**.
2. Confirmar que o produto não pretende ligá-las.
3. Se confirmado morto: `drop` com backup válido + atualização de types.
4. Se demo/vitrine depender, seed idempotente de reconstrução antes.
