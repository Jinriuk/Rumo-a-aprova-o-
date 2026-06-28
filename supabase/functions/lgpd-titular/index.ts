// ============================================================
// lgpd-titular — pedidos do titular (Doc 6, 4.6)
// ------------------------------------------------------------
// A escola (controladora) pede exportar ou apagar o dado de um
// aluno. Exportar devolve o dossiê JSON completo. Apagar remove o
// dado de estudo, o aluno e as contas de acesso (aluno e
// responsáveis que ficarem sem vínculo). Ambos ficam no log.
//
// SEC3/T75 — ATOMICIDADE banco + Auth:
//   O dado vive em DOIS sistemas sem transação comum (Postgres e
//   GoTrue). Para nunca deixar "banco apagado, conta órfã ainda
//   autenticando" (estado quebrado silencioso), a ordem é:
//     1. levantar (só leitura) as contas que cairão;
//     2. apagar as contas no Auth PRIMEIRO (idempotente: conta já
//        ausente conta como removida);
//     3. se ALGUMA falhar de verdade → ABORTA: o banco fica intacto,
//        o pedido é retryável, e o log registra a interrupção;
//     4. só com TODO o Auth limpo, apagar o banco (app.lgpd_excluir).
//   Resultado: ou os dois lados saem, ou o banco permanece íntegro —
//   nunca o meio-termo silencioso.
// ============================================================
import { admin, chamador, alunoDaEscola, corsHeaders, registrarLog } from "../_shared/contexto.ts";

// Apaga uma conta do Auth de forma IDEMPOTENTE: se a conta já não
// existe, trata como sucesso (a exclusão é o estado desejado). Só conta
// como falha um erro real de remoção de uma conta que ainda existe.
async function removerContaAuth(id: string): Promise<{ ok: boolean; msg?: string }> {
  const { data: existe } = await admin.auth.admin.getUserById(id);
  if (!existe?.user) return { ok: true }; // já removida — idempotente
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, msg: error.message };
  return { ok: true };
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

    // ── excluir (atômico banco+Auth, ordem à prova de estado quebrado) ──

    // 1. quais contas cairão (só leitura, ANTES de apagar nada)
    const { data: contas, error: errLista } = await admin
      .rpc("lgpd_usuarios_do_aluno", { p_aluno: aluno_id });
    if (errLista) throw errLista;
    const ids: string[] = Array.isArray(contas) ? contas : [];

    // log da intenção (a linha sobrevive: logs_acesso não tem FK ao aluno)
    await registrarLog(quem.escola_id, aluno_id, quem.id, quem.papel, "exclusao-lgpd");

    // 2. apagar o Auth PRIMEIRO (idempotente)
    const falhas: string[] = [];
    for (const id of ids) {
      const r = await removerContaAuth(id);
      if (!r.ok) {
        falhas.push(id);
        console.error(`lgpd-titular: conta ${id} não removida do Auth:`, r.msg);
      }
    }

    // 3. alguma falha REAL → ABORTA. Banco intacto, pedido retryável.
    if (falhas.length > 0) {
      await registrarLog(quem.escola_id, aluno_id, quem.id, quem.papel, "exclusao-lgpd-abortada");
      return json({
        error: "exclusão interrompida: contas de acesso não removidas do Auth. " +
          "Nenhum dado do banco foi apagado — tente novamente.",
        estado: "abortada_auth",
        contas_pendentes: falhas.length,
      }, 502);
    }

    // 4. Auth todo limpo → apagar o banco
    const { error: errDb } = await admin.rpc("lgpd_excluir", { p_aluno: aluno_id });
    if (errDb) {
      // contas já removidas, mas o banco não saiu: estado conhecido e
      // ALTO no log (não silencioso). Retry apaga o banco; o Auth já
      // ausente é tratado como ok pela idempotência.
      await registrarLog(quem.escola_id, aluno_id, quem.id, quem.papel, "exclusao-lgpd-db-falha");
      throw errDb;
    }

    return json({ ok: true, estado: "concluida", contas_removidas: ids.length });
  } catch (e) {
    console.error("lgpd-titular:", e);
    return json({ error: "falha no pedido do titular" }, 500);
  }
});
