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
// Etapa 4: resposta 5xx vira relato no coletor de erros (sem dado pessoal).
import { comRelato5xx } from "../_shared/coletor-servidor.ts";

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
// P1.1 (13/10): a MESMA regra do Auth (demo e produção) e da tela
// (app/src/shared/lib/senha.js): 8+ caracteres com minúscula, maiúscula e
// número. Antes bastavam duas classes quaisquer e o Auth recusava o resto
// com um 500 genérico.
const REGRA_SENHA = "A senha precisa ter 8 caracteres ou mais, com letra minúscula, letra maiúscula e número.";

function senhaFraca(s: string): string | null {
  if (typeof s !== "string" || s.length < 8 || !/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/[0-9]/.test(s)) {
    return REGRA_SENHA;
  }
  return null;
}

// O Auth ainda pode recusar (senha vazada, regra mais dura configurada no
// painel). Vira 422 com texto para o usuário, não 500.
function recusaDoAuth(e: unknown): string | null {
  const err = e as { code?: string; name?: string; message?: string; reasons?: string[] } | null;
  if (!err || (err.code !== "weak_password" && err.name !== "AuthWeakPasswordError")) return null;
  const vazada = (err.reasons ?? []).includes("pwned") || /known to be weak|pwned|easy to guess/i.test(err.message ?? "");
  return vazada ? "Esta senha aparece em vazamentos conhecidos e é fácil de adivinhar. Escolha outra." : REGRA_SENHA;
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

// Onde a troca de senha fica registrada. logs_acesso é a trilha LGPD POR
// ALUNO (aluno_id NOT NULL, 0001): até 17/10 este insert ia com aluno_id
// null e o Postgres recusava, então nenhuma troca ficava registrada (o
// erro só aparecia no log da função). Agora:
//   aluno        → uma linha com o próprio aluno_id;
//   responsavel  → uma linha por aluno vinculado (a credencial dele abre
//                  os dados desses alunos);
//   coordenacao  → logs_coordenacao (0022), a trilha dela, sem aluno;
//   sem escola ou outro papel → nada (não há trilha por escola).
// Pura de propósito: o teste a executa sem rede.
type Quem = { id: string; escola_id: string | null; papel: string | null };
type LinhaLog = { tabela: "logs_acesso" | "logs_coordenacao"; linha: Record<string, unknown> };
function linhasDoLogDeSenha(quem: Quem, alunoIds: string[], acao = "trocou-senha"): LinhaLog[] {
  if (!quem.escola_id) return [];
  if (quem.papel === "coordenacao") {
    return [{ tabela: "logs_coordenacao", linha: {
      escola_id: quem.escola_id, usuario_id: quem.id, papel: "coordenacao", acao,
      entidade: "usuario", entidade_id: quem.id,
    } }];
  }
  if (quem.papel !== "aluno" && quem.papel !== "responsavel") return [];
  return [...new Set(alunoIds)].map((alunoId) => ({ tabela: "logs_acesso", linha: {
    escola_id: quem.escola_id, aluno_id: alunoId, usuario_id: quem.id, papel: quem.papel, acao,
  } }));
}

async function alunosDoChamador(quem: Quem): Promise<string[]> {
  if (!quem.escola_id) return [];
  if (quem.papel === "aluno") {
    const { data, error } = await admin.from("alunos").select("id")
      .eq("usuario_id", quem.id).eq("escola_id", quem.escola_id);
    if (error) throw error;
    return (data ?? []).map((a: { id: string }) => a.id);
  }
  if (quem.papel === "responsavel") {
    const { data, error } = await admin.from("vinculos_responsaveis").select("aluno_id")
      .eq("responsavel_id", quem.id).eq("escola_id", quem.escola_id);
    if (error) throw error;
    return (data ?? []).map((v: { aluno_id: string }) => v.aluno_id);
  }
  return [];
}

// A senha já foi trocada quando isto roda: falha no registro vai ao log da
// função e não desfaz nem esconde a troca.
async function registrarTrocaDeSenha(quem: Quem) {
  try {
    for (const { tabela, linha } of linhasDoLogDeSenha(quem, await alunosDoChamador(quem))) {
      const { error } = await admin.from(tabela).insert(linha);
      if (error) console.error(`falha ao registrar a troca de senha em ${tabela}:`, error.message);
    }
  } catch (e) {
    console.error("falha ao registrar a troca de senha:", (e as Error)?.message ?? e);
  }
}

Deno.serve(comRelato5xx("trocar-senha", async (req) => {
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
    if (e1) {
      const recusa = recusaDoAuth(e1);
      if (recusa) return json({ error: recusa, estado: "senha_fraca" }, 422);
      throw e1;
    }

    // must_change_password vive em `usuarios` (não no Auth) — é o que
    // App.jsx lê via meuPerfil() pra decidir o gate (B2). Zera sempre,
    // idempotente pra quem já estava com a flag falsa.
    const { error: e2 } = await admin.from("usuarios")
      .update({ must_change_password: false }).eq("id", quem.id);
    if (e2) throw e2;

    await registrarTrocaDeSenha(quem);

    return json({ estado: "senha_trocada" });
  } catch (e) {
    console.error("trocar-senha:", e);
    return json({ error: "falha ao trocar senha", estado: "erro_interno" }, 500);
  }
}));
