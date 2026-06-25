# SEG1-A — Repositório e Exposição Pública

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25
**Branch:** `claude/seg1-operational-security-etyj5t` (escopo SEG1 — segurança operacional imediata)
**Repositório:** `Jinriuk/Rumo-a-aprova-o-`

---

## 1. Estado atual

| Item | Estado | Evidência |
|------|--------|-----------|
| Visibilidade do repositório | **PÚBLICO** | GitHub API: `"private": false`, `"visibility": "public"` |
| Branch padrão | `main` | GitHub API `default_branch` |
| `service_role` no front (`app/src/`) | **AUSENTE** | `git grep service_role -- app/src/` → vazio |
| `.env` reais versionados | **NÃO** | só `.env.example` (modelo) e `app/.env.production` (chaves públicas) |
| Único JWT no repo | **anon key** (publicável) | `app/.env.production` — payload `"role":"anon"` |
| GitHub Secret Scanning | Ativo por padrão em repo público | confirmação no painel = **checklist manual** |

A decisão de manter o repositório público é **intencional e já documentada** em
`docs/operacao/github/repositorio-publico.md` (2026-06-24). A SEG1 reafirma essa
postura e acrescenta um alerta operacional sobre **credenciais de demo públicas**
(seção 4).

---

## 2. Varredura de padrões perigosos

Comando: `git grep -n -i "<padrão>"` sobre todos os arquivos versionados.

| Padrão | Ocorrências | Onde | Risco |
|--------|-------------|------|-------|
| `.env` / `.env.local` | só `.env.example` e `app/.env.production` | raiz / app | OK (só chaves públicas + modelo) |
| `service_role` / `SERVICE_ROLE` | edge functions, scripts, migrations, docs | server-side e documentação | OK — **nunca em `app/src/`** |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.example` (placeholder), scripts (`process.env`), edge functions (`Deno.env`) | server-side | OK — sempre lida do ambiente, nunca valor real |
| `JWT_SECRET` | — | — | ausente |
| `RESEND_API_KEY` | — | — | ausente |
| `SMTP_PASS` | — | — | ausente |
| `VITE_SUPABASE_SERVICE_ROLE` | — | — | ausente |
| `password` / `senha` | scripts de operador (`process.env.*`), seeds de demo | server-side / seed | ver seção 4 |
| `token` | leitura de `authorization` header nas edge functions | server-side | OK (uso legítimo) |
| `secret` / `private_key` | — | — | ausente |
| Tokens JWT (`eyJ…`) | **1 ocorrência** | `app/.env.production` (anon) | OK — anon é publicável |

**Decodificação do único JWT versionado** (`app/.env.production`):

```json
{ "iss": "supabase", "ref": "bdjkgrzfzoamchdpobbl", "role": "anon",
  "iat": 1781127463, "exp": 2096703463 }
```

→ `role: anon` — chave pública por design. A segurança é a RLS, não o segredo da
chave. **Nenhuma chave `service_role` está no repositório.**

---

## 3. Documentação e exemplos

- A documentação **não** contém `service_role` real nem senhas reais de produção.
  As menções a `service_role` em `docs/` e `README.md` são **instruções de operação**
  (ex.: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/…`), com placeholders.
- Não há screenshots versionados com dados pessoais reais (a base é demo/vitrine).
- `.gitignore` bloqueia `.env` e `.env.*` com exceção explícita para `.env.example`
  e `app/.env.production` (chaves públicas) — desenho correto.

---

## 4. Achados

### A-1 (P2) — Credenciais de DEMO em texto claro no repositório público

`scripts/seed-auth-usuarios.mjs` e seeds (`04`, `13`) contêm **senhas de contas de
demonstração** em texto claro, e o repositório é público:

| Conta | Papel | Onde |
|-------|-------|------|
| `coordenacao@vitrine.demo` | coordenação | `seed-auth-usuarios.mjs` |
| `coordenacao@beta.demo` | coordenação | `seed-auth-usuarios.mjs` |
| códigos de aluno/responsável de demo (`LUCASDEMO2026`, etc.) | aluno/resp | `seed-auth-usuarios.mjs` |

Essas contas **existem no projeto Supabase ativo** (`bdjkgrzfzoamchdpobbl`):
verificação read-only confirmou `3` coordenações `.demo` e `69` contas por código.
Como as senhas são públicas, **qualquer pessoa pode logar como coordenação da
escola de vitrine**. O raio de exposição é **limitado pela RLS à própria escola de
demo** (não vaza dado de outra escola), mas permite **escrever/alterar a vitrine**.

- **Risco:** baixo-médio. Não há dado de aluno **real** nessas escolas (são vitrine/demo).
- **Ação manual (dono), antes do piloto real:**
  1. Usar um **projeto Supabase separado** para o piloto com escola real — **não**
     misturar alunos reais no mesmo projeto cujas credenciais de demo são públicas; **ou**
  2. Rotacionar as senhas das contas de demo e parar de versioná-las; **ou**
  3. Aceitar formalmente que a vitrine é de acesso público (decisão do dono).

### A-2 (Manual) — Visibilidade pública e piloto com dados reais

Enquanto a base for **demo/vitrine**, público é aceitável (decisão já registrada).
**Antes de cadastrar alunos reais (menores) num projeto**, recomenda-se:

- **Tornar o repositório privado** *ou* garantir que o repositório público **nunca**
  contenha seeds/scripts com dados pessoais reais.
- A SEG1 **não altera a visibilidade automaticamente** — depende de autorização
  explícita do dono (regra 5.Regra da fase).

---

## 5. Ações feitas nesta fase

- [x] Varredura completa de padrões perigosos (tabela seção 2) — **sem secrets privados versionados**.
- [x] Confirmado: `service_role` **ausente** de `app/src/`.
- [x] Confirmado: único JWT no repo é a anon key (publicável).
- [x] Confirmada visibilidade pública via GitHub API.

## 6. Ações manuais pendentes (dono)

- [ ] **A-1:** decidir tratamento das credenciais de demo públicas (projeto separado / rotação / aceite formal).
- [ ] **A-2:** decidir visibilidade (privado vs. público) **antes** de inserir dados reais.
- [ ] Confirmar que **GitHub Secret Scanning** está ativo no painel do repositório (SEG1-J).

---

## 7. Veredito SEG1-A

**Sem secret privado exposto. `service_role` ausente do front e do repositório.**
A visibilidade pública é uma decisão consciente já documentada; o único ponto novo
é a recomendação operacional sobre **credenciais de demo públicas** e **separação de
projeto** antes do piloto real. **Nenhum P0.** A-1 é **P2**; A-2 é **Manual**.
