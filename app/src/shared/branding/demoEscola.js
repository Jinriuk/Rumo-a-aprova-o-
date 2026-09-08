/* Classifica se uma ESCOLA (não o deploy) é de demonstração.
   ------------------------------------------------------------
   Módulo PURO de propósito, sem `import.meta.env`: é o que permite
   testar isto em `node --test` sem o runtime do Vite. ambiente.js
   (que TEM `import.meta.env.VITE_APP_ENV`, e por isso não é importável
   fora do Vite) reexporta esta função — ver o comentário lá sobre por
   que a faixa DEMO precisa dos dois sinais.
   ============================================================ */
import { categoriaEscola } from "../../modules/backoffice/operacao.js";

export function escolaEhDemo(escola) {
  if (!escola) return false;
  return categoriaEscola(escola).chave === "demo";
}
