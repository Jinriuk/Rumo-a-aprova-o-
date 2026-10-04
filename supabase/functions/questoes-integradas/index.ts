// ============================================================
// questoes-integradas — Quest API dentro da missão (P1.1)
// ------------------------------------------------------------
// Seção 9 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_
// Auditoria_do_Banco.md. Regras no banco (0065); aqui só a ponte com a
// Quest e a identidade de quem chama.
//
// AÇÕES (POST, corpo JSON com `acao`)
//   entregar   aluno. {missao_id, pedido_id, tamanho?} → lote SEM gabarito.
//              pedido_id (uuid do navegador) torna a retransmissão segura.
//   responder  aluno. {entrega_id, questao_id, resposta, duracao_ms?} →
//              correção feita no banco; uma tentativa por aluno e questão.
//   cobertura  super_admin ativo. {missoes: [{chave, materia, assunto?,
//              assunto_id?}], bancas?} → totais por missão e banca. Não
//              grava nada. Usada por scripts/quest-cobertura.mjs ANTES de
//              ligar o botão.
//
// SEGREDO: QUEST_API_KEY só em Edge Functions › Secrets. Nunca em VITE_,
//   nunca no repositório, nunca em log. QUEST_API_BASE_URL é opcional.
//
// FALHA DO FORNECEDOR: timeout de 8 s, sem retry dentro do pedido do
//   aluno (a busca é GET, mas o aluno está esperando e a cota é paga).
//   Fornecedor fora e nada guardado → 503 com fallback 'registro_manual'
//   (o 5xx vai ao coletor com correlation_id; sem enunciado, sem aluno).
//   O registro manual não passa por aqui e segue funcionando.
// ============================================================
import { admin, chamador, corsHeaders } from "../_shared/contexto.ts";
import { escolaOperacional, RESPOSTA_ESCOLA_PARADA } from "../_shared/escola.ts";
import { comRelato5xx } from "../_shared/coletor-servidor.ts";
import {
  buscarQuest, type DepsQuest, medirCobertura, type MissaoCobertura, montarConsulta, normalizarQuestao, QuestErro,
} from "../_shared/quest.ts";

const POR_PAGINA = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BANCAS_PADRAO = ["CESGRANRIO", "FGV"];

const deps = (): DepsQuest => ({
  fetch,
  chave: Deno.env.get("QUEST_API_KEY"),
  base: Deno.env.get("QUEST_API_BASE_URL") ?? undefined,
});

// estado do banco → status HTTP. O corpo sempre leva `estado`.
const STATUS: Record<string, number> = {
  ok: 200, sem_questoes: 200, indisponivel: 409, fora_da_vez: 409, missao_invalida: 422,
  pedido_invalido: 400, resposta_invalida: 400, nao_encontrada: 404, expirada: 410, anulada: 409,
  limite: 429, sem_aluno: 403,
};

async function superAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: ia } = await admin.from("internal_admins").select("auth_user_id")
    .eq("auth_user_id", data.user.id).eq("ativo", true).maybeSingle();
  return !!ia;
}

Deno.serve(comRelato5xx("questoes-integradas", async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  const corpo = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!corpo || typeof corpo.acao !== "string") return json({ estado: "pedido_invalido" }, 400);

  try {
    if (corpo.acao === "cobertura") {
      if (!(await superAdmin(req))) return json({ error: "acesso restrito ao super_admin" }, 403);
      const missoes = Array.isArray(corpo.missoes) ? corpo.missoes as MissaoCobertura[] : [];
      if (missoes.length === 0 || missoes.length > 60 ||
          missoes.some((m) => !m || typeof m.chave !== "string" || typeof m.materia !== "string" || !m.materia.trim())) {
        return json({ estado: "pedido_invalido" }, 400);
      }
      const bancas = Array.isArray(corpo.bancas) && corpo.bancas.every((b) => typeof b === "string" && b.trim())
        ? (corpo.bancas as string[]).slice(0, 5) : BANCAS_PADRAO;
      const linhas = await medirCobertura(deps(), missoes, bancas);
      return json({ estado: "ok", bancas, medido_em: new Date().toISOString(), linhas });
    }

    const quem = await chamador(req);
    if (!quem) return json({ error: "não autenticado" }, 401);
    if (quem.papel !== "aluno") return json({ error: "só o aluno resolve questões" }, 403);
    if (!(await escolaOperacional(admin, quem.escola_id))) return json(RESPOSTA_ESCOLA_PARADA, 403);

    if (corpo.acao === "entregar") {
      const { missao_id, pedido_id } = corpo;
      const tamanho = Number.isInteger(corpo.tamanho) ? corpo.tamanho as number : null;
      if (typeof missao_id !== "string" || !UUID.test(missao_id) || typeof pedido_id !== "string" || !UUID.test(pedido_id)) {
        return json({ estado: "pedido_invalido" }, 400);
      }
      const preparar = async (semBusca: boolean) => {
        const { data, error } = await admin.rpc("quest_preparar_entrega", {
          p_usuario: quem.id, p_escola: quem.escola_id, p_missao: missao_id, p_pedido: pedido_id,
          p_tamanho: tamanho, p_sem_busca: semBusca,
        });
        if (error) throw error;
        return data as { estado: string; filtro?: { materia: string; assunto: string | null; assunto_id: string | null; pagina: number } };
      };

      let r = await preparar(false);
      let falhaFornecedor: string | null = null;
      if (r.estado === "buscar" && r.filtro) {
        try {
          const pagina = r.filtro.pagina;
          const res = await buscarQuest(deps(), montarConsulta(r.filtro, { pagina, porPagina: POR_PAGINA }));
          const itens = res.itens.map(normalizarQuestao).filter((q) => q !== null);
          const { error } = await admin.rpc("quest_guardar_questoes", {
            p_missao: missao_id, p_itens: itens, p_proxima_pagina: pagina + 1,
            p_esgotada: res.itens.length < POR_PAGINA,
          });
          if (error) throw error;
          console.log(`questoes-integradas: busca pagina=${pagina} recebidos=${res.itens.length} guardados=${itens.length}`);
        } catch (e) {
          if (!(e instanceof QuestErro)) throw e;
          falhaFornecedor = e.tipo;
          console.error(`questoes-integradas: fornecedor ${e.message}`);
        }
        r = await preparar(true);
      }

      if (r.estado === "sem_questoes") {
        return falhaFornecedor
          ? json({ estado: "fornecedor_indisponivel", fallback: "registro_manual" }, 503)
          : json({ estado: "sem_questoes", fallback: "registro_manual" });
      }
      return json(r, STATUS[r.estado] ?? 500);
    }

    if (corpo.acao === "responder") {
      const { entrega_id, questao_id, resposta } = corpo;
      if (typeof entrega_id !== "string" || !UUID.test(entrega_id) ||
          typeof questao_id !== "string" || !UUID.test(questao_id) || typeof resposta !== "string") {
        return json({ estado: "pedido_invalido" }, 400);
      }
      const duracao = Number.isInteger(corpo.duracao_ms) ? corpo.duracao_ms as number : null;
      const { data, error } = await admin.rpc("quest_responder", {
        p_usuario: quem.id, p_escola: quem.escola_id, p_entrega: entrega_id, p_questao: questao_id,
        p_resposta: resposta.slice(0, 5), p_duracao_ms: duracao,
      });
      if (error) throw error;
      const r = data as { estado: string };
      return json(r, STATUS[r.estado] ?? 500);
    }

    return json({ estado: "pedido_invalido" }, 400);
  } catch (e) {
    console.error("questoes-integradas:", (e as Error)?.message ?? e);
    return json({ estado: "erro", fallback: "registro_manual" }, 500);
  }
}));
