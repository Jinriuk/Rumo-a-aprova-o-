# Fase 16 — Camada visual da pedagogia

Integração visual do motor pedagógico (Fase 15): patentes, conquistas,
marcos, XP, trilhas e missões viram **experiência**. Esta fase **não cria
regra** — só desenha o que o motor já calcula (`jargao.js`, `metricas.js`).

## Princípios

- **Consome, não duplica.** A UI lê XP/patente/conquista do motor; nada
  persiste nem se falsifica (apagou o progresso, a conquista recua).
- **Coerência com o tema fixo** navy `#0A1622` + dourado `#CDA349`
  (Doc 6 §1.2). O white-label troca só a cor de acento.
- **Mobile-first**, sem estouro horizontal, legível a 390px.

## Base visual (tokens e componentes)

Tokens em `src/shared/ui/tema.js` (`BASE`): `bg/bg2/card/cardHi/line/ink/
sub/gold/green/red`. A cor de acento da escola entra clareada por
`garantirLegivel` (contraste mínimo no escuro).

Componentes reutilizáveis (`src/shared/ui/componentes.jsx`):

| Componente | Uso |
|---|---|
| `Card`, `SectionCard` | contêineres padrão |
| `StatCard`, `MiniStat`, `Stat` | indicadores |
| `InsightCard` | leitura interpretada (borda colorida) |
| `StatusBadge`, `Tag`, `Estrelas` | selos / prioridade |
| `EmptyState`, `Empty`, `Erro` | estados vazios / erro |
| `BarraXP` | **(16.1)** barra de XP/progresso (gradiente ouro→verde) |
| `SeloRaridade` + `RARIDADES` | **(16.1)** raridade de conquista |

Ícones SVG de traço único em `src/shared/ui/Icones.jsx` (sem emojis na
base; `currentColor` acompanha tema e estados).

## Sistema de patentes (`Insignia.jsx`)

Insígnia vetorial desenhada a partir da spec de cada patente
(`jargao.js → PATENTES[].insignia`). **Praças usam chevrons; oficiais
usam estrelas.** A moldura fica mais rica (`nivelVisual` 1→5) no topo.

| Nível | Patente | Faixa | Insígnia |
|---|---|---|---|
| 1 | Recruta | praça | base (sem chevron) |
| 2 | Soldado | praça | 1 chevron |
| 3 | Cabo | praça | 2 chevrons |
| 4 | 3º Sargento | praça | 3 chevrons |
| 5 | 2º Sargento | praça | 3 chevrons + 1 arco |
| 6 | 1º Sargento | praça | 3 chevrons + 2 arcos |
| 7 | Subtenente | praça | 3 chevrons + diamante (praça nobre) |
| 8 | 2º Tenente | oficial | 1 estrela |
| 9 | 1º Tenente | oficial | 2 estrelas |
| 10 | Capitão | oficial | 3 estrelas |
| 11 | Major | oficial | 3 estrelas + louros |
| 12 | Tenente-Coronel | oficial | 3 estrelas + louros + arco no topo |
| 13 | Coronel | oficial | 3 estrelas + louros + coroa (moldura dourada) |

Cada patente carrega `lema` (significado simbólico) exibido no perfil.
Versão `bloqueada` apaga as marcas e mostra cadeado. Props:
`<Insignia patente={p} tam={56} bloqueada={false} />`.

UX de patente (perfil): nome + insígnia + XP atual/próxima + barra de
progresso + lema + próxima patente motivadora. Implementado em
`Conquistas.jsx` (perfil completo) e `MetaHero.jsx → FaixaAspirante`
(faixa compacta no "Hoje").

## Conquistas, marcos e medalhas

Catálogo único e derivado em `Conquistas.jsx → catalogoConquistas()`,
por categoria (**Constância, Volume, Precisão, Missões, Simulados**), com
`nome` de campanha, `req`, `raridade` (comum→lendária) e progresso real.

- Tela completa: `Conquistas` (perfil + escada de patentes + grupos).
- Faixa no "Hoje": `ConquistasRecentes` (últimas desbloqueadas ou a mais
  próxima de sair) — tocável para abrir a tela completa.

## Onde a Fase 15 entra na UI (mapa)

| Dado do motor | Origem | Superfície |
|---|---|---|
| XP / patente | `jargao.js` | `FaixaAspirante`, `Conquistas`, `MenuPrincipal` |
| Conquistas | `catalogoConquistas` | `Conquistas`, `ConquistasRecentes` |
| Missão / trilha | `useTrilha`, metas | `MissaoAtual`, `MetaSemana`, aba `Plano` |
| Métricas | `metricas.js` | `RadarDesempenho`, `Insights`, `Progresso` |
| Simulados | metas/simulados | aba `Simulados` |

Coordenação reaproveita `VisaoEstudo` em modo leitura (recebe a mesma
camada visual). Responsável (`ResumoResponsavel`) é **deliberadamente
sem jargão de jogo** — linguagem para pais.

## Estado das subfases

- **16.1 Fundação visual** — concluída (insígnias, `BarraXP`,
  `SeloRaridade`, escada de patentes, doc).
- **16.2 Visão do aluno** — concluída (faixa de conquistas no "Hoje";
  patente/XP/missão/radar já integrados).
- **16.3 Patentes/conquistas/marcos** — concluída (tela `Conquistas`
  com perfil, escada e grupos por raridade).
- **16.4 Trilhas e missões** — concluída: aba `Plano` vira **jornada**
  (linha do tempo com nó por missão, estado Encerrada/Em andamento/A
  desbloquear, "onde estou" e barra da jornada). `VisaoEstudo → Plano`.
- **16.5 Níveis e leitura pedagógica** — concluída: `Niveis.jsx` consome
  a regra pura da Fase 15 (`niveisAluno.js`) e classifica cada matéria
  (Base/Intermediário/Avançado) a partir das métricas já calculadas, com
  nível geral e leitura "domina / em risco / foco". Sem inventar corte.
- **16.6 Coordenação / responsável** — coordenação reaproveita a camada
  (insígnia, níveis, jornada, conquistas em leitura); responsável mantém
  leitura simples e sem jargão de jogo por decisão de produto.
- **16.7 Polimento / QA** — marcas da insígnia centralizadas no escudo;
  ícones do trilho via o conjunto SVG (consistência); build verde,
  unitários (66 puros + banco) e E2E (42) preservados.

### Novos componentes da Fase 16
`Insignia` · `BarraXP` · `SeloRaridade` · `ConquistasRecentes` (faixa do
"Hoje") · `NiveisPorMateria` (Desempenho) · `MissaoJornada` (linha do
tempo do Plano).
