# S1.9 — GitHub / repositório / secrets

## Apurado (live)
- Repo: `Jinriuk/Rumo-a-aprova-o-` — **público** (`visibility: public`).
- `default_branch`: `main`. Homepage Vercel:
  `rumo-a-aprova-o.vercel.app`.

## Varredura de secrets no repositório
- **Nenhum `service_role` em `app/src`.** Todas as ocorrências de
  `service_role` estão em `supabase/migrations/*.sql` (grants
  server-side) e comentários — correto.
- `.env` tratados pelo `.gitignore`: ignora `.env` e `.env.*`, exceto
  `.env.example` e `app/.env.production`.
- `app/.env.production` (versionado) contém **apenas** `VITE_SUPABASE_URL`
  + **anon key** — públicas por design (a segurança é a RLS). ✅
- Nenhuma chave de serviço, senha ou token sensível versionado.

## Avaliação
| Item | Estado | Ação |
|---|---|---|
| `service_role` fora do front | ✅ | — |
| `.gitignore` cobre env reais | ✅ | — |
| Anon key exposta | ✅ aceitável (pública por design) | — |
| Repositório público | ⚠ P2 | tornar privado antes do piloto |
| Secrets do CI (E2E) | ⚠ pendente | adicionar `E2E_SUPABASE_*` quando isolar (S1.2) |
| Branch protection | recomendação | exigir o check `build-e-unitarios` na `main` |

## Recomendações (decisão do dono — não executadas)
1. **Tornar o repositório privado** antes de onboardear escola real. A
   segurança não depende de obscuridade (é RLS), mas um produto com PII
   não ganha nada em ficar com o código-fonte e a estrutura de dados
   abertos. Não alterei a visibilidade sem autorização.
2. **Branch protection** na `main`: exigir o check
   `build-e-unitarios` (o gate honesto da S1.1) e revisão de PR.
3. Quando isolar a E2E (S1.2), adicionar `E2E_SUPABASE_URL` e
   `E2E_SUPABASE_ANON_KEY` em Settings → Secrets → Actions.

## Detalhamento operacional
`docs/operacao/github-seguranca.md` (novo, S1).

## Status
Sem secret exposto. Pendências são **P2** (privacidade do repo) e
configuração de CI — nenhum P0.
