// ============================================================
// virar-semana — execução manual/operacional da virada
// ------------------------------------------------------------
// A virada OFICIAL é agendada no banco (pg_cron, migration 0004)
// e não depende de nada externo. Esta função existe como acesso
// operacional do OPERADOR (rodar a virada na mão, verificar).
// Só aceita chamada com a chave de serviço — nenhum papel de
// escola dispara virada.
//
// SEC3/T73: a comparação do token de serviço é CONSTANTE NO TEMPO
//   (timingSafeEqual) — não vaza, por tempo de resposta, quantos
//   bytes do segredo o atacante já acertou.
// SEC3/T74: aceita `escola_id` opcional no corpo para virar UMA
//   escola sem tocar nas outras (motor_virar_semana_escola). Sem
//   escola_id, mantém a virada GLOBAL (motor_virar_semana).
// ============================================================
import { admin, corsHeaders } from "../_shared/contexto.ts";

// Comparação de strings em tempo constante. Web Crypto (Deno) não traz
// um timingSafeEqual pronto; esta versão compara byte a byte sem ramo
// de saída antecipada. Compara o HASH SHA-256 dos dois lados para que
// nem o COMPRIMENTO do segredo vaze pela diferença de tamanho.
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

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
    const segredo = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!token || !segredo || !(await timingSafeEqual(token, segredo))) {
      return json({ error: "só o operador (service role) roda a virada" }, 403);
    }

    // escola_id opcional: presente → vira SÓ aquela escola; ausente →
    // virada global (comportamento histórico, idêntico ao cron).
    const { escola_id } = await req.json().catch(() => ({}));

    if (escola_id) {
      if (typeof escola_id !== "string") {
        return json({ error: "escola_id deve ser um uuid" }, 400);
      }
      const { data, error } = await admin.rpc("motor_virar_semana_escola", { p_escola: escola_id });
      if (error) throw error;
      return json({ ok: true, escopo: "escola", escola_id, resultado: data });
    }

    const { data, error } = await admin.rpc("motor_virar_semana");
    if (error) throw error;

    return json({ ok: true, escopo: "global", resultado: data });
  } catch (e) {
    console.error("virar-semana:", e);
    return json({ error: "falha na virada de semana" }, 500);
  }
});
