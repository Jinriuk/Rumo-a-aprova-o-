# Backup e plano Supabase (S1.6)

> Complementa `backup-retencao-lgpd.md` e `monitoramento-backup.md` com
> os **fatos apurados na S1** e o passo a passo de decisão.

## Estado atual (apurado em 2026-06-21)
- Organização: plano **free**.
- Projeto `bdjkgrzfzoamchdpobbl`: `us-east-1`, Postgres 17,
  `ACTIVE_HEALTHY`.
- **Backup automático gerenciado: indisponível no free tier.**

## Caminhos (escolher um antes de dado real)

### Opção A — Upgrade para Pro (recomendado)
- Liga **backup diário** gerenciado (retenção 7 dias).
- PITR disponível como add-on (retenção configurável).
- Restauração testável pelo painel (Database → Backups).
- Custo recorrente — **decisão do dono**.

### Opção B — Free + dump manual
1. Rotina periódica (ex.: diária) com `pg_dump` do banco para um destino
   **privado** fora do Supabase:
   ```bash
   pg_dump "$SUPABASE_DB_URL" -Fc -f rumo_$(date +%F).dump
   ```
2. Guardar com retenção definida (ex.: 7–30 dumps).
3. **Testar restauração** ao menos uma vez:
   ```bash
   pg_restore --clean --no-owner -d "$DESTINO_TESTE_DB_URL" rumo_AAAA-MM-DD.dump
   ```
4. Documentar quem roda e onde os dumps moram.

## Regra que vale em qualquer opção
**Backup antes de toda migration sensível** (que apaga/transforma dado)
— já é processo em `deploy-checklist.md`.

## Checklist antes da 1ª escola real
- [ ] Plano/estratégia de backup escolhido (A ou B).
- [ ] Janela de retenção confirmada.
- [ ] **Restauração testada** ao menos uma vez.
- [ ] Monitoramento de falha de backup (ver `monitoramento-backup.md`).

> Decisão de custo — **não automatizada** por este trabalho (regra S1:
> não fazer upgrade de plano automaticamente).
