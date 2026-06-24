// ============================================================
// provisionar-aluno — gera credencial de acesso (Doc 6, 1.1)
// Auto-contida: sem imports de _shared/ (compat. com MCP bundler)
// ------------------------------------------------------------
// Tipos suportados:
//   aluno              — cria credencial para o aluno
//   responsavel        — cria credencial para novo responsável e vincula
//   vincular-responsavel — vincula responsável JÁ EXISTENTE ao aluno
//                          (re-vincula responsável revogado sem duplicar conta)
//
// O código é credencial completa (identifica e autentica). Ele é
// mostrado UMA vez para a coordenação e não fica legível depois.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

// sem 0/O/1/I/L pra credencial ser ditável por telefone sem erro
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function novoCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

const emailDoCodigo = (codigo: string) =>
  `${codigo.replace(/-/g, "").toLowerCase()}@codigo.acesso.local`;

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

async function alunoDaEscola(alunoId: string, escolaId: string) {
  const { data, error } = await admin
    .from("alunos")
    .select("id, escola_id, nome, usuario_id, trilha_id")
    .eq("id", alunoId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function registrarLogAcesso(
  escolaId: string, alunoId: string, usuarioId: string, papel: string, acao: string,
) {
  const { error } = await admin.from("logs_acesso").insert({
    escola_id: escolaId, aluno_id: alunoId, usuario_id: usuarioId, papel, acao,
  });
  if (error) console.error("falha ao registrar log de acesso:", error.message);
}

async function registrarLogCoordenacao(
  escolaId: string, usuarioId: string, papel: string, acao: string,
  detalhe: Record<string, unknown>,
) {
  const { error } = await admin.from("logs_coordenacao").insert({
    escola_id: escolaId, usuario_id: usuarioId, papel, acao,
    entidade: "responsavel", detalhe,
  });
  if (error) console.error("falha ao registrar log de coordenação:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  try {
    const quem = await chamador(req);
    if (!quem) return json({ error: "não autenticado" }, 401);
    if (quem.papel !== "coordenacao") return json({ error: "só a coordenação provisiona acesso" }, 403);

    const { tipo, aluno_id, nome, responsavel_id } = await req.json().catch(() => ({}));

    const tiposValidos = ["aluno", "responsavel", "vincular-responsavel"];
    if (!aluno_id || !tiposValidos.includes(tipo)) {
      return json({
        error: "informe tipo ('aluno' | 'responsavel' | 'vincular-responsavel') e aluno_id",
        estado: "erro_validacao",
      }, 400);
    }

    const aluno = await alunoDaEscola(aluno_id, quem.escola_id);
    if (!aluno) return json({ error: "aluno não encontrado nesta escola", estado: "erro_validacao" }, 404);

    // ── Vincular responsável existente (re-vinculação sem duplicar conta) ───
    if (tipo === "vincular-responsavel") {
      if (!responsavel_id) {
        return json({ error: "informe responsavel_id", estado: "erro_validacao" }, 400);
      }

      const { data: resp } = await admin
        .from("usuarios")
        .select("id, nome, papel")
        .eq("id", responsavel_id)
        .eq("escola_id", quem.escola_id)
        .eq("papel", "responsavel")
        .maybeSingle();
      if (!resp) {
        return json({ error: "responsável não encontrado nesta escola", estado: "erro_validacao" }, 404);
      }

      const { data: existente } = await admin
        .from("vinculos_responsaveis")
        .select("id")
        .eq("aluno_id", aluno_id)
        .eq("responsavel_id", responsavel_id)
        .maybeSingle();

      if (existente) {
        return json({
          estado: "vinculo_ja_existente",
          responsavel_nome: resp.nome,
          aluno_nome: aluno.nome,
        });
      }

      const { error: errV } = await admin.from("vinculos_responsaveis").insert({
        escola_id: quem.escola_id, responsavel_id, aluno_id,
      });
      if (errV) throw errV;

      await registrarLogCoordenacao(quem.escola_id, quem.id, quem.papel, "revinculou-responsavel", {
        responsavel_id,
        aluno_id,
        nome_responsavel: resp.nome,
        nome_aluno: aluno.nome,
      });

      return json({
        estado: "vinculo_reativado",
        responsavel_nome: resp.nome,
        aluno_nome: aluno.nome,
      });
    }

    // ── Gerar credencial de aluno ────────────────────────────────────────────
    if (tipo === "aluno" && aluno.usuario_id) {
      return json({
        error: "este aluno já tem credencial; revogue antes de gerar outra",
        estado: "erro_validacao",
      }, 409);
    }
    if (tipo === "responsavel" && !nome) {
      return json({ error: "informe o nome do responsável", estado: "erro_validacao" }, 400);
    }

    const codigo = novoCodigo();
    const papel = tipo === "aluno" ? "aluno" : "responsavel";
    const nomeUsuario = tipo === "aluno" ? aluno.nome : String(nome);

    const { data: criado, error: errAuth } = await admin.auth.admin.createUser({
      email: emailDoCodigo(codigo),
      password: codigo,
      email_confirm: true,
      app_metadata: { escola_id: quem.escola_id, papel },
      user_metadata: { nome: nomeUsuario, provisionado_por: quem.id },
    });
    if (errAuth) throw errAuth;
    const usuarioId = criado.user.id;

    // desfazer manual de cada passo evita conta órfã se algo falhar
    try {
      const { error: e1 } = await admin.from("usuarios").insert({
        id: usuarioId, escola_id: quem.escola_id, papel, nome: nomeUsuario,
      });
      if (e1) throw e1;

      if (tipo === "aluno") {
        const { error: e2 } = await admin.from("alunos")
          .update({ usuario_id: usuarioId }).eq("id", aluno_id);
        if (e2) throw e2;
      } else {
        const { error: e2 } = await admin.from("vinculos_responsaveis").insert({
          escola_id: quem.escola_id, responsavel_id: usuarioId, aluno_id,
        });
        if (e2) throw e2;
      }
    } catch (e) {
      await admin.auth.admin.deleteUser(usuarioId).catch(() => {});
      await admin.from("usuarios").delete().eq("id", usuarioId);
      throw e;
    }

    const estado = tipo === "aluno" ? "aluno_criado" : "responsavel_criado";
    await registrarLogAcesso(quem.escola_id, aluno_id, quem.id, quem.papel, `provisionou-${tipo}`);

    return json({ codigo, papel, nome: nomeUsuario, estado });
  } catch (e) {
    console.error("provisionar-aluno:", e);
    return json({ error: "falha ao provisionar acesso", estado: "erro_interno" }, 500);
  }
});
