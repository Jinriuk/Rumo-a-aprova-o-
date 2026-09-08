/* Ambiente de execução do FRONT (Tarefa 3, indicador visual "DEMO").
   VITE_APP_ENV só é definida no projeto Vercel de demo/vitrine
   (`rumo-a-aprova-o`, Production e Preview); no projeto de produção
   real a variável não existe — ausência = produção. */
export const EH_DEMO = import.meta.env.VITE_APP_ENV === "demo";

// EH_DEMO sozinho NÃO é sinal suficiente para mostrar a faixa a um
// usuário logado: ele marca o DEPLOY inteiro (uma variável fixada no
// projeto Vercel), não a escola que a pessoa está vendo.
//
// Duas razões concretas, as duas já registradas no próprio banco:
//   1. A vitrine/beta têm `status = 'ativa'`, não `'demo'` — a migration
//      0031 mudou isso de propósito, porque a RLS trata status como
//      gate operacional (D1A.1). Um `escola.status === "demo"` ingênuo
//      erraria exatamente a escola que este indicador existe para
//      cobrir.
//   2. O mesmo projeto Supabase pode um dia hospedar escola de teste ou
//      real ao lado da vitrine (o backoffice não impede) — e o inverso
//      também: um deploy sem VITE_APP_ENV=demo pode um dia servir dado
//      de vitrine (ex.: o job `e2e` do CI builda SEM essa variável e
//      roda contra um projeto seedado com a mesma vitrine — ver
//      .github/workflows/ci.yml e docs/operacao/e2e-ambiente.md). Um
//      flag fixado no deploy não acompanha isso; o registro da escola
//      no banco sim.
//
// `escolaEhDemo` mora em demoEscola.js — módulo separado, sem
// `import.meta.env`, para poder ser importado em `node --test` (este
// arquivo, por causa da linha acima, não pode). Reexportada aqui para
// App.jsx pegar os dois sinais (EH_DEMO e escolaEhDemo) de um import só.
export { escolaEhDemo } from "./demoEscola.js";
