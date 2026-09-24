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

// B1 (catálogo de defeitos): os domínios da marca NÃO estavam aqui —
// só o slug antigo da Vercel. Com o preflight destravado (verify_jwt
// no config.toml) a resposta ainda sairia sem Access-Control-Allow-
// Origin para www/app.trilivaedu.com.br, e o navegador bloquearia do
// mesmo jeito. As duas causas precisam cair juntas.
//
// Ficam no CÓDIGO de propósito: assim a correção não depende de um
// secret (ALLOWED_ORIGINS) estar certo num painel que o repositório
// não enxerga. O override por env continua valendo para o dia em que
// entrar um domínio novo sem deploy.
//
// C-S02 (Etapa 2): localhost SAIU do default. Com ele aqui, toda função
// publicada — inclusive a de produção — aceitava http://localhost:5173
// sempre que ALLOWED_ORIGINS não estivesse definida no projeto. Para o
// desenvolvimento local, a origem entra pelo ambiente local das funções:
//   ALLOWED_ORIGINS=http://localhost:5173
// no arquivo de env usado por `supabase functions serve --env-file`.
// Lembrete: ALLOWED_ORIGINS SUBSTITUI esta lista inteira.
const DEFAULT_ORIGINS = [
  "https://app.trilivaedu.com.br", // produção (domínio próprio)
  "https://www.trilivaedu.com.br", // demo / vitrine (domínio próprio)
  "https://trilivaedu.com.br", // apex, sem www
  "https://rumo-a-aprova-o.vercel.app", // slug legado da Vercel
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
// Sem nenhuma das duas, usa o default. ATENÇÃO: ALLOWED_ORIGINS NÃO
// desliga os previews — origemPermitida() testa este regex sempre, com ou
// sem ALLOWED_ORIGINS. Hoje, preview de qualquer branch destes projetos
// fala com as funções (e o triliva-producao tem as VITE_ em Preview, ou
// seja, aponta para o banco de produção). Aceitar ou não essa origem nas
// funções de produção é decisão do dono (docs/e2-seguranca.md, fatia 5).
// Dois projetos Vercel publicam este repositório hoje (visível nos
// deploys de PR): o slug legado e o de produção da marca. O default
// cobria só o primeiro, então preview do segundo nascia bloqueado.
const PREVIEW_PREFIX_DEFAULTS = ["rumo-a-aprova-o", "triliva-producao"];
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
