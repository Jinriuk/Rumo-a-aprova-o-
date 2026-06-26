// ============================================================
// virar-semana — execução manual/operacional da virada
// ------------------------------------------------------------
// A virada OFICIAL é agendada no banco (pg_cron, migration 0004)
// e não depende de nada externo. Esta função existe como acesso
// operacional do OPERADOR (rodar a virada na mão, verificar).
// Só aceita chamada com a chave de serviço — nenhum papel de
// escola dispara virada global.
// ============================================================
import { admin, corsHeaders } from "../_shared/contexto.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ error: "só o operador (service role) roda a virada" }, 403);
    }

    const { data, error } = await admin.rpc("motor_virar_semana");
    if (error) throw error;

    return json({ ok: true, resultado: data });
  } catch (e) {
    console.error("virar-semana:", e);
    return json({ error: "falha na virada de semana" }, 500);
  }
});
