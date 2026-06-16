// ============================================================
// lgpd-titular — pedidos do titular (Doc 6, 4.6)
// ------------------------------------------------------------
// A escola (controladora) pede exportar ou apagar o dado de um
// aluno. Exportar devolve o dossiê JSON completo. Apagar remove o
// dado de estudo, o aluno e as contas de acesso (aluno e
// responsáveis que ficarem sem vínculo). Ambos ficam no log.
// ============================================================
import { admin, chamador, alunoDaEscola, cors, json, registrarLog } from "../_shared/contexto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  try {
    const quem = await chamador(req);
    if (!quem) return json({ error: "não autenticado" }, 401);
    if (quem.papel !== "coordenacao") {
      return json({ error: "pedidos do titular passam pela coordenação (controladora)" }, 403);
    }

    const { acao, aluno_id } = await req.json().catch(() => ({}));
    if (!aluno_id || !["exportar", "excluir"].includes(acao)) {
      return json({ error: "informe acao ('exportar' | 'excluir') e aluno_id" }, 400);
    }

    const aluno = await alunoDaEscola(aluno_id, quem.escola_id);
    if (!aluno) return json({ error: "aluno não encontrado nesta escola" }, 404);

    if (acao === "exportar") {
      const { data, error } = await admin.rpc("lgpd_exportar", { p_aluno: aluno_id });
      if (error) throw error;
      await registrarLog(quem.escola_id, aluno_id, quem.id, quem.papel, "exportacao-lgpd");
      return json({ dossie: data });
    }

    // excluir: primeiro o log (a linha sobrevive, sem FK ao aluno)
    await registrarLog(quem.escola_id, aluno_id, quem.id, quem.papel, "exclusao-lgpd");
    const { data, error } = await admin.rpc("lgpd_excluir", { p_aluno: aluno_id });
    if (error) throw error;

    const contas: string[] = data?.usuarios_removidos ?? [];
    for (const id of contas) {
      const { error: e } = await admin.auth.admin.deleteUser(id);
      if (e) console.error(`lgpd-titular: conta ${id} não removida do Auth:`, e.message);
    }

    return json({ ok: true, contas_removidas: contas.length });
  } catch (e) {
    console.error("lgpd-titular:", e);
    return json({ error: "falha no pedido do titular" }, 500);
  }
});
