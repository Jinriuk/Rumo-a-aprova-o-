// ============================================================
// provisionar-aluno — gera a credencial de acesso (Doc 6, 1.1)
// ------------------------------------------------------------
// O aluno é menor: ele NÃO cria conta. A coordenação cadastra e
// esta função gera o código de acesso, que a escola entrega.
// O mesmo fluxo provisiona o acesso de leitura do responsável,
// vinculado ao aluno.
//
// O código é credencial completa (identifica e autentica). Ele é
// mostrado UMA vez para a coordenação e não fica legível depois.
// ============================================================
import { admin, chamador, alunoDaEscola, cors, json, registrarLog } from "../_shared/contexto.ts";

// sem 0/O/1/I/L pra credencial ser ditável por telefone sem erro
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function novoCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

// e-mail sintético derivado do código: o aluno digita SÓ o código
const emailDoCodigo = (codigo: string) =>
  `${codigo.replace(/-/g, "").toLowerCase()}@codigo.acesso.local`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  try {
    const quem = await chamador(req);
    if (!quem) return json({ error: "não autenticado" }, 401);
    if (quem.papel !== "coordenacao") return json({ error: "só a coordenação provisiona acesso" }, 403);

    const { tipo, aluno_id, nome } = await req.json().catch(() => ({}));
    if (!aluno_id || !["aluno", "responsavel"].includes(tipo)) {
      return json({ error: "informe tipo ('aluno' | 'responsavel') e aluno_id" }, 400);
    }

    const aluno = await alunoDaEscola(aluno_id, quem.escola_id);
    if (!aluno) return json({ error: "aluno não encontrado nesta escola" }, 404);

    if (tipo === "aluno" && aluno.usuario_id) {
      return json({ error: "este aluno já tem credencial; revogue antes de gerar outra" }, 409);
    }
    if (tipo === "responsavel" && !nome) {
      return json({ error: "informe o nome do responsável" }, 400);
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

    // o desfazer manual de cada passo evita conta órfã se algo falhar
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

    await registrarLog(quem.escola_id, aluno_id, quem.id, quem.papel, `provisionou-${tipo}`);

    return json({ codigo, papel, nome: nomeUsuario });
  } catch (e) {
    console.error("provisionar-aluno:", e);
    return json({ error: "falha ao provisionar acesso" }, 500);
  }
});
