/* Marca da PLATAFORMA (o produto), distinta da marca da ESCOLA-tenant
   (white-label leve, BrandingContext.jsx). Fonte única: qualquer troca de
   nome do produto acontece aqui e só aqui — nenhuma tela escreve o nome
   literal. Inventário e critérios: docs/mapeamento-marca-triliva.md. */
export const NOME_PLATAFORMA = "Triliva";

// Origem pública de produção (Vercel). Só usada como fallback quando não
// há `window` — o front sempre prefere window.location.origin.
// ATENÇÃO: é o domínio REAL em produção, não a marca. O slug da Vercel
// segue `rumo-a-aprova-o` até alguém renomear o projeto no painel; trocar
// esta string antes disso quebra o redirect de redefinição de senha.
export const ORIGEM_PRODUCAO = "https://rumo-a-aprova-o.vercel.app";
