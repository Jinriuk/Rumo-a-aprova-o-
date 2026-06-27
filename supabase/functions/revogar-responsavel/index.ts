// ============================================================
// revogar-responsavel — revoga o vínculo de um responsável
// ------------------------------------------------------------
// Segurança:
//   - chamador validado pelo token real (não por campo de form)
//   - coordenação só revoga vínculo da própria escola
//   - super_admin (internal_admins) pode revogar em qualquer escola
//   - remove apenas vinculos_responsaveis (não apaga usuário nem auth)
//   - registra logs_coordenacao (ação sensível)
//   - service_role só aqui (nunca no navegador)
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// CORS com allowlist (SEG2 / E-1). Função auto-contida (sem imports de
// _shared/): versão canônica em _shared/cors.ts; cópia mínima de propósito.
// ALLOWED_ORIGINS (CSV) no ambiente substitui a lista padrão.
const ENV_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);
const DEFAULT_ORIGINS = [
  "https://rumo-a-aprova-o.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];
const ORIGINS = ENV_ORIGINS.length > 0 ? ENV_ORIGINS : DEFAULT_ORIGINS;
const VERCEL_PREVIEW = /^https:\/\/rumo-a-aprova-o-[a-z0-9-]+\.vercel\.app$/i;

function origemPermitida(origin: string): boolean {
  if (!origin) return false;
  if (ORIGINS.includes(origin)) return true;
  return VERCEL_PREVIEW.test(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (origemPermitida(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

async function chamador(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as Record<string, string>;
  if (!meta.escola_id || !meta.papel) return null;
  return { id: data.user.id, escola_id: meta.escola_id, papel: meta.papel };
}

async function resolverSuperAdmin(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: ia } = await admin
    .from("internal_admins")
    .select("auth_user_id")
    .eq("auth_user_id", data.user.id)
    .eq("ativo", true)
    .maybeSingle();
  return ia ? data.user.id : null;
}

async function registrarLogCoordenacao(
  escolaId: string,
  usuarioId: string,
  papel: string,
  detalhe: Record<string, unknown>,
) {
  const { error } = await admin.from("logs_coordenacao").insert({
    escola_id: escolaId,
    usuario_id: usuarioId,
    papel,
    acao: "revogou-responsavel",
    entidade: "responsavel",
    detalhe,
  });
  if (error) console.error("log revogar-responsavel:", error.message);
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
    const quem = await chamador(req);

    let executorId: string;
    let escolaFiltro: string | null = null;
    let papel: string;

    if (quem === null) {
      const adminId = await resolverSuperAdmin(req);
      if (!adminId) return json({ error: "não autenticado" }, 401);
      executorId = adminId;
      papel = "superadmin";
    } else if (quem.papel !== "coordenacao") {
      return json({ error: "só a coordenação revoga acesso" }, 403);
    } else {
      executorId = quem.id;
      escolaFiltro = quem.escola_id;
      papel = "coordenacao";
    }

    const { vinculo_id } = await req.json().catch(() => ({}));
    if (!vinculo_id) return json({ error: "informe vinculo_id" }, 400);

    let qVinculo = admin
      .from("vinculos_responsaveis")
      .select("id, escola_id, responsavel_id, aluno_id")
      .eq("id", vinculo_id);
    if (escolaFiltro) qVinculo = qVinculo.eq("escola_id", escolaFiltro);

    const { data: vinculo, error: errV } = await qVinculo.maybeSingle();
    if (errV) return json({ error: "erro ao consultar vínculo" }, 500);
    if (!vinculo) return json({ error: "vínculo não encontrado nesta escola" }, 404);

    const { data: usuario } = await admin
      .from("usuarios")
      .select("id, nome")
      .eq("id", vinculo.responsavel_id)
      .maybeSingle();

    const { error: e1 } = await admin
      .from("vinculos_responsaveis")
      .delete()
      .eq("id", vinculo_id);
    if (e1) return json({ error: "falha ao remover vínculo" }, 500);

    await registrarLogCoordenacao(vinculo.escola_id, executorId, papel, {
      vinculo_id,
      responsavel_id: vinculo.responsavel_id,
      aluno_id: vinculo.aluno_id,
      nome_responsavel: usuario?.nome ?? null,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("revogar-responsavel:", (e as Error)?.message ?? "erro desconhecido");
    return json({ error: "falha ao revogar acesso" }, 500);
  }
});
