# S1.5 — Escola suspensa com bloqueio efetivo

## O bug que existia
A D0 (migration 0025) deu ao operador o botão de **suspender/cancelar**
escola, mas o `status` era **só um rótulo**: nenhuma política de RLS
olhava para ele. Uma escola `suspensa` continuava 100% operacional para
aluno, responsável e coordenação. Risco real num piloto (inadimplência,
incidente, pedido de pausa) — "suspender" não suspendia nada.

## A correção (migration 0027) — bloqueio AUTORITATIVO no banco
Defesa em profundidade, com o **banco no comando**:

1. **Porteiro `app.tenant_operacional()`** — `SECURITY DEFINER`, lê
   `escolas` sem disparar RLS (sem recursão). Verdadeiro quando a escola
   do JWT **não** está em `('suspensa','cancelada')`. Sem tenant
   (super_admin) → `true` (o operador nunca é barrado e reativa).

2. **Aluno e responsável — um ponto cada.** Toda a matriz de RLS desses
   papéis passa por `app.meu_aluno_id()` e `app.sou_responsavel_de()`.
   Ambas ganharam `and app.tenant_operacional()`:
   - `meu_aluno_id()` → `null` quando suspensa ⇒ **nenhuma** linha de
     aluno casa, em qualquer tabela (registros, metas, simulados,
     níveis, conquistas, XP…), leitura **e** escrita.
   - `sou_responsavel_de()` → `false` ⇒ responsável não enxerga nada.

3. **Coordenação.** As políticas da coordenação (estrutura, listas) e a
   RPC agregada `resumo_escola()` ganharam o porteiro. Painel suspenso →
   **vazio**; gestão suspensa → não lista alunos/turmas/logs; escrita de
   marca/turma/aluno bloqueada.

4. **Identidade permanece legível.** `escolas` (marca/status) e a própria
   linha em `usuarios` **continuam visíveis** — o front precisa delas
   para renderizar "Acesso suspenso" com a marca certa, em vez de uma
   tela vazia confusa.

## Camada de front (UX, não autoritativa)
- `meuPerfil()` lê `status`; se `suspensa`/`cancelada`, lança erro
  tipado `ESCOLA_SUSPENSA`.
- `useSessao` separa esse estado de "erro de carregar".
- `App.jsx` mostra **"Acesso temporariamente suspenso"** + botão Sair,
  sem expor dado.

## Provas (ao vivo, rollback — e na suíte de testes)
Ao vivo, suspendendo a escola dentro da transação:

| Medida | ATIVA | SUSPENSA |
|---|---|---|
| `meu_aluno_id()` do aluno | resolve | **null** |
| aluno lê próprios `registros` | 12 | **0** |
| `resumo_escola()` (coordenação) | 60 | **0** |
| coordenação vê `alunos` | 60 | **0** |
| própria linha em `usuarios` | 1 | **1** |
| `escolas` (marca/status) | 1 | **1** |

`tests/suspensao-db.test.mjs` (5 testes, Postgres real) cobre: ativa →
tudo aparece; suspensa → aluno sem identidade e sem dados; suspensa →
coordenação sem alunos/painel/turmas; cancelada → mesmo bloqueio;
identidade segue legível para a tela. **Suíte total: 222/222.**

## Super_admin reativa
`backoffice_definir_status(id,'ativa')` volta tudo — validado em
`04-validacao-d0.md` (suspender → reativar, com `admin_logs`).

## Residual conhecido (P3, não-P0)
O backstop de banco cobre **por completo** aluno e responsável (read+
write) e, na coordenação, o **painel** e as **escritas**. Uma leitura
direta de lista por uma coordenação suspensa (via API REST, fora do
front) ainda poderia retornar linhas em tabelas cuja política de
coordenação não foi reescrita nesta migration (ex.: níveis/onboarding na
ficha do aluno). Mitigações já vigentes: (a) o front barra toda a área
da coordenação suspensa; (b) é dado **da própria escola**, somente
leitura, sem mutação possível; (c) o painel agregado — principal
superfície — está bloqueado. Fechar 100% é estender o porteiro às
políticas de coordenação de 0011/0013 numa próxima iteração; está
registrado e **não é bloqueador de piloto**.
