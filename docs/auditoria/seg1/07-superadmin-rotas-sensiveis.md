# SEG1-G — Superadmin e Rotas Sensíveis

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25

---

## 1. Arquitetura de roteamento

O app é uma **SPA** (React+Vite) **sem rotas de URL por papel** — o roteamento é por
**papel vindo do token** (`app/src/App.jsx`), e **a autorização real é do banco** (RLS +
RPC com gate). Não existe `/admin` ou `/backoffice` como URL protegível separadamente:
o backoffice só **renderiza** se o banco confirmar `sou_super_admin()`.

> Princípio do projeto (Doc 6, §5): *o front só decide qual tela mostrar; quem decide o
> dado é o banco.* Esconder a tela não é a segurança — a segurança é o gate no banco.

### Fluxo de decisão (`App.jsx`)
1. Sem sessão → **Login** (público).
2. Fluxo de recuperação (`#type=recovery`) → tela de redefinir senha.
3. `superAdmin === true` (via RPC `sou_super_admin`) → **AreaAdmin** (backoffice).
4. Escola suspensa/cancelada → tela "Acesso suspenso" (a RLS já esconde o dado).
5. Senão → área do papel (`coordenacao`/`aluno`/`responsavel`).

---

## 2. O gate é no banco (não só na tela)

`sou_super_admin()` → `app.eh_super_admin()`:
```sql
select exists (select 1 from internal_admins ia
               where ia.auth_user_id = app.usuario_id() and ia.ativo)
```
Toda função de backoffice começa com:
```sql
if not app.eh_super_admin() then
  raise exception 'acesso negado: somente super_admin' using errcode = '42501';
end if;
```
Confirmado em **todas** as funções (migrations `0019`, `0021`, `0025`, `0032`):
`backoffice_escolas`, `backoffice_criar_escola`, `backoffice_detalhe_escola`,
`backoffice_dashboard`, `backoffice_editar_escola`, `backoffice_definir_status`,
`backoffice_registrar_reenvio`. E as Edge Functions sensíveis:
`backoffice-coordenador` (cria coordenação) exige `internal_admins.ativo`.

As tabelas `internal_admins` e `admin_logs` têm RLS `using (app.eh_super_admin())` — um
aluno/coordenação **não lê nem escreve** nelas.

---

## 3. Matriz de acesso esperada vs. mecanismo

| Ator | Backoffice (criar/suspender escola, criar coordenador, logs admin, LGPD) | Mecanismo que bloqueia |
|------|--------------------------------------------------------------------------|------------------------|
| **Aluno** | **bloqueado** | RPC `raise 'acesso negado'`; tela nunca renderiza (RPC retorna false) |
| **Responsável** | **bloqueado** | idem |
| **Coordenação** | **bloqueado** (não é super_admin) | idem; `backoffice-coordenador` → 403 |
| **Não autenticado** | **login** | `App.jsx`: `if (!sessao) return <Login/>` |
| **Super admin** | **permitido** | `eh_super_admin()` = true |

Observação sobre a exigência *"Coordenação: bloqueada para superadmin"*: a área de
**coordenação de escola** e a área de **backoffice** são telas distintas; o super_admin
opera **seu próprio** backoffice e não assume a sessão de coordenação de uma escola
(não tem linha em `usuarios`). LGPD de titular passa pela **coordenação controladora**
(`lgpd-titular` exige papel `coordenacao`), por desenho de responsabilidade LGPD.

---

## 4. Evidência de teste

- `tests/backoffice-db.test.mjs` — exercita os gates de backoffice com identidade real
  (super_admin vê; outros tomam "acesso negado").
- `tests/coordenacao-acesso-db.test.mjs` — coordenação confinada à própria escola.
- `tests/isolamento.test.mjs` — nenhum papel de escola lê `internal_admins`/`admin_logs`
  de outra escola nem cross-tenant.
- Suíte completa: **341/341 verdes**.

### Checklist manual (UI ao vivo) — não executável daqui (egresso bloqueado)
Logar na produção como aluno, responsável, coordenação e super admin e confirmar que
**só** o super admin vê o backoffice; tentar chamar uma RPC de backoffice com o JWT de
coordenação (via DevTools) e confirmar `acesso negado / 42501`.

---

## 5. Achados

| ID | Sev | Achado | Status |
|----|-----|--------|--------|
| G-1 | OK | Backoffice e ações sensíveis protegidos por gate no banco (`eh_super_admin`) em todas as RPCs/funções | Confirmado |
| G-2 | OK | Aluno/responsável/coordenação não acessam rotas administrativas | Confirmado (RLS+RPC+testes) |
| G-3 | Manual | Validação na UI ao vivo dos 5 atores | Checklist manual |

**Veredito SEG1-G:** rotas/ações administrativas **protegidas no banco**, não só na tela.
**Critério "rotas administrativas protegidas" — ATENDIDO. Nenhum P0/P1.**
