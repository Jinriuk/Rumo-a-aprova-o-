# Controle do pack de 19/09/2026

Arquivos de controle do pack comercial de 19/09, guardados aqui como referência para o v2. Não
fazem parte do material comercial. Vieram do Gabriel em 24/09/2026
(`pack-2026-09-19-controle.zip`, sha256 `6c161299b9220f25bee0ca89489b27f7507275b491a6e8b3e9653bb62fe74753`)
e estão sem alteração.

| Arquivo | sha256 |
|---|---|
| `CAPTURA.json` | `235fcdce55363ff80e8300aa2f37d7b598b5a78f29d3f77cddb2140f901116a1` |
| `MANIFESTO.md` | `bcadc8a775bcd0e2e3b3c8cd1dca636f273e86cf80493224ec2a383af950e99e` |
| `COERENCIA-HELENA.md` | `3bd18ba2bc230c894c9b9c9925709188e4afe8b0310af6bdfaadb85dd4f7f6fe` |
| `SHA256SUMS.txt` | `78af0d1eb3e4dddc421417a04d76f574945102e2b5a0af5f31e1b4e84b505bc8` |

O `CAPTURA.json` e o `MANIFESTO.md` daquele pack levam o identificador do projeto de
demonstração. Aqui isso é aceitável (o id já é público em `app/.env.production`); o P07 do v2
trata de ele não ir para o material comercial.

## O que estes arquivos explicam no v2

- **Tela 06 (Trilha)** saiu como NÃO INCLUÍDA em 19/09 porque o código capturado
  (`1ac7c64`) mostrava "Trilha temporariamente indisponível" para todo aluno. A causa (leitura de
  uma coluna inexistente em `carregarPlanoConcurso`) foi corrigida em `62abef2`, de 20/09, que não
  estava no código de 19/09. Por isso a 06 é refeita no v2.
- **Tela 21** em 19/09 era o estado antes de gerar credencial (P02: parecia cópia da 15). No v2 é
  o modal.
- **Estados 04, 24 e 25** foram preparados alterando a Helena de forma temporária (`trilha_id`,
  onboarding, `must_change_password`) e restaurados no fim. No v2, só a 24 é refeita, por último e
  com backup e restauração (ver `docs/pack/README.md`).
- **`COERENCIA-HELENA.md`** chamava de "Acerto geral: 78%" um número que é do ciclo, dentro de um
  bloco "semanal". No v2 ele é "acerto no ciclo" (D15), e a conferência inclui os agregados da
  turma (P05).
