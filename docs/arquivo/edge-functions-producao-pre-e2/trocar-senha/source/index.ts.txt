// ============================================================
// trocar-senha — o próprio usuário define uma senha nova (Etapa 7 /
// BLOCO B2: troca obrigatória no primeiro acesso)
// Usa _shared/cors.ts (o deploy empacota); ver comentário no import.
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

// CORS com allowlist (SEG2 / E-1) — FONTE ÚNICA em _shared/cors.ts.
//
// B1 (segunda passada): esta função carregava uma CÓPIA inline da
// allowlist. Consequência concreta: a correção da Onda 1, que pôs os
// domínios da marca em _shared/cors.ts, NÃO alcançava esta função —
// ela continuaria respondendo sem Access-Control-Allow-Origin para
// www/app.trilivaedu.com.br, exatamente o defeito que a onda fechou.
// A cópia existia por limitação de um fluxo de publicação antigo (o
// MCP publicando um arquivo só), não por necessidade da função: tanto
// `supabase functions deploy` quanto o MCP com os arquivos _shared/ no
// payload resolvem este import relativo.
import { buildCorsHeaders as corsHeaders } from "../_shared/cors.ts";

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
