# Auditoria — Persona 5: UX / UI

> Auditoria por especialista sênior em UX/UI de SaaS educacional.
> Base: `app/src/shared/ui/` (componentes.jsx, tema.js, Cabecalho, MenuPrincipal, Insignia,
> Cronometro, Icones), `app/src/shared/branding/BrandingContext.jsx` e todas as telas.

---

## 1. Nota geral de maturidade da área: **75/100**

Há um design system real e coerente: paleta navy/dourado fixa, tipografia definida
(Fraunces/Archivo), componentes reutilizáveis (Card, StatCard, EmptyState, StatusBadge,
BarraXP, Tabs), tratamento padrão de loading/erro/vazio e responsividade pensada (barra
inferior no mobile, sidebar no desktop, safe-area iOS). Isso já coloca o produto acima do
"protótipo". Perde pontos em densidade de informação (muitos cards e abas), acessibilidade
incompleta (labels sem `htmlFor`), e na falta de padronização de alguns estados e microcopy.

## 2. O que está forte

- **Design system consistente** (`tema.js`, `componentes.jsx`, 286 linhas): paleta fixa com
  função de luminância para a cor de acento da escola (white-label leve sem quebrar contraste),
  componentes com variantes (`StatCard` com `tom` ok/alerta/risco/neutro), `EmptyState`
  padronizado, `StatusBadge` com bolinha+texto.
- **Estados bem tratados como padrão de código.** O trio `if (carregando) <Empty/>`,
  `if (erro) <Erro/>`, `if (!dados) <Empty/>` se repete nas telas — previsível e maduro.
- **Responsividade real, não só "encolhe".** `MenuPrincipal.jsx` muda de paradigma: barra
  inferior fixa (≤1023px) com "Mais" em sheet, vs. sidebar fixa (≥1024px). Breakpoints com
  zoom escalonado em telas grandes. Safe-area para notch/home indicator.
- **Gamificação visual madura, não infantil.** `Insignia.jsx` desenha patentes em SVG
  vetorial (chevrons/estrelas/coroa), com estado bloqueado/desbloqueado. O tom é militar/
  sóbrio, condizente com o público (concurso militar), não cartoon.
- **Cronômetro com UX cuidada** (persistência via timestamps, sobrevive a refresh).

## 3. O que está fraco

- **Densidade alta de cards e abas.** Aluno tem 7 abas; a "Hoje" empilha faixa de patente +
  missão + radar de 4 stats + meta + conquistas. Coordenação tem 6 abas. Há repetição de
  informação entre Painel/Ranking/Lista (o resumo por aluno aparece em três lugares).
- **Acessibilidade incompleta.** Labels de formulário sem `htmlFor`/`id` (confirmado pelos
  próprios E2E, que recorrem a seletores de irmão `label + input`). Falta foco visível
  consistente e verificação de contraste em estados de cor.
- **Microcopy de erro é técnica.** Erros aparecem como `e.message` cru numa faixa vermelha —
  bom para dev, ruim para usuário final. Falta linguagem orientada à ação.
- **Sem skeletons.** Loading é um texto "Carregando…"; em telas pesadas (coordenação) isso
  parece travamento, não progresso.

## 4. O que está confuso

- **Dois vocabulários no aluno** (jogo: patente/ofensiva/alvo × pedagógico: acerto%/questões).
  Coeso visualmente, mas exige aprendizado.
- **Repetição entre telas da coordenação** pode fazer o usuário não saber qual é a "fonte da
  verdade" do desempenho do aluno.
- **"Meta" como palavra** aparece com dois sentidos (meta da semana = atividades planejadas;
  e "nota/objetivo") sem desambiguação.

## 5. O que pode quebrar com uso real

- **Quebra de layout em densidade extrema** não testada: `Registrar` mostra 4 stats em
  `auto-fit`; em fontes grandes/telas estreitas pode quebrar.
- **Telas pesadas sem skeleton** dão sensação de erro ao usuário em conexões lentas.

## 6. Problemas críticos

- Nenhum problema crítico de UX que impeça uso. Os pontos são de polimento e acessibilidade,
  não de quebra funcional.

## 7. Problemas importantes

1. **Acessibilidade**: labels sem `htmlFor`, foco e contraste a revisar (risco de exclusão e
   de não conformidade com boas práticas / e potencialmente requisitos públicos).
2. **Densidade**: reduzir cards/abas redundantes, especialmente no aluno fraco e na coordenação.
3. **Microcopy de erro/vazio** não padronizada e técnica.
4. **Loading sem skeleton** em telas pesadas.

## 8. Melhorias desejáveis

- Skeletons nas telas de carga pesada.
- Biblioteca de microcopy (erros, vazios, confirmações) revisada por escrita.
- "Modo essencial" no aluno; mover Marca/LGPD para "Ajustes" na coordenação.
- Auditoria de acessibilidade (axe) e correção de labels/foco/contraste.

## 9. O que não precisa mexer

- Paleta, tipografia e o design system base (`tema.js`/`componentes.jsx`).
- Estratégia de navegação responsiva (barra inferior × sidebar).
- Insígnias SVG e o tom visual militar/sóbrio.
- Padrão de tratamento loading/erro/vazio (a estrutura está certa; só falta polir o conteúdo).

## 10. O que falta para considerar fechado (visão UX/UI)

1. Auditoria e correção de acessibilidade (labels, foco, contraste).
2. Redução de densidade/repetição (abas, cards duplicados).
3. Microcopy padronizada e amigável (erro/vazio/confirmação).
4. Skeletons e feedback de progresso.

## 11. Lista objetiva de recomendações por tela

| Tela | Recomendação |
|------|--------------|
| Aluno · Hoje | Reduzir blocos simultâneos; "próximo passo único" no topo; modo essencial |
| Aluno · Registrar | Garantir `htmlFor`/`id` nos campos; estado de envio (spinner no botão) |
| Responsável | Semáforo único no topo; estado vazio orientador |
| Coordenação · Painel | Skeleton na carga; consolidar resumo para não repetir em 3 abas |
| Coordenação · Listas | Paginação + foco visível; confirmação clara em ações destrutivas |
| Global | Microcopy de erro humana; auditoria axe; mover Marca/LGPD p/ "Ajustes" |

## 12. Veredito final

**Aprovado com ressalvas.** O produto tem maturidade visual de SaaS — design system coerente,
responsividade real e gamificação madura. Não parece amador. Para chegar a "premium e
fechado" faltam acessibilidade corrigida, densidade reduzida e microcopy/feedback polidos. Com
esses ajustes, a área vai para a faixa de 88.
