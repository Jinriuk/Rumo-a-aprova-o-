/* Transporte do E2E contra o demo: toda chamada ao Supabase é refeita
   pelo Node e devolvida ao navegador com os cabeçalhos de CORS para a
   origem local. Para a Edge Function, a chamada sai com a origem do demo
   (www.trilivaedu.com.br), que está na allowlist dela: é o que a prévia
   da Vercel faz de verdade. Nada no app muda. */
const ORIGEM_FUNCOES = "https://www.trilivaedu.com.br";

export async function transporteDemo(page) {
  const origemLocal = new URL(page.context()._options?.baseURL ?? "http://127.0.0.1:4174").origin;
  const cors = {
    "access-control-allow-origin": origemLocal,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-correlation-id, x-supabase-api-version",
    "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "access-control-expose-headers": "content-range, x-correlation-id",
  };
  await page.route(/\.supabase\.co\//, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const headers = { ...req.headers() };
    delete headers.host;
    delete headers["content-length"];
    if (/\/functions\/v1\//.test(req.url())) headers.origin = ORIGEM_FUNCOES;
    else delete headers.origin;
    const resp = await fetch(req.url(), { method: req.method(), headers, body: req.postDataBuffer() ?? undefined });
    const corpo = Buffer.from(await resp.arrayBuffer());
    const h = {};
    resp.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding|access-control-)/i.test(k)) h[k] = v; });
    await route.fulfill({ status: resp.status, headers: { ...h, ...cors }, body: corpo });
  });
}
