# Fase B-min — Performance, paginação, concorrência, memoização, índices

## 7.1 Promessa da fase
A coordenação opera 300–500 alunos sem travar: paginação da lista, concorrência limitada no cadastro em lote, memoização do agregado de turmas, índices de tenant (`escola_id`) nas 4 tabelas mais consultadas, e agregação no banco (`resumo_escola()`).

## 7.2 Evidência no código
- `app/src/shared/lib/paginacao.js` (`paginar`), `app/src/shared/lib/concorrencia.js` (`comConcorrenciaLimitada`).
- `ListaAlunos.jsx` (paginação 50/página), `AreaEscola.jsx` (turmas memoizadas num `Map`), `CadastroAlunos.jsx` (geração de meta com teto 10).
- `supabase/migrations/0023_indices_escala_coordenacao.sql` (4 índices).
- `resumo_escola()` (migration 0016) — agregação `SECURITY DEFINER` com matriz RLS no `WHERE`.
- `supabase/seed-volume/massa_coordenacao.sql` (~480 alunos sintéticos).
- Testes: `paginacao`, `concorrencia`, `volume-coordenacao-db`.

## 7.3 Evidência no ambiente
- Os 4 índices da 0023 estão no remoto (confirmado: `0023_indices_escala_coordenacao` em `list_migrations`, e os índices aparecem nos advisors). `idx_registros_escola`, `idx_metas_escola_status`, `idx_simulados_escola`, `idx_consentimentos_escola`.
- `resumo_escola()` existe no remoto (aparece no advisor de SECURITY DEFINER).
- Advisor de performance: `idx_simulados_escola` (via `idx_simulados_exam`) e `idx_logs_coordenacao_escola` aparecem como **“unused index”** — esperado: o volume atual é baixo (60 alunos), o ganho dos índices só aparece com muitas escolas/alunos. Não é regressão; é a confirmação de que ainda não há carga.

## 7.4 O que foi realmente entregue
Paginação, concorrência limitada, memoização e os 4 índices de tenant — tudo presente no código e os índices aplicados no remoto. A peça pesada (agregação no banco) já existia (0016) e foi verificada.

## 7.5 O que não foi entregue
- **Carga real 300–500 alunos não medida em produção** — a massa de volume é de teste; o ambiente real tem 60 alunos. O ganho dos índices é teórico até haver volume.

## 7.6 Divergências
- Nenhuma divergência relatório × ambiente. A própria fase já marcava a validação sob volume real como pendência P2 — confirmada como ainda aberta.

## 7.7 Riscos
- **P2** — Performance sob 300–500 alunos + múltiplas escolas não validada em ambiente com volume (só em teste descartável).
- **P3** — Índices “unused” hoje (consequência do volume baixo, não defeito).
- **P3** — Filtro/busca da lista segue client-side (justificado nesta escala).

## 7.8 Decisão da fase
**Aprovada.** As 4 correções de volume estão no código, os índices no remoto, e a agregação no banco verificada. A ressalva é de **validação sob volume real**, não de entrega.
