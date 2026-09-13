// ============================================================
// trocar-senha — o próprio usuário define uma senha nova (Etapa 7 /
// BLOCO B2: troca obrigatória no primeiro acesso)
// Auto-contida: sem imports de _shared/ (compat. com MCP bundler)
// ------------------------------------------------------------
// Quem chama: qualquer usuário AUTENTICADO trocando a PRÓPRIA senha —
// o alvo nunca vem do payload, só do JWT (não existe "trocar a senha de
// outra pessoa" aqui; isso é resetar-senha em provisionar-aluno, ação
// da COORDENAÇÃO, não do próprio usuário).
//
// Por que não exige a senha atual: a posse de uma sessão válida (o JWT
// que chegou aqui) já é a prova — mesmo padrão usado na correção do
// link de recuperação (RedefinirSenha: o token do link autoriza, sem
// reconfirmar credencial). Vale tanto pra quem entrou com a senha
// temporária (B2) quanto pra troca voluntária mais tarde.
//
// Sempre zera must_change_password ao final, mesmo se o chamador já
// estava com a flag falsa (coordenação, ou aluno trocando de novo por
// vontade própria) — idempotente, nunca precisa ramificar por papel.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// CORS com allowlist (SEG2 / E-1). Cópia mínima de propósito — a versão
// canônica vive em _shared/cors.ts; ver comentário igual nas outras
// funções sobre por que esta cópia existe.
const ENV_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);
const DEFAULT_ORIGINS = [
  "https://rumo-a-aprova-o.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];
const ORIGINS = ENV_ORIGINS.length > 0 ? ENV_ORIGINS : DEFAULT_ORIGINS;
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

async function chamador(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as Record<string, string>;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    escola_id: meta.escola_id ?? null,
    papel: meta.papel ?? null,
  };
}

// O código de acesso de aluno/responsável É a parte local do e-mail
// sintético (`<codigo>@codigo.acesso.local` — ver emailDoCodigo em
// provisionar-aluno). Então o servidor SABE o código de quem está
// trocando a senha, sem receber nada do cliente. Devolve "" para
// coordenação/super_admin (e-mail real, não sintético).
function codigoDoEmail(email: string): string {
  const [local, dominio] = email.toLowerCase().split("@");
  return dominio === "codigo.acesso.local" ? local.toUpperCase() : "";
}

const normalizarCodigo = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

// Espelha forcaSenha() do front (RedefinirSenha.jsx / shared/lib/
// recuperacao.js): mesmo piso dos DOIS lados da fronteira, senão a
// validação do cliente é só decoração — SEGURANCA-04 (validação de
// força só no cliente, contornável pela API) é achado documentado
// (docs/auditoria/seguranca/seg2), e este endpoint é onde fechamos.
function senhaFraca(s: string): string | null {
  if (typeof s !== "string" || s.length < 8) return "Senha muito curta (mínimo 8 caracteres).";
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  if (classes < 2) return "Senha fraca — combine maiúsculas, minúsculas, números ou símbolos.";
  return null;
}

// Etapa 7 / BLOCO B1 — a regra que dá sentido a todo o resto: a senha
// pessoal não pode SER o código. Sem isto, o aluno podia digitar o
// próprio código nos dois campos e recriar exatamente o acoplamento que
// esta etapa existe pra quebrar ("quem viu o bilhete entra pra sempre"),
// com o app achando que estava tudo certo. A comparação é sobre o código
// NORMALIZADO dos dois lados, senão "ABCD-EFGH-1234" passaria por ser
// diferente de "ABCDEFGH1234".
function senhaEhOCodigo(senha: string, codigo: string): boolean {
  if (!codigo) return false; // coordenação/super_admin: não há código
  return normalizarCodigo(senha) === normalizarCodigo(codigo);
}

async function registrarLogAcesso(
  escolaId: string | null, usuarioId: string, papel: string | null, acao: string,
) {
  if (!escolaId) return; // JWT sem app_metadata completo — nada a registrar por tenant
  const { error } = await admin.from("logs_acesso").insert({
    escola_id: escolaId, aluno_id: null, usuario_id: usuarioId, papel: papel ?? "desconhecido", acao,
  });
  if (error) console.error("falha ao registrar log de acesso:", error.message);
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
    if (!quem) return json({ error: "não autenticado" }, 401);

    const { senha_nova } = await req.json().catch(() => ({}));
    const problema = senhaFraca(senha_nova);
    if (problema) return json({ error: problema, estado: "senha_fraca" }, 422);

    if (senhaEhOCodigo(senha_nova, codigoDoEmail(quem.email))) {
      return json({
        error: "A senha não pode ser igual ao seu código de acesso — o código é público, a senha é só sua.",
        estado: "senha_igual_ao_codigo",
      }, 422);
    }

    const { error: e1 } = await admin.auth.admin.updateUserById(quem.id, { password: senha_nova });
    if (e1) throw e1;

    // must_change_password vive em `usuarios` (não no Auth) — é o que
    // App.jsx lê via meuPerfil() pra decidir o gate (B2). Zera sempre,
    // idempotente pra quem já estava com a flag falsa.
    const { error: e2 } = await admin.from("usuarios")
      .update({ must_change_password: false }).eq("id", quem.id);
    if (e2) throw e2;

    await registrarLogAcesso(quem.escola_id, quem.id, quem.papel, "trocou-senha");

    return json({ estado: "senha_trocada" });
  } catch (e) {
    console.error("trocar-senha:", e);
    return json({ error: "falha ao trocar senha", estado: "erro_interno" }, 500);
  }
});
