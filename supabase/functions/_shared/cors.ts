// ============================================================
// CORS — allowlist de origens das Edge Functions (SEG2 / E-1)
// ------------------------------------------------------------
// Antes (SEG1): Access-Control-Allow-Origin: "*" (curinga) em todas
// as funções. Aceitável com auth por Bearer, mas estreitar reduz
// superfície antes do piloto real.
//
// Regra: só REFLETE o Origin quando ele está na allowlist. Origem não
// permitida NÃO recebe Access-Control-Allow-Origin — o navegador então
// bloqueia a leitura da resposta. Sem cookies/credenciais (modelo
// Bearer), portanto sem Access-Control-Allow-Credentials.
//
// A allowlist é configurável por ambiente: defina o secret
//   ALLOWED_ORIGINS="https://dominio.com.br,https://www.dominio.com.br"
// (CSV) na função e ele SUBSTITUI a lista padrão — assim, quando o
// domínio próprio entrar (julho), não é preciso mexer no código.
// ============================================================

const ENV_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  "https://rumo-a-aprova-o.vercel.app", // produção (Vercel)
  "http://localhost:5173", // dev local (Vite)
  "http://localhost:3000", // dev local (alternativo)
];

const ORIGINS = ENV_ORIGINS.length > 0 ? ENV_ORIGINS : DEFAULT_ORIGINS;

// Previews do PRÓPRIO projeto na Vercel: <slug>-<hash/branch>-<scope>.vercel.app
// (NÃO libera qualquer *.vercel.app — só previews destes projetos). A
// lista de slugs vem de VERCEL_PREVIEW_PREFIXES (CSV; cada item só
// [a-z0-9-], item inválido é descartado) — assim uma troca de slug/marca
// na Vercel, ou a convivência de mais de um projeto (ex.: rename em
// andamento), não exige editar código, como já vale para ALLOWED_ORIGINS.
// Compat: sem PREFIXES, cai para o singular VERCEL_PREVIEW_PREFIX (nome
// de secret já existente, lido desde a troca de marca — não é órfão).
// Sem nenhuma das duas, usa o default. Para desligar previews por
// completo, defina ALLOWED_ORIGINS sem eles; o regex segue só validando
// os prefixos configurados.
const PREVIEW_PREFIX_DEFAULTS = ["rumo-a-aprova-o"];
const PREVIEW_PREFIX_RE = /^[a-z0-9-]{1,63}$/i;
function previewPrefixes(): string[] {
  const csv = (Deno.env.get("VERCEL_PREVIEW_PREFIXES") ?? "")
    .split(",").map((p) => p.trim()).filter((p) => PREVIEW_PREFIX_RE.test(p));
  if (csv.length > 0) return csv;
  const single = (Deno.env.get("VERCEL_PREVIEW_PREFIX") ?? "").trim();
  if (PREVIEW_PREFIX_RE.test(single)) return [single];
  return PREVIEW_PREFIX_DEFAULTS;
}
const VERCEL_PREVIEW = new RegExp(
  `^https://(?:${previewPrefixes().join("|")})-[a-z0-9-]+\\.vercel\\.app$`, "i",
);

export function origemPermitida(origin: string): boolean {
  if (!origin) return false;
  if (ORIGINS.includes(origin)) return true;
  return VERCEL_PREVIEW.test(origin);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (origemPermitida(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
