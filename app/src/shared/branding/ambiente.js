/* Ambiente de execução do FRONT (Tarefa 3, indicador visual "DEMO").
   VITE_APP_ENV só é definida no projeto Vercel de demo/vitrine
   (`rumo-a-aprova-o`, Production e Preview); no projeto de produção
   real a variável não existe — ausência = produção. */
export const EH_DEMO = import.meta.env.VITE_APP_ENV === "demo";
