// ============================================================
// gerar-meta — monta a meta da semana corrente de um aluno
// ------------------------------------------------------------
// A coordenação chama logo após cadastrar/provisionar um aluno,
// para a meta existir na hora (sem esperar a virada agendada). A
// geração em si roda no banco, com privilégio que o front não tem: nem
// aluno nem coordenação escrevem meta.
//
// Tarefa 2: usa motor_gerar_meta_segura (0046) em vez do motor_gerar_meta
// cru — é IDEMPOTENTE (reaproveita app.gerar_meta_protegida da 0039: não
// duplica meta se ela já existe pra semana corrente) e por isso serve
// tanto pro cadastro quanto pro reprocessamento manual de um aluno
// pendente_configuracao. Se a geração falhar de verdade (trilha sem
// semana pra hoje, erro do motor), o aluno fica marcado
// pendente_configuracao — a resposta da API mostra o erro real, nunca um
// falso sucesso. "sem trilha atribuída" NÃO é essa falha: é um estado
// válido (concurso sem trilha semanal, ex.: PED2) e não marca pendente.
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
    if (!aluno.trilha_id) return json({ error: "aluno sem trilha atribuída", estado: "sem_trilha" }, 422);

    const { data, error } = await admin.rpc("motor_gerar_meta_segura", { p_aluno: aluno_id });
    if (error) throw error;

    const resultado = (data as { resultado?: string; erro?: string } | null)?.resultado;
    if (resultado !== "gerada" && resultado !== "ja_tinha") {
      const mensagem = (data as { erro?: string } | null)?.erro ?? "falha ao gerar meta";
      await admin.from("alunos")
        .update({ status_provisionamento: "pendente_configuracao" })
        .eq("id", aluno_id);
      return json({ error: mensagem, estado: "erro_meta" }, 500);
    }

    // meta confirmada — limpa um pendente anterior (idempotente: sem
    // custo se o aluno já estava 'ok').
    await admin.from("alunos")
      .update({ status_provisionamento: "ok" })
      .eq("id", aluno_id)
      .eq("status_provisionamento", "pendente_configuracao");

    return json({ estado: resultado });
  } catch (e) {
    console.error("gerar-meta:", e);
    return json({ error: "falha ao gerar meta", estado: "erro_meta" }, 500);
  }
});
