# RC1 — Erros de Console (por tela e severidade)

**Data:** 2026-06-27 · **Branch:** `claude/rc1-functional-sweep-foc0wb`

Captura via Playwright/Chromium (build 1194 pinado) dirigindo o **build de
produção** servido por `vite preview`. Onde o fluxo exige Supabase (não
alcançável no sandbox), o console foi avaliado por **auditoria de código** e
marcado **BLQ** (a validar no ambiente E2E isolado).

Severidade: **P0** quebra · **P1** erro real recorrente · **P2** ruído que falha
o gate de console · **P3** cosmético/esperado · **OK** limpo.

---

## Reproduzido em runtime

| Tela / fluxo | Mensagem no console | Sev. | Estado |
|--------------|---------------------|------|--------|
| Login (render) | *(nenhuma)* | OK | ✅ **Limpo** após BUG-RC1-002 |
| Login (antes da correção) | `Failed to load resource: ... 404 (Not Found)` (favicon) | P2 | ✅ Corrigido |
| Login → código inválido (offline) | `Error: login por código: Failed to fetch` (via `falha()`) + `mensagemAmigavel` re-loga | P3 | 📝 OBS-RC1-003 |
| Login → submit com Supabase fora | `net::ERR_TUNNEL_CONNECTION_FAILED` + `TypeError: Failed to fetch` | Infra | 📝 OBS-RC1-007 (ambiente) |

**Detalhe do caminho de erro de login (reproduzido):**

```
console: Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED
console: TypeError: Failed to fetch
console: Error: login por código: Failed to fetch
```

A UI, em paralelo, mostra a mensagem amigável correta ("Código não reconhecido"
/ "Sua conexão parece instável"). O erro de **rede** (`ERR_TUNNEL...`) é do
**sandbox**, não do app. A linha `Error: login por código: ...` é o
`console.error` de `falha()` — comportamento de observabilidade (OBS-RC1-003).

---

## Avaliado por código (BLQ — validar no E2E isolado)

| Tela / fluxo | Fonte potencial de erro no console | Sev. esperada | Nota |
|--------------|-----------------------------------|---------------|------|
| Aluno — todas as abas | `mensagemAmigavel` loga em falha de carga | P3 | Só em erro; caminho feliz não loga |
| Aluno — motor de progresso não migrado | `console.warn("motor de progresso ainda não migrado…")` | P3 | **Degradação proposital** (tabela ausente) — warn, não error |
| Aluno — `missoes_escola` ausente | `console.warn("missoes_escola: ... usando missões oficiais…")` | P3 | Degradação proposital |
| Coordenação — log de acesso LGPD falha | `console.error("log de acesso LGPD não registrado: …")` | P3 | Best-effort; não derruba a tela |
| Coordenação — log de coordenação falha | `console.error("log de coordenação não registrado: …")` | P3 | Best-effort |
| Superadmin — `admin_log` falha | `console.error("admin_log não registrado: …")` | P3 | Best-effort |
| Qualquer Edge Function com erro | `falha(fn, …)` → `console.error` | P3 | UI mostra mensagem amigável |
| `App` — perfil não carrega | `db.sair().catch(console.error)` | P3 | Só no caminho de erro |

> Padrão saudável observado: **warns** para degradação esperada (tabela de fase
> ausente) e **errors** para falhas reais, sempre com mensagem amigável na UI.
> O ponto a endereçar (OBS-RC1-003) é apenas **falha de auth esperada** logada
> como `error`.

---

## Ruído conhecido (filtro da E2E — `_apoio.js`)

`RUIDO_CONHECIDO` ignora: React DevTools, `ResizeObserver loop` (recharts em
viewport pequeno), `favicon`, `[vite]`.

⚠️ **Achado:** o filtro `favicon` é **inócuo** — a mensagem de 404 do Chromium
não contém a palavra "favicon" (o URL fica em `msg.location()`). Com o favicon
inline (BUG-RC1-002) o request deixou de existir, então o filtro deixou de ser
necessário para a tela de login. Mantê-lo é inofensivo.

---

## Conclusão de console

- **Login:** console **limpo** (verificado).
- **Demais telas:** sem erro previsto no caminho feliz; em falhas, `error`/`warn`
  com mensagem amigável na UI. Pendente confirmação em runtime no **E2E isolado**.
- **Nenhum erro P0/P1 de console** identificado. Os itens são P3 (esperados/
  best-effort) e um P2 já corrigido (favicon).
