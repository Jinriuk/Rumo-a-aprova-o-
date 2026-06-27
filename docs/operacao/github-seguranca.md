# Segurança do GitHub / repositório (S1.9)

## Estado apurado (2026-06-21)
- Repo `Jinriuk/Rumo-a-aprova-o-` — **público**.
- `main` é o default branch.
- **Nenhum secret sensível versionado**: só a anon key (pública por
  design) em `app/.env.production`. `.gitignore` cobre `.env`/`.env.*`.
- **Nenhum `service_role` em `app/src`** (só grants em migrations).

## Ações recomendadas (decisão/execução do dono)

### 1. Tornar o repositório privado (P2, antes do piloto)
Settings → General → Danger Zone → **Change visibility → Private**.
Motivo: produto com PII não ganha em manter código/estrutura abertos. A
segurança continua sendo a RLS, não a obscuridade — mas reduzir
superfície é higiene.

### 2. Branch protection na `main`
Settings → Branches → Add rule para `main`:
- **Require status checks**: `build-e-unitarios` (o gate honesto da
  S1.1).
- Require PR before merging (+ 1 review, se houver time).

### 3. Secrets do CI (quando isolar a E2E — S1.2)
Settings → Secrets and variables → Actions:
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`

### 4. Higiene contínua
- Não commitar `service_role` nem `.env` reais (já protegido pelo
  `.gitignore`; manter).
- Se algum segredo vazar em commit, **rotacionar a chave** no Supabase
  (a anon/serviço) e reescrever história se necessário.

## O que NÃO foi alterado
A visibilidade do repositório **não foi mudada** — exige autorização do
dono. Este documento deixa a ação pronta e justificada.
