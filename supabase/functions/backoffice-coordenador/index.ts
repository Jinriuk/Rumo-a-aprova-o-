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
//   - Tarefa 1: o link de redefinição (action_link) é gerado no servidor e
//     disparado por e-mail de verdade via Resend (RESEND_API_KEY) — nunca
//     volta na resposta da API (nem para a interface do backoffice) e nunca
//     é logado em console. "enviado" só depois que o Resend CONFIRMA (2xx);
//     falha na entrega vira "_pendente" (a coordenação usa "Reenviar").
//
// Estados retornados:
//   coordenador_criado_email_enviado
//   coordenador_criado_email_pendente
//   coordenador_existente_reenvio_enviado
//   coordenador_existente_reenvio_pendente
//   erro_auth | erro_smtp | erro_redirect
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
// Slugs do(s) projeto(s) na Vercel (previews): VERCEL_PREVIEW_PREFIXES
// (CSV, só [a-z0-9-] por item); sem ela cai no singular
// VERCEL_PREVIEW_PREFIX (compat) e por fim no default. Espelha _shared/cors.ts.
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

// PROD1: o destino do link de redefinição vem do ambiente — produção tem
// domínio próprio; o default preserva o comportamento do demo/vitrine.
const REDIRECT_URL = Deno.env.get("PASSWORD_RESET_REDIRECT_URL") ??
  "https://rumo-a-aprova-o.vercel.app/redefinir-senha";

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

// EST1-B1: resolve o coordenador existente pelo CACHE indexado
// usuarios.email (O(1), migration 0041) em vez de varrer a 1ª página de
// 1000 contas do Auth — que quebrava assim que o projeto passava de 1000
// contas (todo aluno/responsável é auth.users). Achado EST0 SEGURANCA-01/A8.
async function acharUsuarioPorEmail(emailLower: string): Promise<string | null> {
  const { data } = await admin
    .from("usuarios").select("id").eq("email", emailLower).limit(1).maybeSingle();
  return data?.id ?? null;
}

// Fallback RARO — conta Auth existe sem linha usuarios (estado parcial de
// uma falha anterior): pagina o Auth ATÉ ACHAR, sem parar em 1000. Teto
// defensivo de 50 páginas (50k contas) para não rodar sem fim.
async function acharAuthPorEmail(emailLower: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === emailLower);
    if (u) return u.id;
    if (data.users.length < perPage) break; // última página
  }
  return null;
}

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

// Tarefa 1: auth.admin.generateLink() acima NUNCA envia e-mail — só gera o
// action_link. Quem envia de verdade é o Resend, chamado diretamente aqui
// (sem depender do SMTP do Supabase). Sem domínio próprio ainda configurado
// no Resend, RESEND_FROM_EMAIL cai no remetente de teste do próprio Resend
// (funciona sem verificação de domínio; troque por secret assim que houver
// domínio verificado — a entregabilidade do remetente de teste é limitada).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Triliva <onboarding@resend.dev>";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function corpoEmailAcesso(nome: string, link: string): string {
  const saudacao = nome ? `Olá, ${escapeHtml(nome)}.` : "Olá.";
  return `<p>${saudacao}</p>` +
    `<p>Use o link abaixo para definir sua senha de acesso à coordenação na Triliva:</p>` +
    `<p><a href="${link}">${link}</a></p>` +
    `<p>Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>`;
}

// Dispara via Resend e só devolve true quando a API CONFIRMA o envio
// (2xx). Nunca lança — falha de rede ou recusa do Resend vira false, e o
// chamador trata como "_pendente" (fallback: reenviar depois).
async function enviarEmailAcesso(destino: string, nome: string, link: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("backoffice-coordenador: RESEND_API_KEY ausente — e-mail não enviado");
    return false;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: destino,
        subject: "Seu acesso à coordenação — Triliva",
        html: corpoEmailAcesso(nome, link),
      }),
    });
    if (!resp.ok) {
      console.error("backoffice-coordenador: Resend recusou o envio", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("backoffice-coordenador: falha de rede ao chamar o Resend", (e as Error)?.message);
    return false;
  }
}

// Gera o link e só então tenta enviá-lo — o retorno NUNCA carrega o link
// (regra do plano, princípio 6/7): quem chamou só sabe se foi "enviado" ou
// não. `geracaoFalhou` distingue "não deu nem pra gerar o link" (erro real,
// 500) de "gerou mas o Resend não confirmou a entrega" (estado pendente,
// a coordenação usa "reenviar" depois).
async function gerarEEnviarLink(
  email: string, nome: string,
): Promise<{ enviado: boolean; erro: string | null; geracaoFalhou: boolean }> {
  const { link, erro: erroGeracao } = await gerarLinkRecuperacao(email);
  if (erroGeracao || !link) {
    return { enviado: false, erro: erroGeracao ?? "erro_auth", geracaoFalhou: true };
  }
  const enviado = await enviarEmailAcesso(email, nome, link);
  return { enviado, erro: enviado ? null : "erro_smtp", geracaoFalhou: false };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") return json({ status: "erro_auth", error: "método não suportado" }, 405);

  try {
    const quem = await superAdmin(req);
    if (!quem) return json({ status: "erro_auth", error: "acesso restrito ao super_admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const acao: string = (body.acao ?? "criar").toLowerCase();

    // ── Modo REENVIAR ──
    if (acao === "reenviar") {
      const { email } = body;
      if (!email) return json({ status: "erro_auth", error: "informe o email do coordenador" }, 400);
      if (!emailValido(String(email))) return json({ status: "erro_auth", error: "e-mail inválido" }, 400);
      const emailLower = String(email).trim().toLowerCase();

      const { data: existente } = await admin
        .from("usuarios").select("nome").eq("email", emailLower).maybeSingle();

      const { enviado, erro, geracaoFalhou } = await gerarEEnviarLink(emailLower, existente?.nome ?? "");

      if (geracaoFalhou) return json({ status: erro, error: "falha ao gerar link de recuperação" }, 500);

      const statusReenvio = enviado
        ? "coordenador_existente_reenvio_enviado"
        : "coordenador_existente_reenvio_pendente";

      await admin.from("admin_logs").insert({
        super_admin_id: quem.id,
        acao: "reenviar-acesso-coordenador",
        detalhe: { email: emailLower, status: statusReenvio, ...(erro ? { erro_link: erro } : {}) },
      });

      return json({ ok: true, status: statusReenvio, email: emailLower, ...(erro ? { erro_link: erro } : {}) });
    }

    // ── Modo CRIAR (default) ──
    const { escola_id, nome, email } = body;
    if (!escola_id || !nome || !email) {
      return json({ status: "erro_auth", error: "informe escola_id, nome e email" }, 400);
    }
    if (!emailValido(String(email))) return json({ status: "erro_auth", error: "e-mail inválido" }, 400);
    const emailLower = String(email).trim().toLowerCase();
    const nomeLimpo = String(nome).trim();

    const { data: escola, error: errEsc } = await admin
      .from("escolas").select("id, nome").eq("id", escola_id).maybeSingle();
    if (errEsc) return json({ status: "erro_auth", error: "erro ao consultar escola" }, 500);
    if (!escola) return json({ status: "erro_auth", error: "escola não encontrada" }, 404);

    const meta = { escola_id, papel: "coordenacao" };

    // EST1-B1: acha o coordenador existente pelo cache indexado (O(1)) e
    // não pela varredura da 1ª página do Auth (que falhava > 1000 contas).
    const atualizarAuth = (id: string) =>
      admin.auth.admin.updateUserById(id, { app_metadata: meta, user_metadata: { nome: nomeLimpo } });

    let uid: string;
    let criada = false;
    const idCache = await acharUsuarioPorEmail(emailLower);
    if (idCache) {
      const { error } = await atualizarAuth(idCache);
      if (error) return json({ status: "erro_auth", error: "falha ao atualizar usuário" }, 500);
      uid = idCache;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: emailLower,
        password: senhaAleatoria(),
        email_confirm: true,
        app_metadata: meta,
        user_metadata: { nome: nomeLimpo },
      });
      if (error) {
        // conta Auth já existe sem linha usuarios (estado parcial): localiza
        // paginando ATÉ achar e atualiza — nunca devolve o 500 enganoso.
        const idAuth = await acharAuthPorEmail(emailLower);
        if (!idAuth) return json({ status: "erro_auth", error: "falha ao criar usuário" }, 500);
        const { error: eUp } = await atualizarAuth(idAuth);
        if (eUp) return json({ status: "erro_auth", error: "falha ao atualizar usuário" }, 500);
        uid = idAuth;
      } else {
        uid = data.user.id;
        criada = true;
      }
    }

    const { error: errU } = await admin.from("usuarios").upsert(
      { id: uid, escola_id, papel: "coordenacao", nome: nomeLimpo, email: emailLower },
      { onConflict: "id" },
    );
    if (errU) {
      if (criada) await admin.auth.admin.deleteUser(uid).catch(() => {});
      return json({ status: "erro_auth", error: "falha ao vincular usuário à escola" }, 500);
    }

    const { enviado, erro: erroLink } = await gerarEEnviarLink(emailLower, nomeLimpo);

    const statusFinal = criada
      ? (enviado ? "coordenador_criado_email_enviado" : "coordenador_criado_email_pendente")
      : (enviado ? "coordenador_existente_reenvio_enviado" : "coordenador_existente_reenvio_pendente");

    await admin.from("admin_logs").insert({
      super_admin_id: quem.id,
      acao: "vincular-coordenador",
      escola_id,
      detalhe: { nome: nomeLimpo, email: emailLower, conta_nova: criada, status: statusFinal, ...(erroLink ? { erro_link: erroLink } : {}) },
    });

    return json({
      ok: true,
      status: statusFinal,
      email: emailLower,
      nome: nomeLimpo,
      conta_nova: criada,
      ...(erroLink ? { erro_link: erroLink } : {}),
    });
  } catch (e) {
    console.error("backoffice-coordenador:", (e as Error)?.message ?? "erro desconhecido");
    return json({ status: "erro_auth", error: "falha ao provisionar coordenação" }, 500);
  }
});
