# Gaps de material-fonte por concurso (PED2-R3)

**Data:** 2026-08-13 · **Fase:** PED2-R3

Conteúdo só entra no produto com fonte rastreável: edital, par prova oficial +
gabarito ou metodologia pedagógica explicitamente rotulada como inferência.

## 1. EsPCEx — completa v3

Não há bloqueio de conteúdo para uso no MVP. Esta rodada fechou:

- programa vigente do Anexo C: 80 assuntos e 339 recortes nas 8 áreas;
- comparação do edital-base de 2022 com o Edital nº 2 S Conc Adms, de
  22/04/2026;
- quatro cadernos e quatro gabaritos oficiais de 2024–2025: 200 tags e 69
  recorrências medidas;
- calendário próprio de 9 semanas, 13/07–13/09/2026, com 109 atividades;
- 24 missões, três por área, e quatro horizontes de plano;
- atribuição da trilha pelo nicho `espcex`, sem fallback para o CN.

As datas oficiais consideradas são 12/09/2026 (Português, Redação, Física e
Química) e 13/09/2026 (Matemática, Geografia, História e Inglês).

### Mudanças do programa 2022 → 2026 incorporadas

- História amplia o título de pensamento/ideologia para os séculos XIX e XX;
- inclui República da Espada no bloco da Primeira Guerra;
- amplia República Brasileira de 1945–1985 para 1945–1991;
- delimita conflitos do fim do século XX como 1980–2014;
- adiciona crises/recessão do século XXI, neoliberalismo, crise socialista,
  nacionalismos e globalização atual;
- Inglês adiciona `word formation`.

As chaves de assunto que já eram referenciadas pelo produto foram preservadas;
o rótulo literal vigente fica registrado em `rotulo_oficial`/observação.

### Próximas ampliações, sem bloquear a maturidade atual

- taguear 2023 e anos anteriores para aumentar a série histórica;
- recalibrar prioridades quando a base tiver mais edições;
- versionar uma trilha v2 quando houver nova janela oficial de prova.

## 2. EEAr — esqueleto

Tem estrutura oficial e uma missão. Falta o programa oficial do edital CFS
para catalogar Matemática, Física, Português e Inglês; depois, metodologia
semanal e provas anteriores.

## 3. ESA — esqueleto

Tem estrutura oficial e uma missão. Falta o programa oficial do edital ESA;
depois, metodologia semanal e provas anteriores.

## 4. EPCAR — esqueleto

Tem estrutura oficial e uma missão. Falta o programa oficial do edital CPCAR;
depois, metodologia semanal e provas anteriores.

## 5. Colégio Militar — indisponível

Só há o cadastro em `concursos`. Cada Colégio Militar tem edital próprio; é
necessário definir a unidade-alvo e fornecer seu edital antes de criar prova,
assuntos ou calendário. O cadastro de aluno permanece bloqueado para `cm`.

## 6. Pipeline reproduzível da EsPCEx

```bash
node scripts/gerar-seed-espcex-ped2-r3.mjs
node scripts/gerar-seed-trilha-espcex.mjs
node scripts/gerar-seed-maturidade.mjs
node scripts/validar-conteudo.mjs
node --test tests/espcex-ped2-r3.test.mjs tests/trilha-espcex.test.mjs tests/conteudo-maturidade.test.mjs
```

O gate final de banco é o job `build-e-unitarios` do CI: PostgreSQL 15 nativo,
migrations e seeds executados duas vezes, seguido pela suíte completa.
