// ============================================================
// gerar-meta — monta a meta da semana corrente de um aluno
// ------------------------------------------------------------
// A coordenação chama logo após cadastrar/provisionar um aluno,
// para a meta existir na hora (sem esperar a virada agendada).
// A geração em si roda no banco (app.gerar_meta), com privilégio
// que o front não tem: nem aluno nem coordenação escrevem meta.
// ============================================================
import { admin, chamador, alunoDaEscola, corsHeaders } from "../_shared/contexto.ts";

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
    if (quem.papel !== "coordenacao") return json({ error: "só a coordenação dispara geração de meta" }, 403);

    const { aluno_id } = await req.json().catch(() => ({}));
    if (!aluno_id) return json({ error: "informe aluno_id" }, 400);

    const aluno = await alunoDaEscola(aluno_id, quem.escola_id);
    if (!aluno) return json({ error: "aluno não encontrado nesta escola" }, 404);
    if (!aluno.trilha_id) return json({ error: "aluno sem trilha atribuída" }, 422);

    const { data, error } = await admin.rpc("motor_gerar_meta", { p_aluno: aluno_id });
    if (error) throw error;

    return json({ meta_id: data });
  } catch (e) {
    console.error("gerar-meta:", e);
    return json({ error: "falha ao gerar meta" }, 500);
  }
});
