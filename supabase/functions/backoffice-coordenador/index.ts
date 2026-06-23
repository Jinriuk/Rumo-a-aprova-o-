// ============================================================
// backoffice-coordenador — provisiona e reenvia acesso da coordenação
// ------------------------------------------------------------
// Suporta dois modos (campo `acao` no corpo):
//   "criar"   (default) — cria/revincula coordenador + envia reset link
//   "reenviar"          — só reenvia reset password para e-mail existente
//
// Regras de segurança:
//   - OPTIONS responde sem auth (preflight CORS);
//   - POST exige token JWT válido + super_admin ativo em internal_admins;
//   - senha é ALEATÓRIA e descartável — nunca fixa, nunca devolvida;
//     a coordenação define a própria senha pelo LINK de recuperação;
//   - registra admin_logs (ação sensível);
//   - service_role só vive aqui (nunca no navegador).
//
// Idempotente: e-mail já existente é revinculado à escola (criar).
// ============================================================
import { admin } from "../_shared/contexto.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

async function superAdmin(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: ia } = await admin
    .from("internal_admins")
    .select("auth_user_id, ativo")
    .eq("auth_user_id", data.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (!ia) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

function senhaAleatoria(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

const emailValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  // Preflight CORS — deve responder antes de qualquer validação de auth
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const quem = await superAdmin(req);
    if (!quem) {
      return new Response(JSON.stringify({ error: "acesso restrito ao super_admin" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const acao: string = (body.acao ?? "criar").toLowerCase();

    // ── Modo REENVIAR: só reenvia reset password para coordenador existente ──
    if (acao === "reenviar") {
      const { email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: "informe o email do coordenador" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      if (!emailValido(String(email))) {
        return new Response(JSON.stringify({ error: "e-mail inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      const emailLower = String(email).trim().toLowerCase();

      let link: string | null = null;
      try {
        const { data: gl } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: emailLower,
        });
        link = gl?.properties?.action_link ?? null;
      } catch (_e) { /* sem SMTP configurado */ }

      return new Response(JSON.stringify({ ok: true, email: emailLower, link }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // ── Modo CRIAR (default): cria ou revincula coordenador ──
    const { escola_id, nome, email } = body;
    if (!escola_id || !nome || !email) {
      return new Response(JSON.stringify({ error: "informe escola_id, nome e email" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (!emailValido(String(email))) {
      return new Response(JSON.stringify({ error: "e-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const emailLower = String(email).trim().toLowerCase();
    const nomeLimpo = String(nome).trim();

    const { data: escola, error: errEsc } = await admin
      .from("escolas").select("id, nome").eq("id", escola_id).maybeSingle();
    if (errEsc) throw errEsc;
    if (!escola) {
      return new Response(JSON.stringify({ error: "escola não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const meta = { escola_id, papel: "coordenacao" };

    const { data: lista, error: errLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (errLista) throw errLista;
    const existente = lista.users.find((u) => (u.email ?? "").toLowerCase() === emailLower);

    let uid: string;
    let criada = false;
    if (existente) {
      const { error } = await admin.auth.admin.updateUserById(existente.id, {
        app_metadata: meta,
        user_metadata: { nome: nomeLimpo },
      });
      if (error) throw error;
      uid = existente.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: emailLower,
        password: senhaAleatoria(),
        email_confirm: true,
        app_metadata: meta,
        user_metadata: { nome: nomeLimpo },
      });
      if (error) throw error;
      uid = data.user.id;
      criada = true;
    }

    const { error: errU } = await admin.from("usuarios").upsert(
      { id: uid, escola_id, papel: "coordenacao", nome: nomeLimpo, email: emailLower },
      { onConflict: "id" },
    );
    if (errU) {
      if (criada) await admin.auth.admin.deleteUser(uid).catch(() => {});
      throw errU;
    }

    let link: string | null = null;
    let emailEnviado = false;
    try {
      const { data: gl } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: emailLower,
      });
      link = gl?.properties?.action_link ?? null;
      emailEnviado = link !== null;
    } catch (_e) { /* sem SMTP */ }

    await admin.from("admin_logs").insert({
      super_admin_id: quem.id,
      acao: "vincular-coordenador",
      escola_id,
      detalhe: { nome: nomeLimpo, email: emailLower, conta_nova: criada },
    });

    return new Response(
      JSON.stringify({ ok: true, email: emailLower, nome: nomeLimpo, conta_nova: criada, link, email_enviado: emailEnviado }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("backoffice-coordenador:", e);
    return new Response(JSON.stringify({ error: "falha ao provisionar coordenação" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
