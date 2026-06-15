# Checklist de go-live (Fase 17.7)

> Quando o sistema pode receber o **primeiro cliente real**. Marca o que
> já está pronto (✓), o que depende de você (⚠) e o que é decisão de
> infra (⛔ bloqueia dado real).

## Técnico
- [✓] Build de produção verde
- [✓] Unitários verdes (164/164) — regras, motor, RLS, RPCs, métricas
- [⚠] E2E verde — corrigido o bug de fundo (useRecurso); confirmar o
      run e **isolar o E2E** (Fase 17.2) para não sujar o demo
- [✓] RLS validada (`tests/isolamento.test.mjs`) + isolamento das RPCs
- [✓] Produção alinhada com migrations (`0001–0021`; `scripts/checar-migrations.mjs`)
- [✓] RPCs funcionando (painel agregado, backoffice)
- [⚠] Demo preservada — limpar o nome sujo da escola demo (`Matriz ⟦e2e⟧`)
- [✓] Backoffice funcionando (lista, criar escola, detalhe, checklist, atividade)

## Segurança
- [✓] Sem `service_role` no front (provisão via script de operador)
- [✓] Auth provisionado (sem signup aberto)
- [⚠] **Leaked password protection** — habilitar no painel
- [⛔] **Região sa-east-1** definida para dado real (hoje us-east-1/demo)
- [✓] Logs administrativos (`admin_logs`) + trilha LGPD (`logs_acesso`)
- [⚠] **Backup** automático configurado + export manual

## Produto
- [✓] Aluno, responsável e coordenação funcionais
- [✓] Trilhas, missões, simulados por concurso, ranking, XP/patentes
- [✓] White-label (marca por escola)
- [⚠] Escola demo apresentável (após limpar o nome)

## Operação
- [✓] Processo de implantação (criar escola no backoffice + scripts)
- [✓] Provisão de coordenação (`scripts/criar-coordenacao.mjs`) e de
      super_admin (`scripts/criar-super-admin.mjs`)
- [✓] Cadastro de alunos em lote (área da coordenação)
- [⚠] Modelo de planilha de alunos / import CSV no backoffice (opcional)
- [⚠] Tutorial básico + canal de suporte + responsável interno definido

## Critério final
Instalar uma escola fictícia do zero **pelo fluxo interno** (backoffice +
scripts), testar os três perfis e liberar acesso **sem tocar no banco**.
Isso já é possível hoje; o que **bloqueia cliente real** é a região
sa-east-1 (LGPD) e o backup — os itens ⛔/⚠ de Segurança.
