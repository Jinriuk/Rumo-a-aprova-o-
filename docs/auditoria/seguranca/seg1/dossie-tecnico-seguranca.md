# Dossiê Técnico de Segurança — Rumo à Aprovação

**Documento apresentável para escola/cliente.**
**Fase:** SEG1 — Segurança Operacional Imediata · **Data:** 2026-06-25
**Versão do sistema:** pós-HF3 (main `06dfdc2`)

> **Aviso de honestidade:** este dossiê reúne **evidências técnicas externas e internas
> de segurança**. **Não** é uma certificação formal de segurança e não deve ser
> apresentado como tal.

---

## 1. Resumo executivo

O **Rumo à Aprovação** é um SaaS educacional **multi-tenant** (white-label) para
escolas/cursinhos. A premissa de segurança é simples e verificável: **o isolamento entre
escolas é regra de banco (RLS no Postgres), não disciplina de tela.** Nesta auditoria
(SEG1) confirmamos que:

- **Nenhum segredo privado** está exposto no código; a `service_role` vive **só no
  servidor** (Edge Functions) — provado por varredura e por teste de regressão no CI.
- O **isolamento por escola** está íntegro: **RLS ativa em 100% das tabelas** e **341
  testes automatizados verdes**, incluindo cenários de tentativa de vazamento cross-tenant.
- As **rotas/ações administrativas** são protegidas **no banco** (não só na tela).
- Foram **aplicados headers de segurança** (incl. CSP) na entrega web (Vercel).
- **Ações sensíveis geram log** de auditoria.

**Conclusão:** o sistema está **minimamente seguro para um piloto controlado** com
usuários reais, observadas as pendências manuais (seção 14) — nenhuma delas é P0/P1.

---

## 2. Arquitetura resumida

```
Navegador (SPA React+Vite, Vercel)
  │  só chaves PÚBLICAS (URL + anon key) + JWT do usuário logado
  ▼
Supabase
  ├── Postgres + RLS  ← a autorização real (isolamento por escola)
  ├── Auth (GoTrue)   ← identidade; papel e escola_id nos claims do JWT
  └── Edge Functions  ← privilégio elevado (service_role) confinado ao servidor
```
- O front (`app/`) tem **um único ponto** que fala com o Supabase (`shared/data`), e
  **nenhuma lógica de autorização** — ela é do banco.
- Operações privilegiadas (criar conta, provisionar acesso, virada de semana, LGPD)
  passam por **Edge Functions** que validam token, papel e escola **antes** de agir.

---

## 3. Papéis e permissões

| Papel | Entra por | Vê/faz |
|-------|-----------|--------|
| Aluno | código `XXXX-XXXX-XXXX` | só os próprios dados de estudo |
| Responsável | código | só o(s) aluno(s) **vinculado(s)** (e só leitura) |
| Coordenação | e-mail + senha | só a **própria escola** (gestão pedagógica) |
| Super admin | e-mail + senha | **backoffice** cross-tenant (criar/suspender escola, criar coordenação) |

A matriz é aplicada **duas vezes**: o front escolhe a tela pelo papel do token; o **banco
impõe** a mesma matriz por RLS — quem decide o dado é o banco.

---

## 4. Isolamento por escola

- Toda tabela de dado de escola carrega `escola_id` e tem **política RLS** que confina
  leitura/escrita ao tenant do JWT.
- **Verificado ao vivo:** RLS ativa em **45/45** tabelas do schema `public`.
- **Provado por teste:** a escola A não lê nem escreve **nada** da escola B — nem por
  busca sem filtro, nem forjando `escola_id`, nem por papel (aluno/responsável/coordenação).

## 5. Uso de RLS

- Funções auxiliares `app.tenant_id()`, `app.papel()`, `app.usuario_id()` leem os claims
  do JWT — a **mesma** fonte que o front usa para rotear.
- `search_path` endurecido em funções (`0006`, `0026`) para evitar shadowing.
- Funções `SECURITY DEFINER` de backoffice têm **porteiro interno** `eh_super_admin()`
  (verificado em todas) — o aviso genérico do linter sobre elas é **esperado e aceito**.

## 6. Edge Functions sensíveis

6 funções, todas deployadas e **ACTIVE**, com auth por **token real** + checagem de papel
+ validação de `escola_id`, e `service_role` só no servidor:
`provisionar-aluno`, `backoffice-coordenador`, `revogar-responsavel`, `gerar-meta`,
`virar-semana` (gate por service_role), `lgpd-titular`. (Detalhe em `05-…`.)

## 7. Proteção de secrets

- Front: **só** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (públicas por design).
- `service_role`: **nunca** no front/repo; só em Edge Functions e na máquina do operador,
  sempre lida do ambiente (sem hardcode). Teste de CI **falha** se aparecer em `app/src/`.

## 8. Autenticação

- Supabase Auth (GoTrue). Aluno/responsável **não criam conta** (são menores) — o código
  gerado é a credencial. Coordenação define senha por link de recuperação.
- **Pendência:** ativar **Leaked Password Protection** (manual, baixo esforço).

## 9. Logs

Três tabelas de auditoria com RLS — `admin_logs` (super_admin), `logs_coordenacao`
(coordenação), `logs_acesso` (acessos/provisionamento/LGPD) — cobrindo criar/editar/
suspender/reativar escola, criar coordenação, provisionar aluno, revogar/revincular
responsável, exportar/excluir LGPD. Autor não-forjável.

## 10. Backups e restore (escopo SEG2)

- O Supabase mantém backups gerenciados conforme o plano do projeto. **Teste de restore
  completo** e política de retenção definitiva **ficam para SEG2** (fora do escopo SEG1).
- Recomendação: validar, em SEG2, o procedimento de restore num projeto separado.

## 11. Headers de segurança

Aplicados no `vercel.json` (todas as rotas): `Content-Security-Policy` (ajustada ao app —
Supabase + Google Fonts), `Strict-Transport-Security` (preload), `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. (Detalhe em `08-…`.)

## 12. Scanners externos

Convertidos em **checklist manual** do dono (egresso de rede bloqueado nesta sessão);
cada ferramenta tem URL e resultado esperado registrados em `scanners-externos/`.
Substituídos, onde possível, por **evidência direta** mais forte (testes, advisors,
revisão de código). São **evidências técnicas externas**, não certificação.

## 13. Riscos corrigidos nesta fase

- **Ausência de headers de segurança** → **corrigido** (`vercel.json`).
- Auditoria e documentação consolidadas (este dossiê + 11 documentos SEG1).

## 14. Riscos pendentes (nenhum P0/P1)

| ID | Sev | Pendência | Dono da ação |
|----|-----|-----------|--------------|
| D-1 | P2 / Manual | Ativar Leaked Password Protection | Dono (painel Supabase) |
| A-1/B-1 | P2 / Manual | Credenciais de **demo** públicas — usar projeto separado p/ piloto ou rotacionar | Dono |
| E-1 | P2 / SEG2 | Estreitar CORS curinga `*` para allowlist | SEG2 |
| J-1 | P2 / Manual | Branch protection na `main` | Dono (GitHub) |
| H-2 | Manual | Confirmar nota SecurityHeaders + smoke test de CSP pós-deploy | Dono |
| — | SEG2 | Backups/restore, staging, domínio próprio, SMTP, região sa-east-1 | SEG2 |

## 15. Recomendações antes do piloto real

1. **Ativar Leaked Password Protection** (5 min, painel).
2. **Aplicar branch protection** na `main` exigindo o check `build-e-unitarios`.
3. **Para alunos reais:** usar um **projeto Supabase separado** do demo público (ou
   rotacionar as credenciais de demo) — não misturar dados de menores reais no projeto
   cujas senhas de vitrine são públicas.
4. **Pós-deploy:** rodar SecurityHeaders.com/Observatory e o smoke test de CSP.
5. Planejar para **SEG2**: backups/restore testados, staging isolado, domínio próprio,
   estreitamento de CORS, e (LGPD) avaliar **migração para `sa-east-1`**.

---

*Documentos de apoio: `01`…`11` e `scanners-externos/` nesta mesma pasta;
relatório de aprovação em `relatorio-seg1-seguranca-operacional-imediata.md`.*
