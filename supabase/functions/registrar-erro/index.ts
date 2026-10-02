// ============================================================
// registrar-erro — coletor de erro do front (Etapa 4, alertas ao dono)
// ------------------------------------------------------------
// Recebe o JSON que app/src/shared/lib/observabilidade.js envia (POST,
// sem login), grava em app.erros_ocorrencias pela RPC da 0059 e, no
// primeiro relato de cada erro na hora, manda e-mail para ALERTA_EMAIL
// pelo Resend. A URL desta função é a VITE_ERROR_REPORT_URL do front, e
// a CSP já cobre (connect-src *.supabase.co).
//
// Endpoint público, então as travas vêm antes de qualquer escrita:
//   1. só origem da allowlist compartilhada (_shared/cors.ts); sem
//      Origin (curl, servidor) também é recusado: 403;
//   2. corpo de até 16 KB, lido com teto: 413;
//   3. só os campos conhecidos, cortados, com e-mail, token, senha e
//      JWT redigidos (_shared/coletor.ts);
//   4. limite por IP (HMAC do IP do dia, nunca o IP): 429;
//   5. tetos globais na RPC: 500 ocorrências e 20 e-mails em 24 h,
//      1 e-mail por fingerprint por hora.
// O Origin é forjável fora do navegador; quem segura abuso de script são
// 4 e 5. Esta função não passa por comRelato5xx: falha dela relatada a
// ela mesma viraria laço.
// ============================================================
import { buildCorsHeaders as corsHeaders, origemPermitida } from "../_shared/cors.ts";
import { chaveLimiteIp, ipDoCliente, LIMITES, lerCorpoLimitado, normalizarEvento } from "../_shared/coletor.ts";
import { registrarEvento } from "../_shared/coletor-servidor.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);
  if (!origemPermitida(req.headers.get("origin") ?? "")) return json({ error: "origem não permitida" }, 403);

  const corpo = await lerCorpoLimitado(req, LIMITES.corpoBytes);
  if (corpo === null) return json({ error: "relato grande demais" }, 413);
  let bruto: unknown;
  try {
    bruto = JSON.parse(corpo);
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return json({ error: "JSON inválido" }, 400);

  const evento = normalizarEvento(bruto as Record<string, unknown>);
  const chave = await chaveLimiteIp(ipDoCliente(req.headers), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", new Date());

  try {
    const r = await registrarEvento(evento, chave);
    if (r.resultado === "limitado") return json({ error: "relatos demais; tente mais tarde" }, 429);
    return json({ ok: true }, 202);
  } catch (e) {
    console.error("registrar-erro:", (e as Error)?.message ?? e);
    return json({ error: "falha ao registrar" }, 503);
  }
});
