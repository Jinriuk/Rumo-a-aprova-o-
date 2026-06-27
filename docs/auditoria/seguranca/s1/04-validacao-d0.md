# S1.4 — Validação operacional real do D0

## Método
Exercício de ponta a ponta do backoffice **contra o banco live**
(`bdjkgrzfzoamchdpobbl`), assumindo a identidade do super_admin real
(`internal_admins`, 1 ativo), tudo dentro de uma transação que **sempre
faz rollback** — nenhuma escola de teste ficou no banco, nenhum log
persistiu.

## Roteiro executado e resultado

| Passo | Resultado |
|---|---|
| `sou_super_admin()` (operador real) | `true` |
| `backoffice_dashboard()` responde | `escolas_total = 2` |
| `backoffice_criar_escola('ZZ Teste S1', …)` | `ok` (id gerado) |
| `backoffice_editar_escola(id, …, limite=80, observacao=…)` | `ok` |
| `backoffice_definir_status(id, 'suspensa')` | `ok` |
| `backoffice_definir_status(id, 'ativa')` | `ok` (reativação) |
| **`admin_logs` da escola de teste** | `criar-escola, editar-escola, suspender-escola, ativar-escola` |
| coordenação chama `backoffice_dashboard()` | `bloqueado: acesso negado: somente super_admin` |
| coordenação `sou_super_admin()` | `false` |

## Leitura
- O superoperador consegue **operar uma escola sem entrar no Supabase**:
  criar, editar dados básicos, suspender, reativar — exatamente o
  objetivo do D0.
- **Cada ação sensível gera trilha** em `admin_logs` (append-only), com
  `super_admin_id`, `acao`, `escola_id` e `detalhe`.
- **A reativação funciona** (suspensa → ativa), fechando o ciclo do
  S1.5: o operador é quem tira a escola da suspensão.
- **Quem não é super_admin não vê nada** do backoffice — barrado por
  porteiro no banco, não por tela.

## Estado atual do live
- `internal_admins`: 1 operador ativo.
- `admin_logs`: 0 (a validação foi toda revertida; nenhum log de teste
  ficou) — o contador volta a subir no primeiro uso real.
- escolas: 2 (`vitrine`, `beta`), ambas `implantacao`.

## Conclusão
D0 **validado operacionalmente** com RPCs reais e trilha de auditoria
real. Pronto para uso no piloto.
