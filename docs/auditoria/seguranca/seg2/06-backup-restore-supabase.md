# SEG2 / S2-G — Supabase Pro, backup e restore

**Fase:** SEG2 · **Data:** 2026-06-26
**Estado:** projeto `bdjkgrzfzoamchdpobbl`, **us-east-1**, plano **Free**.
**Referências existentes:** `docs/operacao/backup-e-plano-supabase.md`,
`backup-retencao-lgpd.md`, `monitoramento-backup.md`.

---

## 1. Estado atual (Free)

| Item | Estado |
|------|--------|
| Plano | **Free** |
| Backup automático gerenciado | **Indisponível** no Free |
| PITR (point-in-time recovery) | Indisponível no Free (add-on do Pro) |
| Restore pelo painel | Indisponível no Free |
| Decisão do dono | Pro **em julho**, após a 1ª escola |

---

## 2. Cenário 1 — sem upgrade agora (vigente até julho)

**Risco:** sem backup gerenciado, perda de dados depende de export manual. Aceitável
enquanto a base é **demo** (sem dado real de menor). **Não** aceitável para dado real.

**Backup manual mínimo (rodar antes de qualquer migration sensível e periodicamente):**
```bash
pg_dump "$SUPABASE_DB_URL" -Fc -f rumo_$(date +%F).dump   # destino PRIVADO, fora do Supabase
```
- **Frequência:** diária enquanto houver atividade; sempre antes de migration que apaga/transforma dado.
- **Responsável:** dono (até automatizar).
- **Retenção:** 7–30 dumps.
- **Limitação:** não é PITR; janela de perda = desde o último dump.

**Restore (teste obrigatório, mesmo no cenário Free):**
```bash
pg_restore --clean --no-owner -d "$DESTINO_TESTE_DB_URL" rumo_AAAA-MM-DD.dump
```

---

## 3. Cenário 2 — Supabase Pro (julho)

- [ ] Assinar **Pro** (liga backup diário gerenciado, retenção ~7 dias; PITR como add-on).
- [ ] Confirmar retenção desejada (e PITR se for operar dado real).
- [ ] **Testar restore** num **projeto separado** (não em produção).
- [ ] Documentar quem pode restaurar e o tempo estimado de recuperação (RTO).

---

## 4. Restore — não basta "ter backup"

Checklist de validação do restore (rodar pelo menos 1×):
- [ ] Backup/dump gerado com sucesso.
- [ ] Restore aplicado em **projeto separado ou banco local** (nunca sobre produção).
- [ ] Conferir **contagem de tabelas** e migrations aplicadas (`scripts/checar-migrations.mjs`).
- [ ] Conferir **RLS ativa** (rodar `tests/isolamento.test.mjs` contra o restore).
- [ ] Conferir **usuários/dados críticos** presentes (escolas, alunos, vínculos, logs).
- [ ] Registrar **RTO** (tempo do restore) e **RPO** (janela de perda aceita).

---

## 5. Critério de aceite (SEG2)

> ✅ **Backup/restore definido.** Cenário Free documentado (dump manual + teste de restore);
> cenário Pro com checklist para julho. **Restore deve ser efetivamente testado** antes da
> 1ª escola real (pendência **bloqueante para dado real**, não para demo).
