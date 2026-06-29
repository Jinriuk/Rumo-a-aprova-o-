# 02 — Migrations e Paridade (SDB-AUDIT)

> Data: 2026-06-29 · Projeto: bdjkgrzfzoamchdpobbl · Read-only.

---

## 1. Estado da Paridade

| Item | Valor |
|------|-------|
| Migrations no repositório | 36 |
| Migrations no remoto (ledger) | 33 |
| Drift | 3 migrations NAO aplicadas remotamente |

---

## 2. Migrations no Repositório vs Remoto

Migrations 0001 a 0033: todas aplicadas remotamente.

DRIFT CONFIRMADO:
- 0034_maturidade_concursos: NAO aplicada no banco remoto
- 0035_virar_semana_por_escola: NAO aplicada no banco remoto
- 0036_lgpd_usuarios_do_aluno: NAO aplicada no banco remoto

Evidencias:
- Coluna concursos.maturidade nao existe no banco
- View vw_concurso_qualidade nao existe no banco
- Funcoes motor_virar_semana_escola e lgpd_usuarios_do_aluno nao existem no banco

---

## 3. Analise do Drift

### 0034 — maturidade_concursos (PED2)
- Adiciona coluna maturidade (text, default indisponivel) em concursos
- Cria view vw_concurso_qualidade (auditoria de maturidade do conteudo)
- Risco: MEDIO — queries com maturidade falharao se o front usar a coluna
- Aditiva e reversivel

### 0035 — virar_semana_por_escola (SEC3)
- Cria app.virar_semana(p_escola uuid) — variante escopada por escola
- Cria public.motor_virar_semana_escola(uuid) — porta para Edge Function
- Risco: MEDIO — virada global continua; apenas variante por escola falha
- Aditiva e reversivel

### 0036 — lgpd_usuarios_do_aluno (SEC3)
- Cria funcao para listar usuarios que seriam removidos em exclusao LGPD
- Garante atomicidade: Edge Function apaga Auth primeiro, banco depois
- Risco: ALTO — sem esta funcao, exclusao LGPD pode ficar em estado inconsistente
- Aditiva e reversivel

---

## 4. Perguntas da Auditoria

Existe drift? SIM — 3 migrations no repo nao aplicadas remotamente.
Existe migration local nao aplicada? SIM: 0034, 0035, 0036.
Existe migration remota sem arquivo local? NAO.
A ordem do ledger esta coerente? SIM — anomalia historica de numeracao reconciliada na DB1.
Risco de usar db push? SIM, elevado. Proibido pelo runbook.

## 5. Procedimento Seguro

1. Aplicar 0034, 0035 e 0036 via SQL Editor do dashboard em ordem
2. Confirmar paridade apos cada migration
3. Nunca usar supabase db push sem paridade == 0 divergencias

Esta auditoria NAO aplica as migrations. Apenas documenta o drift.
