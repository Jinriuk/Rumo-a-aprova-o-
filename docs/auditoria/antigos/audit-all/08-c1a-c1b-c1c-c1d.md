# C1A · C1B · Patch C1B · C1C · C1D — Credibilidade, UX, polimento e 30 pontos

## C1A — Credibilidade da demo

**Promessa:** corrigir 7 bloqueadores (ranking artificial, ficha com matérias idênticas, acerto com 0 questões, excesso de “sem atividade”, gráficos invertidos, responsável demo, botões lavanda).
**Evidência:** PR #11; `supabase/seed/14_c1a_diversificar_demo.sql` (aplicado em prod); `ListaAlunos.jsx`/`AreaEscola.jsx` usam `accSem` (acerto 7d → “—” quando 0 questões na semana); `Progresso.jsx` ordena simulados por data; cor de acento restaurada (`#CDA349`).
**Ambiente:** dados aplicados ao Supabase prod (diversificação determinística por `hashtext`); sem-atividade reduzido (meta ≤12). Conta responsável demo documentada.
**Ressalva:** C1A.6 (responsável) foi “apenas documentada” (conta já existia). Validação visual não reexecutada nesta auditoria (sem browser).
**Decisão:** **Aprovada com ressalvas** (dados credíveis no banco; verificação visual pendente).

## C1B — UX crítica + Patch C1B (alertas acionáveis)

**Promessa:** “Hoje” com estados claros; missão concluída com CTA, atrasada, próxima bloqueada; Registro com “Ver mais”; Desempenho conservador; Simulados responsivos; Conquistas/Patentes compactas; **alertas da coordenação acionáveis com filtros** e lista de alunos que não quebra.
**Evidência:** PR #12/#13 + patch `e260b3a`. `MetaHero.jsx` (4 estados de missão + CTAs), `Registrar.jsx` (limite 7 + “Ver mais”), `Insights/Progresso/Radar/Niveis/Acumulado` reordenados, `PainelGestao.jsx` (alertas com até 3 nomes; patch torna os alertas acionáveis com filtros).
**Ambiente:** o **deploy do merge C1B (#12, `eee2bc4`) ficou ERROR na Vercel** — corrigido no merge seguinte (#13 `413fbd8`, READY). Produção atual sã.
**Ressalva:** E2E/mobile não validados (CI E2E nunca verde; sem browser aqui).
**Decisão:** **Aprovada com ressalvas** (entregue no código + produção atual READY; houve um deploy ERROR intermediário; verificação E2E/mobile pendente).

## C1C — Polimento da vitrine

**Promessa:** Lucas com volume realista; login polido; placeholders; loading/empty states; remover textos técnicos (“Fase 15”); mobile; telas seguras p/ demo; roteiro técnico.
**Evidência:** PR #14; `15_c1c_lucas_q7d.sql` (Lucas q7d 595→170 via UPDATE em prod); `Login.jsx` (placeholders, crosshatch militar, borda gold); `Niveis.jsx` sem “Fase 15”; relatório com lista de telas liberadas/ressalvadas e roteiro de 3 perfis.
**Ambiente:** UPDATE de Lucas aplicado em prod (q7d realista — Lucas hoje 1400 XP, valores coerentes).
**Ressalva:** mobile “revisão de código, sem bloqueadores” — não validado em 430px nesta auditoria.
**Decisão:** **Aprovada com ressalvas**.

## C1D — Fechamento dos 30 pontos

**Promessa:** tabela dos 30 pontos; 27/30 corrigidos; 3 adiados formalmente (#19, #29, #30); #18 delete com confirmação; #22 ofensiva 0; #20/#21 LGPD/responsáveis; #23 data exata; #28 auto-incremento de simulado; E2E/validações pendentes.
**Evidência:** PR #15; `docs/auditoria/relatorio-c1d-fechamento-30-pontos.md`; `16_c1d_higiene_demo.sql` (aplicado em prod). Código: `Registrar.jsx` (#18 confirmação), `MetaHero.jsx` (#22), `fmtBRDiaSemana` (#23), `Progresso.jsx` (#28), `Acumulado.jsx` (#16/#27 treemap).
**Ambiente:** higiene LGPD da vitrine aplicada — os 60 alunos têm **nomes fictícios realistas distintos** (ex.: “Ricardo Alves Tenorio”, “Carolina Dias Marques”), não “Aluno N”. Timestamps distintos.
**Resultado declarado:** 27/30 corrigidos, 3 adiados (#19 dropdowns→coordenação P2; #29 cronômetro P3; #30 upload de logo→D0/white-label P3), 0 P0/P1.
**Ressalva:** E2E/DB/mobile “justificados (sem Postgres/Chromium no ambiente remoto)” — a verificação automatizada dos 30 pontos **não foi rodada** (mesma lacuna de E2E do projeto).
**Decisão:** **Aprovada com ressalvas**.

---

## Riscos consolidados C1*
- **P2** — Toda a verificação E2E/mobile dos ajustes C1A–C1D ficou “pendente/justificada”; nunca houve E2E verde para confirmá-los.
- **P2** — Deploy ERROR intermediário no merge C1B (#12) mostra que merges chegaram a quebrar a build na Vercel (corrigido depois, mas indica falta de gate verde antes do merge).
- **P3** — 3 pontos da auditoria original adiados formalmente (#19/#29/#30).

## Decisão do bloco
**Aprovada com ressalvas.** Os ajustes de credibilidade/UX/polimento e o fechamento dos 30 pontos estão no código e os patches de dados aplicados em prod (base demo credível e higienizada). A ressalva transversal é a **ausência de verificação E2E/visual automatizada**, que se soma ao P1 de CI/E2E.
