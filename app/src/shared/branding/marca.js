/* Marca da PLATAFORMA (o produto), distinta da marca da ESCOLA-tenant
   (white-label leve, BrandingContext.jsx). Fonte única: qualquer troca de
   nome do produto acontece aqui e só aqui — nenhuma tela escreve o nome
   literal. Inventário e critérios: docs/mapeamento-marca-triliva.md. */
export const NOME_PLATAFORMA = "Rumo à Aprovação";

// Origem pública de produção (Vercel). Só usada como fallback quando não
// há `window` — o front sempre prefere window.location.origin.
export const ORIGEM_PRODUCAO = "https://rumo-a-aprova-o.vercel.app";
