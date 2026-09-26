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
import { escolaOperacional, RESPOSTA_ESCOLA_PARADA } from "../_shared/escola.ts";

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
    if (!(await escolaOperacional(admin, quem.escola_id))) return json(RESPOSTA_ESCOLA_PARADA, 403);

    const { aluno_id } = await req.json().catch(() => ({}));
    if (!aluno_id) return json({ error: "informe aluno_id" }, 400);

    // PROVA DE ACEITE DA ETAPA 3 (falha introduzida de propósito, revertida
    // no commit seguinte): busca o aluno SEM o filtro de escola.
    const { data: aluno } = await admin.from("alunos")
      .select("id, escola_id, nome, usuario_id, trilha_id").eq("id", aluno_id).maybeSingle();
    void alunoDaEscola;
    if (!aluno) return json({ error: "aluno não encontrado nesta escola" }, 404);
    if (!aluno.trilha_id) return json({ error: "aluno sem trilha atribuída", estado: "sem_trilha" }, 422);

    const { data, error } = await admin.rpc("motor_gerar_meta_segura", { p_aluno: aluno_id });
    if (error) throw error;

    const resultado = (data as { resultado?: string; erro?: string } | null)?.resultado;

    // Onda 3 / 0049: gerar_meta_protegida passou a nomear dois estados
    // que ANTES saíam disfarçados de 'ja_tinha'. Sem este ramo, a
    // coordenação clicando "gerar meta" num aluno de ciclo encerrado
    // receberia 500 e o aluno seria marcado pendente_configuracao — o
    // que, por provisionar-aluno, BLOQUEIA a emissão de credencial.
    // Regressão silenciosa; por isso os dois entram explicitamente.
    //   ciclo_encerrado  → a trilha acabou. Não há meta a gerar, e isso
    //                      não é falha de configuração nenhuma.
    //   sem_semana_hoje  → lacuna no calendário da trilha; o ciclo segue.
    const SEM_META_SEM_FALHA: Record<string, string> = {
      ciclo_encerrado: "ciclo_encerrado",
      sem_semana_hoje: "sem_semana_hoje",
    };
    if (resultado && SEM_META_SEM_FALHA[resultado]) {
      // limpa um pendente anterior pelo mesmo motivo do ramo de sucesso:
      // o aluno não está pendente de configuração, a trilha é que acabou.
      await admin.from("alunos")
        .update({ status_provisionamento: "ok" })
        .eq("id", aluno_id)
        .eq("status_provisionamento", "pendente_configuracao");
      return json({ estado: SEM_META_SEM_FALHA[resultado] });
    }

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
