# SEG2 / S2-K — Domínio e URLs finais

**Fase:** SEG2 · **Data:** 2026-06-26

---

## 1. Decisão do dono

- **Sem domínio próprio agora.** Compra do domínio + configuração base em **julho**.
- Piloto controlado inicial usa o **domínio Vercel atual**: `rumo-a-aprova-o.vercel.app`.

---

## 2. URLs atuais

| Camada | URL |
|--------|-----|
| Front (produção) | `https://rumo-a-aprova-o.vercel.app` |
| Recovery coordenação | `https://rumo-a-aprova-o.vercel.app/redefinir-senha` |
| Edge Functions | `https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/<fn>` |

## 3. URLs necessárias (com domínio próprio — julho)

| Item | Ação |
|------|------|
| Domínio web | ex.: `app.seudominio.com.br` ou `seudominio.com.br` |
| Apontar na Vercel | adicionar domínio no projeto → configurar DNS (CNAME/A) |
| HTTPS/HSTS | automático na Vercel; confirmar `preload` após estabilizar |
| `ALLOWED_ORIGINS` (Edge) | incluir o domínio novo (ver doc 03) |
| Site URL / Redirect URLs (Auth) | trocar para o domínio final (ver doc 09) |
| CSP `connect-src` | já cobre `*.supabase.co`; rever se o domínio servir outros hosts |

## 4. Checklist (julho)
- [ ] Comprar domínio e configurar DNS.
- [ ] Adicionar domínio na Vercel + validar certificado.
- [ ] Atualizar `ALLOWED_ORIGINS`, Site URL, Redirect URLs.
- [ ] Verificar HTTPS + HSTS + headers **no domínio final** (SecurityHeaders/SSL Labs).
- [ ] Rodar Internet.nl / Hardenize no domínio (docs scanners 06/07).

## 5. Critério de aceite (SEG2)
> ✅ **Definido.** Piloto inicial usa o domínio Vercel (HTTPS/HSTS ativos). Domínio próprio
> é **item de julho** com checklist completo. Não bloqueia piloto controlado pequeno.
