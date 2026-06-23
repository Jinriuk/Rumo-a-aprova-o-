// ============================================================
// backoffice-coordenador — provisiona e reenvia acesso da coordenação
// ------------------------------------------------------------
// Modos (campo `acao` no corpo):
//   "criar"   (default) — cria/revincula coordenador + gera link de acesso
//   "reenviar"          — reenvia link de redefinição para e-mail existente
//
// Segurança:
//   - chamador validado pelo TOKEN real (não por campo de form)
//   - só super_admin ATIVO (internal_admins) passa
//   - senha aleatória descartável — coordenação define a própria pelo link
//   - registra admin_logs (ação sensível)
//   - service_role só aqui (nunca no navegador)
//   - link é retornado para fallback manual (SMTP pode não estar configurado)
//     mas NUNCA logado em console
//
// Estados retornados:
//   coordenador_criado_email_enviado
//   coordenador_criado_email_pendente
//   coordenador_existente_reenvio_enviado
//   coordenador_existente_reenvio_pendente
//   erro_auth | erro_smtp | erro_redirect
// ============================================================
import { admin } from "../_shared/contexto.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const REDIRECT_URL = "https://rumo-a-aprova-o.vercel.app/redefinir-senha";

const json = (body: unknown, status = 200, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

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

const emailValido = (e: string) => /^[^\@\s]+@[^\@\s]+\.[^\@\s]+$/.test(e);

async function gerarLinkRecuperacao(email: string): Promise<{ link: string | null; erro: string | null }> {
  try {
    const { data: gl, error: glErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: REDIRECT_URL },
    });
    if (glErr) {
      const msg = glErr.message ?? "";
      if (/smtp|email|send|mail/i.test(msg)) return { link: null, erro: "erro_smtp" };
      if (/redirect/i.test(msg)) return { link: null, erro: "erro_redirect" };
      return { link: null, erro: "erro_auth" };
    }
    const link = gl?.properties?.action_link ?? null;
    return { link, erro: null };
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (/smtp|email|send|mail/i.test(msg)) return { link: null, erro: "erro_smtp" };
    return { link: null, erro: "erro_auth" };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ status: "erro_auth", error: "método não suportado" }, 405, corsHeaders);

  try {
    const quem = await superAdmin(req);
    if (!quem) return json({ status: "erro_auth", error: "acesso restrito ao super_admin" }, 403, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const acao: string = (body.acao ?? "criar").toLowerCase();

    // ── Modo REENVIAR ──
    if (acao === "reenviar") {
      const { email } = body;
      if (!email) return json({ status: "erro_auth", error: "informe o email do coordenador" }, 400, corsHeaders);
      if (!emailValido(String(email))) return json({ status: "erro_auth", error: "e-mail inválido" }, 400, corsHeaders);
      const emailLower = String(email).trim().toLowerCase();

      const { link, erro } = await gerarLinkRecuperacao(emailLower);

      if (erro) return json({ status: erro, error: "falha ao gerar link de recuperação" }, 500, corsHeaders);

      const statusReenvio = link
        ? "coordenador_existente_reenvio_enviado"
        : "coordenador_existente_reenvio_pendente";

      await admin.from("admin_logs").insert({
        super_admin_id: quem.id,
        acao: "reenviar-acesso-coordenador",
        detalhe: { email: emailLower, status: statusReenvio },
      });

      return json({ ok: true, status: statusReenvio, email: emailLower, link }, 200, corsHeaders);
    }

    // ── Modo CRIAR (default) ──
    const { escola_id, nome, email } = body;
    if (!escola_id || !nome || !email) {
      return json({ status: "erro_auth", error: "informe escola_id, nome e email" }, 400, corsHeaders);
    }
    if (!emailValido(String(email))) return json({ status: "erro_auth", error: "e-mail inválido" }, 400, corsHeaders);
    const emailLower = String(email).trim().toLowerCase();
    const nomeLimpo = String(nome).trim();

    const { data: escola, error: errEsc } = await admin
      .from("escolas").select("id, nome").eq("id", escola_id).maybeSingle();
    if (errEsc) return json({ status: "erro_auth", error: "erro ao consultar escola" }, 500, corsHeaders);
    if (!escola) return json({ status: "erro_auth", error: "escola não encontrada" }, 404, corsHeaders);

    const meta = { escola_id, papel: "coordenacao" };

    const { data: lista, error: errLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (errLista) return json({ status: "erro_auth", error: "falha ao verificar usuários" }, 500, corsHeaders);
    const existente = lista.users.find((u) => (u.email ?? "").toLowerCase() === emailLower);

    let uid: string;
    let criada = false;
    if (existente) {
      const { error } = await admin.auth.admin.updateUserById(existente.id, {
        app_metadata: meta,
        user_metadata: { nome: nomeLimpo },
      });
      if (error) return json({ status: "erro_auth", error: "falha ao atualizar usuário" }, 500, corsHeaders);
      uid = existente.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: emailLower,
        password: senhaAleatoria(),
        email_confirm: true,
        app_metadata: meta,
        user_metadata: { nome: nomeLimpo },
      });
      if (error) return json({ status: "erro_auth", error: "falha ao criar usuário" }, 500, corsHeaders);
      uid = data.user.id;
      criada = true;
    }

    const { error: errU } = await admin.from("usuarios").upsert(
      { id: uid, escola_id, papel: "coordenacao", nome: nomeLimpo, email: emailLower },
      { onConflict: "id" },
    );
    if (errU) {
      if (criada) await admin.auth.admin.deleteUser(uid).catch(() => {});
      return json({ status: "erro_auth", error: "falha ao vincular usuário à escola" }, 500, corsHeaders);
    }

    const { link, erro: erroLink } = await gerarLinkRecuperacao(emailLower);

    const statusFinal = criada
      ? (link ? "coordenador_criado_email_enviado" : "coordenador_criado_email_pendente")
      : (link ? "coordenador_existente_reenvio_enviado" : "coordenador_existente_reenvio_pendente");

    await admin.from("admin_logs").insert({
      super_admin_id: quem.id,
      acao: "vincular-coordenador",
      escola_id,
      detalhe: { nome: nomeLimpo, email: emailLower, conta_nova: criada, status: statusFinal },
    });

    if (erroLink) {
      return json({
        ok: true,
        status: criada ? "coordenador_criado_email_pendente" : "coordenador_existente_reenvio_pendente",
        email: emailLower,
        nome: nomeLimpo,
        conta_nova: criada,
        link: null,
        erro_link: erroLink,
      }, 200, corsHeaders);
    }

    return json({
      ok: true,
      status: statusFinal,
      email: emailLower,
      nome: nomeLimpo,
      conta_nova: criada,
      link,
    }, 200, corsHeaders);
  } catch (e) {
    console.error("backoffice-coordenador:", (e as Error)?.message ?? "erro desconhecido");
    return json({ status: "erro_auth", error: "falha ao provisionar coordenação" }, 500, corsHeaders);
  }
});
