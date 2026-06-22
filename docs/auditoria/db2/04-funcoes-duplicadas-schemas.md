# DB2-E — Funções duplicadas e schemas

> Objetivo: identificar funções duplicadas entre `public` e `app`
> (especialmente LGPD/admin/auth) e endurecer o que for óbvio. Fonte:
> inventário de `pg_proc` (DB1 `03-rpcs-funcoes-views.md`).

## 1. Pares / wrappers entre schemas

| `public` (exposto via RPC) | `app` (interno) | Natureza | search_path | grants `public` | Veredito |
|---|---|---|---|---|---|
| `public.lgpd_excluir(uuid)` (não secdef) | `app.lgpd_excluir(uuid)` (secdef) | wrapper invoker → secdef | `""` / `public,app` | postgres, service_role | **OK** (sem `authenticated`) |
| `public.lgpd_exportar(uuid)` (não secdef) | `app.lgpd_exportar(uuid)` (secdef) | idem | `""` / `public,app` | postgres, service_role | **OK** |
| `public.motor_gerar_meta(uuid)` (não secdef) | `app.gerar_meta(uuid,date)` (secdef) | wrapper → motor | `""` / `public,app` | postgres, service_role | **OK** |
| `public.motor_virar_semana()` (não secdef) | `app.virar_semana(date)` (secdef) | wrapper → motor | `""` / `public,app` | postgres, service_role | **OK** |

> Os wrappers em `public` existem porque o PostgREST só expõe `public`;
> são a porta de RPC para o servidor/edge. Estão corretos: `SECURITY
> INVOKER`, `search_path` vazio, **sem** EXECUTE para `authenticated`
> (só `postgres`/`service_role`). Não são duplicação acidental.

## 2. Funções `SECURITY DEFINER` expostas a `authenticated`

`sou_super_admin`, `resumo_escola`, `backoffice_*` (6). Já auditadas na
S1/DB1: gate interno (`eh_super_admin`/`tenant_operacional`), `search_path`
fixo. Os 8 avisos `authenticated_security_definer_function_executable` são
**by-design**. Revogar EXECUTE quebraria o backoffice (roda como o super
admin logado). **Mantidos.**

## 3. Checklist DB2-E

| Verificação | Resultado |
|---|---|
| Funções com mesmo propósito | só os wrappers acima (intencionais) |
| Funções antigas não chamadas | nenhuma órfã identificada |
| Wrappers | presentes e corretos (invoker, grants restritos) |
| Grants abertos indevidos | **nenhum** (nada sensível com `authenticated`/`anon` indevido) |
| Funções sem `search_path` | **nenhuma** (advisor `function_search_path_mutable` = 0) |
| `SECURITY DEFINER` | todas com `search_path` fixo + gate interno |
| Deveriam estar em `app` | já estão; `public` só tem o necessário p/ RPC |
| Precisam ficar em `public` (RPC) | sim — os wrappers e os `backoffice_*`/`resumo_escola`/`sou_super_admin` |

## 4. Correções aplicadas

**Nenhuma alteração de função foi necessária.** Tudo que a DB2-E permitia
corrigir (fixar `search_path`, revogar grants óbvios) **já estava feito**
desde a S1 (migrations 0006/0026) e confirmado na DB1. A única ação foi
**documental** (este relatório).

## 5. Encaminhamento DB3 (opcional, baixo risco)

Consolidação **cosmética** do par `lgpd_*` (manter só um caminho) — sem
ganho funcional, então **não** priorizado. Se feito, exige re-teste dos
edge functions `lgpd-titular`.
