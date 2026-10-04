// ============================================================
// Quest API — cliente, normalização e medição de cobertura (P1.1)
// ------------------------------------------------------------
// Puro de propósito: sem import de rede nem de Deno. O fetch, a base e a
// chave entram por parâmetro, e o teste roda este arquivo no Node com um
// fetch falso (tests/p11-quest-edge.test.mjs).
//
// CONTRATO DA API: NÃO CONFERIDO CONTRA DOCUMENTAÇÃO OFICIAL.
// Reconstruído de uma integração pública de terceiros (GET /v2/questoes,
// cabeçalho X-API-Key, envelope {data: {items, total, next_cursor}},
// filtros banca/materia/assunto/assunto_id/page/per_page, e os erros 401,
// 402, 403 e 429). O domínio api.quest.api.br não é alcançável do
// ambiente em que isto foi escrito. Antes de ligar o botão, a primeira
// rodada de scripts/quest-cobertura.mjs confirma (ou derruba) o formato:
// resposta fora do esperado vira erro 'formato', nunca questão inventada.
//
// O que não sai daqui: a chave (nem em log, nem em erro), enunciado em
// log, dado de aluno. Os erros carregam só tipo e status HTTP.
// ============================================================

export const BASE_PADRAO = "https://api.quest.api.br";
export const TIMEOUT_PADRAO_MS = 8000;

export type FiltroMissao = {
  materia: string;
  assunto?: string | null;
  assunto_id?: string | null;
};

export type Alternativa = { letra: string; texto: string };

export type QuestaoNormalizada = {
  id_externo: string;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  ano: number | null;
  materia: string | null;
  assunto: string | null;
  tipo: "multipla_escolha" | "certo_errado";
  enunciado: string;
  alternativas: Alternativa[];
  gabarito: string;
  anulada: boolean;
  desatualizada: boolean;
};

export type TipoErroQuest =
  | "sem_chave" | "chave" | "cota" | "plano" | "limite" | "timeout" | "rede" | "indisponivel" | "formato";

export class QuestErro extends Error {
  tipo: TipoErroQuest;
  status: number | null;
  constructor(tipo: TipoErroQuest, status: number | null = null) {
    super(`quest: ${tipo}${status ? ` (HTTP ${status})` : ""}`);
    this.tipo = tipo;
    this.status = status;
  }
}

export type DepsQuest = {
  fetch: typeof fetch;
  chave: string | undefined | null;
  base?: string;
  timeoutMs?: number;
};

// Filtros fixos: só questão com gabarito, não anulada, não desatualizada
// e sem anexo/imagem (a tela não reproduz figura com fidelidade).
export function montarConsulta(
  filtro: FiltroMissao,
  opcoes: { pagina?: number; porPagina?: number; banca?: string | null } = {},
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("materia", filtro.materia);
  if (filtro.assunto_id) p.set("assunto_id", filtro.assunto_id);
  else if (filtro.assunto) p.set("assunto", filtro.assunto);
  if (opcoes.banca) p.set("banca", opcoes.banca);
  p.set("tem_gabarito", "true");
  p.set("include_gabarito", "true");
  p.set("anulada", "false");
  p.set("desatualizada", "false");
  p.set("tem_anexos", "false");
  p.set("page", String(Math.max(1, Math.trunc(opcoes.pagina ?? 1))));
  p.set("per_page", String(Math.min(100, Math.max(1, Math.trunc(opcoes.porPagina ?? 50)))));
  return p;
}

const ERRO_POR_STATUS: Record<number, TipoErroQuest> = { 401: "chave", 402: "cota", 403: "plano", 429: "limite" };

export async function buscarQuest(
  deps: DepsQuest,
  params: URLSearchParams,
): Promise<{ itens: unknown[]; total: number | null; proximo: string | null }> {
  if (!deps.chave) throw new QuestErro("sem_chave");
  const base = (deps.base || BASE_PADRAO).replace(/\/+$/, "");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? TIMEOUT_PADRAO_MS);
  let resp: Response;
  try {
    resp = await deps.fetch(`${base}/v2/questoes?${params}`, {
      method: "GET",
      headers: { "X-API-Key": deps.chave, Accept: "application/json" },
      signal: ctl.signal,
    });
  } catch (e) {
    throw new QuestErro((e as Error)?.name === "AbortError" ? "timeout" : "rede");
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    throw new QuestErro(ERRO_POR_STATUS[resp.status] ?? (resp.status >= 500 ? "indisponivel" : "formato"), resp.status);
  }
  let corpo: any;
  try {
    corpo = await resp.json();
  } catch {
    throw new QuestErro("formato", resp.status);
  }
  const dados = corpo?.data;
  if (!dados || !Array.isArray(dados.items)) throw new QuestErro("formato", resp.status);
  const total = Number.isFinite(Number(dados.total)) && dados.total !== null && dados.total !== undefined
    ? Number(dados.total) : null;
  return { itens: dados.items, total, proximo: typeof dados.next_cursor === "string" ? dados.next_cursor : null };
}

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const n = (v as Record<string, unknown>).nome ?? (v as Record<string, unknown>).sigla;
    return typeof n === "string" && n.trim() ? n.trim() : null;
  }
  const s = String(v).trim();
  return s ? s : null;
};

const temMidia = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : !!v && typeof v === "object" ? Object.keys(v as object).length > 0 : !!v;

const IMG_NO_TEXTO = /<img\b|!\[[^\]]*\]\(/i;

// Converte um item da Quest no formato que o banco guarda. Devolve null
// (questão descartada) quando não dá para corrigir com segurança: sem
// id, sem gabarito, gabarito fora das alternativas, com imagem/anexo,
// anulada ou desatualizada.
export function normalizarQuestao(item: any): QuestaoNormalizada | null {
  if (!item || typeof item !== "object") return null;
  const id = texto(item.id);
  const enunciado = typeof item.enunciado === "string" ? item.enunciado.trim() : "";
  if (!id || !enunciado || enunciado.length > 20000) return null;
  if (item.anulada === true || item.desatualizada === true) return null;
  if (temMidia(item.anexos) || temMidia(item.imagens) || IMG_NO_TEXTO.test(enunciado)) return null;

  const prova = item.prova ?? {};
  const classe = item.classificacao ?? {};
  const bruto = String(item.gabarito ?? "").trim().toUpperCase();
  const tipoProva = String(prova.alternative_type ?? item.tipo ?? "").toLowerCase();
  const semAlternativas = !Array.isArray(item.alternativas) || item.alternativas.length <= 2;
  const ehCertoErrado = semAlternativas &&
    (/certo|errado|true_false|verdadeiro/.test(tipoProva) || ["CERTO", "ERRADO"].includes(bruto));

  let tipo: QuestaoNormalizada["tipo"];
  let alternativas: Alternativa[];
  let gabarito: string;
  if (ehCertoErrado) {
    tipo = "certo_errado";
    alternativas = [{ letra: "C", texto: "Certo" }, { letra: "E", texto: "Errado" }];
    gabarito = ["CERTO", "C", "TRUE", "V"].includes(bruto) ? "C" : ["ERRADO", "E", "FALSE", "F"].includes(bruto) ? "E" : "";
  } else {
    tipo = "multipla_escolha";
    if (!Array.isArray(item.alternativas) || item.alternativas.length < 2 || item.alternativas.length > 10) return null;
    alternativas = [];
    for (const [i, alt] of item.alternativas.entries()) {
      if (!alt || typeof alt !== "object") return null;
      if (temMidia(alt.imagens) || temMidia(alt.anexos)) return null;
      const letra = String(alt.letra ?? String.fromCharCode(65 + i)).trim().toUpperCase();
      const t = typeof alt.texto === "string" ? alt.texto.trim() : "";
      if (!/^[A-J]$/.test(letra) || !t || IMG_NO_TEXTO.test(t)) return null;
      alternativas.push({ letra, texto: t });
    }
    if (new Set(alternativas.map((a) => a.letra)).size !== alternativas.length) return null;
    gabarito = bruto;
  }
  if (!alternativas.some((a) => a.letra === gabarito)) return null;

  const anoBruto = Number(prova.ano ?? item.ano);
  return {
    id_externo: id.slice(0, 100),
    banca: texto(prova.banca ?? item.banca),
    orgao: texto(prova.orgao ?? item.orgao),
    cargo: texto(prova.cargo ?? item.cargo),
    ano: Number.isInteger(anoBruto) && anoBruto >= 1950 && anoBruto <= 2100 ? anoBruto : null,
    materia: texto(classe.materia ?? item.materia),
    assunto: texto(classe.assunto ?? item.assunto),
    tipo,
    enunciado,
    alternativas,
    gabarito,
    anulada: false,
    desatualizada: false,
  };
}

// ── cobertura ─────────────────────────────────────────────────────────

export type MissaoCobertura = FiltroMissao & { chave: string; nome?: string; materia_codigo?: string };
export type LinhaCobertura = {
  chave: string;
  nome?: string;
  materia_codigo?: string;
  filtro: FiltroMissao;
  total: number | null;
  por_banca: Record<string, number | null>;
  outras: number | null;
  utilizaveis_amostra: number | null;
  amostra: number;
  erro: TipoErroQuest | null;
};

// Para cada missão: total com os filtros fixos, total por banca e o que
// sobra ("outras"). "utilizaveis_amostra" conta, numa página de amostra,
// quantas passam na normalização (gabarito utilizável, sem imagem): o
// total da Quest não sabe disso. Chamadas em série, para não estourar o
// limite do fornecedor.
export async function medirCobertura(
  deps: DepsQuest,
  missoes: MissaoCobertura[],
  bancas: string[],
  amostra = 20,
): Promise<LinhaCobertura[]> {
  const linhas: LinhaCobertura[] = [];
  for (const m of missoes) {
    const filtro: FiltroMissao = { materia: m.materia, assunto: m.assunto ?? null, assunto_id: m.assunto_id ?? null };
    const linha: LinhaCobertura = {
      chave: m.chave, nome: m.nome, materia_codigo: m.materia_codigo, filtro,
      total: null, por_banca: {}, outras: null, utilizaveis_amostra: null, amostra: 0, erro: null,
    };
    try {
      const geral = await buscarQuest(deps, montarConsulta(filtro, { porPagina: amostra }));
      linha.total = geral.total;
      linha.amostra = geral.itens.length;
      linha.utilizaveis_amostra = geral.itens.filter((i) => normalizarQuestao(i) !== null).length;
      for (const b of bancas) {
        const r = await buscarQuest(deps, montarConsulta(filtro, { banca: b, porPagina: 1 }));
        linha.por_banca[b] = r.total;
      }
      const somas = Object.values(linha.por_banca);
      linha.outras = linha.total === null || somas.some((v) => v === null)
        ? null
        : Math.max(0, linha.total - somas.reduce((s: number, v) => s + (v as number), 0));
    } catch (e) {
      linha.erro = e instanceof QuestErro ? e.tipo : "rede";
      // sem chave, chave errada, cota ou plano: nenhuma missão vai passar
      if (e instanceof QuestErro && ["sem_chave", "chave", "cota", "plano"].includes(e.tipo)) {
        linhas.push(linha);
        for (const resto of missoes.slice(missoes.indexOf(m) + 1)) {
          linhas.push({
            chave: resto.chave, nome: resto.nome, materia_codigo: resto.materia_codigo,
            filtro: { materia: resto.materia, assunto: resto.assunto ?? null, assunto_id: resto.assunto_id ?? null },
            total: null, por_banca: {}, outras: null, utilizaveis_amostra: null, amostra: 0, erro: e.tipo,
          });
        }
        return linhas;
      }
    }
    linhas.push(linha);
  }
  return linhas;
}
