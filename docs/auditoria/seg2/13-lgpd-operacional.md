# SEG2 / S2-N — Checklist LGPD operacional

**Fase:** SEG2 · **Data:** 2026-06-26
**Referências:** `docs/operacao/lgpd-e-infra.md`, `backup-retencao-lgpd.md`,
`seg1/09-seguranca-lgpd.md`, `seg1/11-logs-auditoria.md`.

> O sistema trata dados de **alunos e responsáveis — muitos menores**. LGPD operacional
> mínima precisa estar pronta **antes de aluno real**.

---

## 1. Inventário de dados (minimização já é regra do schema)

| Dado | Onde | Observação |
|------|------|------------|
| Nome do aluno | `alunos.nome` | **só o nome** — sem CPF/RG/endereço |
| Nome do responsável | `consentimentos`, vínculo | só nome |
| Desempenho (estudo/metas/simulados/XP) | tabelas do motor | dado pedagógico |
| Consentimento | `consentimentos` | data + quem registrou |
| Trilha de acesso | `logs_acesso` | quem leu dado de aluno, quando, qual ação |
| Credenciais | Supabase Auth | aluno/resp por código; coordenação por e-mail |

**Sem** dado financeiro, biométrico ou documento. Isolamento por escola = **RLS**.

---

## 2. Direitos do titular — mecanismo existente

| Direito | Mecanismo | Status |
|---------|-----------|--------|
| **Exportação** | Edge `lgpd-titular` (`acao=exportar`) → dossiê JSON | ✅ implementado; log em `logs_acesso` |
| **Exclusão** | Edge `lgpd-titular` (`acao=excluir`) → remove dado + contas | ✅ implementado; **log gravado ANTES** (sobrevive à exclusão) |
| **Acesso/correção** | tela da coordenação (controladora) | ✅ |

> Pedidos passam pela **coordenação (controladora)** por desenho de responsabilidade LGPD.

---

## 3. Checklist operacional — antes do 1º aluno real

| Item | Status | Onde |
|------|--------|------|
| Termo de uso | ⏳ **pendente** (texto jurídico) | dono/jurídico |
| Política de privacidade | ⏳ **pendente** (texto jurídico) | dono/jurídico |
| Consentimento do **responsável** (menores) | ✅ fluxo + tabela `consentimentos` | registrar na implantação |
| Finalidade declarada | ⏳ documentar (uso pedagógico) | política de privacidade |
| Retenção | ⏳ **definir** prazo pós-saída da escola | `backup-retencao-lgpd.md` |
| Exportação | ✅ `lgpd-titular` | — |
| Exclusão | ✅ `lgpd-titular` | — |
| Logs (quem acessa dado) | ✅ `logs_acesso` (com RLS) | retenção/rotação = K-2 (SEG2/PR1) |
| Contato do titular (DPO/canal) | ⏳ **definir** e publicar | política de privacidade |
| **DPA / termo com a escola** (B2B) | ⏳ **pendente** | contrato com a escola |
| Região **sa-east-1** para dado real | ⏳ gate (julho) | `lgpd-e-infra.md` |

---

## 4. Pendências bloqueantes para aluno real
- Termo de uso + política de privacidade publicados.
- Consentimento de responsável coletado por aluno.
- Retenção e canal do titular definidos.
- DPA com a escola (B2B).
- Dado real em **sa-east-1** (não no projeto demo us-east-1).

## 5. Critério de aceite (SEG2)
> ✅ **LGPD operacional documentada.** Mecanismos técnicos (exportar/excluir/consentimento/
> logs) **prontos e testados em DB**. Itens jurídicos/operacionais (termos, retenção, DPA,
> região) listados como **bloqueantes para aluno real** com responsável e destino. Não
> bloqueia demo.
