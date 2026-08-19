# PED2-R3 — fechamento de conteúdo da EsPCEx

**Data:** 2026-08-13 · **Branch:** `claude/ped2-r3-espcex-tagueamento`
· **Base:** `18b9f65` (`main`)

## Resultado

A EsPCEx passa para `completa` v3 com:

- programa vigente: 80 assuntos oficiais e 339 recortes pedagógicos;
- quatro cadernos oficiais de 2024–2025, 200 questões e gabaritos exatos;
- 69 recorrências medidas sobre dois anos;
- calendário próprio de 9 semanas, 109 atividades e datas oficiais;
- 24 missões, três em cada uma das oito áreas, e quatro planos;
- seleção de trilha pelo nicho do concurso, sem atribuição cruzada com o CN.

Não há enunciados integrais, PDFs ou dados de aluno no Git. Os JSONs guardam
somente catálogo, hashes, número, gabarito, referência curta e tags.

## Fontes e hashes

| Documento | SHA-256 | Uso |
|---|---|---|
| Edital-base 2022 (`EDITAL-ESPCEX.pdf`) | `299ff23a552808c6037e104e2e56ad2caa684b499baeffce212c2426b9e25617` | comparação histórica do programa |
| Edital vigente 2026 (DOU) | `261c48541cdb48b1cee66dba3a802056ea619ba75ddeca3dd587609ad47e4851` | programa e datas-alvo |
| 2024 Dia 1 Modelo A | `a7cbf044fc15acab8a51fe27ea391d21baf7bfdd53429892a05430f47f515bcd` | 44 tags |
| Gabarito 2024 Dia 1 | `bc912307688e8635dc95e3519e08576090f9ddf88c24d95ac9e945eaaf6ac36b` | 44 respostas |
| 2024 Dia 2 Modelo D | `b7f7cf3103d021ca25d029dc95066660fa5dd2e72eb6e74a9278699d21e151a1` | 56 tags |
| Gabarito 2024 Dia 2 | `2ca53c9451bc9b0312a0554c70a4b725e040293d99eb3c7d26e189ce1da0827f` | 56 respostas |
| 2025 Dia 1 Modelo A | `e25ab87151a2416d42781373fc17442fa2ce692dcea1fd9b18310f884f204474` | 44 tags |
| Gabarito 2025 Dia 1 | `06fb7be899355bf69d29ec2170e4998c24e3ecf27c277db27037a47a673c914d` | 44 respostas; Q2 anulada |
| 2025 Dia 2 Modelo D | `d2a6c6c3224d7c34aab3f5703f53ea9472200114a22fad7e7b4840836696b232` | 56 tags |
| Gabarito 2025 Dia 2 | `a0ba56dd6ea4194b9dc62a5724c0fd0a9a584adde00350e6cc78fd18727132e2` | 56 respostas |

O edital vigente é o **Edital nº 2 S Conc Adms, de 22 de abril de 2026**, CA
EsPCEx 2026/27, publicado no DOU em 23/04/2026.

## Programa 2022 × edital-alvo 2026

A estrutura principal continua com 80 assuntos. Foram incorporadas as mudanças
substantivas encontradas no Anexo C vigente:

1. pensamento e ideologia passa a abranger os séculos XIX e XX;
2. o bloco da Primeira Guerra explicita República da Espada e República Velha;
3. República Brasileira na Guerra Fria vai de 1945 a 1991;
4. conflitos do fim do século XX recebem o intervalo 1980–2014;
5. entram crises/recessão do século XXI, neoliberalismo, crise socialista,
   movimentos nacionalistas e globalização atual;
6. Inglês ganha `word formation`.

As chaves legadas necessárias à compatibilidade foram mantidas, com o título
literal vigente em `rotulo_oficial` e na observação do banco.

## Calendário e missões

O calendário cobre 13/07–13/09/2026. As sete primeiras semanas fecham os 80
assuntos; a oitava simula os dois dias; a nona reduz carga e termina nas provas
de 12 e 13/09. Prioridades `F/P/X` usam incidência medida de 2024–2025, sem
promover recorrência estimada.

O conjunto de missões passa de 2 para 24. Há três missões para Português,
Redação, Física, Química, Matemática, Geografia, História e Inglês. As duas IDs
preexistentes são atualizadas, não duplicadas.

## Implementação reproduzível

- catálogo/tags: `supabase/seed/espcex-ped2-r3-v1.json` e
  `supabase/seed/espcex-2024-tags-v1.json`;
- gerador/artefato: `scripts/gerar-seed-espcex-ped2-r3.mjs` → seed 19;
- calendário/missões: `supabase/seed/trilha-espcex-v1.json` e
  `scripts/gerar-seed-trilha-espcex.mjs` → seed 20;
- porteiro: `scripts/validar-conteudo.mjs`, com paridade byte a byte;
- banco: testes `espcex-ped2-r3-db.test.mjs` e `trilha-espcex-db.test.mjs`.

Comandos que reproduzem os totais publicados:

```bash
node --input-type=module -e "import {carregarFonte} from './scripts/gerar-seed-espcex-ped2-r3.mjs'; const d=carregarFonte(); console.log({assuntos:d.catalogo.length,subassuntos:d.catalogo.flatMap(a=>a.subassuntos).length,provas:d.provas.length,questoes:d.provas.flatMap(p=>p.questoes).length,recorrencias:new Set(d.provas.flatMap(p=>p.questoes.map(q=>q.materia+'|'+q.assunto))).size})"
# { assuntos: 80, subassuntos: 339, provas: 4, questoes: 200, recorrencias: 69 }

node --input-type=module -e "import {carregarFontes,montarTarefas} from './scripts/gerar-seed-trilha-espcex.mjs'; const {trilha,conteudo}=carregarFontes(); console.log({semanas:trilha.semanas.length,atividades:montarTarefas(trilha,conteudo).length,missoes:trilha.missoes.length,planos:trilha.planos.length})"
# { semanas: 9, atividades: 109, missoes: 24, planos: 4 }

sha256sum ../upload/*.pdf
```

## Gates

Localmente, o build Vite e os 282 testes sem banco passam. O ambiente de
trabalho não fornece `psql`, Docker ou Supabase CLI; portanto o gate de banco
autoritativo é o job `build-e-unitarios` do GitHub Actions: PostgreSQL 15
nativo, migrations + seeds duas vezes e suíte completa. O PR só pode ser
mesclado com esse job verde.
