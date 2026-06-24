// ============================================================
// revogar-responsavel — revoga o acesso de um responsável
// ------------------------------------------------------------
// Segurança:
//   - chamador validado pelo token real (não por campo de form)
//   - só coordenação da mesma escola revoga
//   - verifica que o vínculo pertence à escola antes de agir
//   - remove: vinculos_responsaveis + usuarios + auth.users
//   - registra logs_coordenacao (ação sensível)
//   - service_role só aqui (nunca no navegador)
// ============================================================
import { admin, chamador, cors, json } from "../_shared/contexto.ts";

async function registrarLogCoordenacao(
  escolaId: string,
  usuarioId: string,
  detalhe: Record<string, unknown>,
) {
  const { error } = await admin.from("logs_coordenacao").insert({
    escola_id: escolaId,
    usuario_id: usuarioId,
    papel: "coordenacao",
    acao: "revogou-responsavel",
    entidade: "responsavel",
    detalhe,
  });
  if (error) console.error("log revogar-responsavel:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  try {
    const quem = await chamador(req);
    if (!quem) return json({ error: "não autenticado" }, 401);
    if (quem.papel !== "coordenacao") return json({ error: "só a coordenação revoga acesso" }, 403);

    const { vinculo_id } = await req.json().catch(() => ({}));
    if (!vinculo_id) return json({ error: "informe vinculo_id" }, 400);

    const { data: vinculo, error: errV } = await admin
      .from("vinculos_responsaveis")
      .select("id, escola_id, responsavel_id, aluno_id")
      .eq("id", vinculo_id)
      .eq("escola_id", quem.escola_id)
      .maybeSingle();
    if (errV) return json({ error: "erro ao consultar vínculo" }, 500);
    if (!vinculo) return json({ error: "vínculo não encontrado nesta escola" }, 404);

    const { data: usuario } = await admin
      .from("usuarios")
      .select("id, nome")
      .eq("id", vinculo.responsavel_id)
      .maybeSingle();

    const { error: e1 } = await admin
      .from("vinculos_responsaveis")
      .delete()
      .eq("id", vinculo_id);
    if (e1) return json({ error: "falha ao remover vínculo" }, 500);

    const { error: e2 } = await admin
      .from("usuarios")
      .delete()
      .eq("id", vinculo.responsavel_id);
    if (e2) console.error("revogar-responsavel: falha ao remover usuario:", e2.message);

    const { error: e3 } = await admin.auth.admin.deleteUser(vinculo.responsavel_id);
    if (e3) console.error("revogar-responsavel: falha ao remover auth.user:", e3.message);

    await registrarLogCoordenacao(quem.escola_id, quem.id, {
      vinculo_id,
      responsavel_id: vinculo.responsavel_id,
      aluno_id: vinculo.aluno_id,
      nome_responsavel: usuario?.nome ?? null,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("revogar-responsavel:", (e as Error)?.message ?? "erro desconhecido");
    return json({ error: "falha ao revogar acesso" }, 500);
  }
});
