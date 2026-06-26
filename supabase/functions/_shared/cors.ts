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

// Previews do PRÓPRIO projeto na Vercel: rumo-a-aprova-o-<hash/branch>-<scope>.vercel.app
// (NÃO libera qualquer *.vercel.app — só previews deste projeto). Para
// desligar previews por completo, basta definir ALLOWED_ORIGINS sem eles
// e o regex continua só validando o prefixo do projeto.
const VERCEL_PREVIEW = /^https:\/\/rumo-a-aprova-o-[a-z0-9-]+\.vercel\.app$/i;

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
