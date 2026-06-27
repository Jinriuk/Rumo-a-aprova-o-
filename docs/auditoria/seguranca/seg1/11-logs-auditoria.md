# SEG1-K — Logs e Auditoria

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25
**Projeto:** `bdjkgrzfzoamchdpobbl`

---

## 1. Tabelas de log

| Tabela | Migration | Escopo | RLS | Linhas (ao vivo) |
|--------|-----------|--------|-----|------------------|
| `admin_logs` | `0019_backoffice.sql` | ações do **super_admin** (backoffice) | sim (`eh_super_admin`) | 11 |
| `logs_coordenacao` | `0022_logs_coordenacao.sql` | ações da **coordenação** | sim (por escola) | 116 |
| `logs_acesso` | `0001_fundacao.sql` | acessos/leituras e provisionamento | sim (por escola) | 988 |

---

## 2. Cobertura por ação sensível

Ações distintas **observadas ao vivo** (read-only, `array_agg(distinct acao)`):

| Ação sensível | Onde é registrada | Tabela | Confirmado ao vivo? |
|---------------|-------------------|--------|---------------------|
| Criar escola | `backoffice_criar_escola` / Edge | `admin_logs` (`criar-escola`) | ✅ |
| Editar escola | `backoffice_editar_escola` | `admin_logs` (`editar-escola`) | ✅ |
| Suspender escola | `backoffice_definir_status` | `admin_logs` (`suspender-escola`) | ✅ |
| Reativar escola | `backoffice_definir_status` | `admin_logs` (`ativar-escola`) | ✅ |
| Criar/vincular coordenador | `backoffice-coordenador` (Edge) | `admin_logs` (`vincular-coordenador`) | ✅ |
| Reenviar acesso coordenador | `backoffice-coordenador` (Edge) | `admin_logs` (`reenviar-acesso`, `reenviar-acesso-coordenador`) | ✅ |
| Provisionar aluno | `provisionar-aluno` (Edge) | `logs_acesso` (`provisionou-aluno`) | ⚠️ mecanismo no código; não exercido na base demo |
| Provisionar responsável | `provisionar-aluno` (Edge) | `logs_acesso` (`provisionou-responsavel`) | ⚠️ idem |
| Revogar responsável | `revogar-responsavel` (Edge) | `logs_coordenacao` (`revogou-responsavel`) | ✅ |
| Revincular responsável | `provisionar-aluno` / `vincular-responsavel` | `logs_coordenacao` (`revinculou-responsavel`) | ✅ |
| Atualizar marca (white-label) | data layer | `logs_coordenacao` (`atualizou-marca`) | ✅ |
| Exportar LGPD | `lgpd-titular` (Edge) | `logs_acesso` (`exportacao-lgpd`) | ⚠️ mecanismo no código; não exercido na base demo |
| Excluir LGPD | `lgpd-titular` (Edge) | `logs_acesso` (`exclusao-lgpd`) | ⚠️ idem; **log gravado ANTES** da exclusão (linha sobrevive sem FK) |

Legenda ⚠️: o caminho de log **existe no código** e foi revisado; apenas ainda **não foi
exercitado** na base de demonstração (por isso não aparece em `distinct acao` ao vivo).
Não é uma lacuna de implementação.

---

## 3. Detalhes de integridade

- **`admin_logs`**: `insert` permitido só a quem é `eh_super_admin()` **e** com
  `super_admin_id = app.usuario_id()` (não dá para forjar autor). `select` só super_admin.
- **LGPD exclusão**: o log é inserido **antes** do `lgpd_excluir` justamente para
  sobreviver à remoção do aluno (sem FK ao aluno) — rastro preservado.
- **Quem registra**: as Edge Functions registram com `service_role` (não dependem da RLS
  do chamador), garantindo que o log seja gravado mesmo em operação privilegiada.

---

## 4. Lacunas / recomendações

| ID | Sev | Item | Status |
|----|-----|------|--------|
| K-1 | OK | 3 tabelas de log existem, com RLS, e cobrem as ações sensíveis | Confirmado |
| K-2 | P3 / SEG2 | Sem retenção/rotação nem exportação centralizada de logs (suficiente para piloto) | SEG2 |
| K-3 | P3 | Provisionamento/LGPD não exercitados na base demo (cobrir em QA2) | QA2 |

**Veredito SEG1-K:** ações sensíveis **geram log** em tabelas dedicadas, com RLS e autor
não-forjável. **Critério "logs sensíveis verificados" — ATENDIDO. Nenhum P0/P1.**
