// ============================================================
// Quest API — cliente, normalização e medição de cobertura (P1.1)
// ------------------------------------------------------------
// Puro de propósito: sem import de rede nem de Deno. O fetch, a base e a
// chave entram por parâmetro, e o teste roda este arquivo no Node com um
// fetch falso (tests/p11-quest-edge.test.mjs).
//
// CONTRATO DA API: conferido pelo dono na documentação oficial em 04/10
// (quest.api.br/docs/endpoints/questoes e /docs/paginacao): base
// https://api.quest.api.br/v2, cabeçalho X-API-Key, resposta
// {data: {items, total}}, per_page até 100, include_gabarito=true embute
// o gabarito, paginação por cursor after_id. Banca, materia e assunto
// exigem o valor EXATO da Quest (GET /v2/filtros/materias e
// /v2/filtros/assuntos, parâmetro q).
// CUSTO: 3 créditos por questão entregue sem gabarito, 6 com gabarito.
// Por isso: gabarito só na busca para o aluno, nunca na medição, e a
// medição pede per_page=1 (o total vem no envelope).
//
// O que não sai daqui: a chave (nem em log, nem em erro), enunciado em
// log, dado de aluno. Os erros carregam só tipo e status HTTP.
// ============================================================

export const BASE_PADRAO = "https://api.quest.api.br/v2";
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
// `gabarito: true` embute o gabarito (6 créditos por questão, contra 3):
// só na busca que abastece o lote do aluno.
export function montarConsulta(
  filtro: FiltroMissao,
  opcoes: { porPagina?: number; banca?: string | null; gabarito?: boolean; afterId?: string | null } = {},
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("materia", filtro.materia);
  if (filtro.assunto_id) p.set("assunto_id", filtro.assunto_id);
  else if (filtro.assunto) p.set("assunto", filtro.assunto);
  if (opcoes.banca) p.set("banca", opcoes.banca);
  p.set("tem_gabarito", "true");
  if (opcoes.gabarito) p.set("include_gabarito", "true");
  p.set("anulada", "false");
  p.set("desatualizada", "false");
  p.set("tem_anexos", "false");
  if (opcoes.afterId) p.set("after_id", opcoes.afterId);
  p.set("per_page", String(Math.min(100, Math.max(1, Math.trunc(opcoes.porPagina ?? 1)))));
  return p;
}

// Aceita base com ou sem /v2 (o secret QUEST_API_BASE_URL pode vir de
// qualquer jeito); devolve sempre ".../v2".
export function baseV2(base?: string | null): string {
  const b = (base || BASE_PADRAO).replace(/\/+$/, "");
  return /\/v2$/.test(b) ? b : `${b}/v2`;
}

const ERRO_POR_STATUS: Record<number, TipoErroQuest> = { 401: "chave", 402: "cota", 403: "plano", 429: "limite" };

async function getQuest(deps: DepsQuest, caminho: string, params: URLSearchParams): Promise<any> {
  if (!deps.chave) throw new QuestErro("sem_chave");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? TIMEOUT_PADRAO_MS);
  let resp: Response;
  try {
    resp = await deps.fetch(`${baseV2(deps.base)}${caminho}?${params}`, {
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
  try {
    return await resp.json();
  } catch {
    throw new QuestErro("formato", resp.status);
  }
}

export async function buscarQuest(
  deps: DepsQuest,
  params: URLSearchParams,
): Promise<{ itens: unknown[]; total: number | null; proximo: string | null }> {
  const corpo = await getQuest(deps, "/questoes", params);
  const dados = corpo?.data;
  if (!dados || !Array.isArray(dados.items)) throw new QuestErro("formato");
  const total = Number.isFinite(Number(dados.total)) && dados.total !== null && dados.total !== undefined
    ? Number(dados.total) : null;
  // cursor da próxima página: o que a API devolver; senão o id do último item (after_id)
  const ultimo = dados.items.length ? dados.items[dados.items.length - 1]?.id : null;
  const proximo = typeof dados.next_cursor === "string" && dados.next_cursor
    ? dados.next_cursor
    : ultimo != null ? String(ultimo) : null;
  return { itens: dados.items, total, proximo };
}

// Nomes exatos de matéria e assunto na Quest. Não entrega questão.
export async function buscarFiltros(
  deps: DepsQuest,
  tipo: "materias" | "assuntos",
  q: string,
  extra: Record<string, string> = {},
): Promise<unknown[]> {
  const p = new URLSearchParams({ q, ...extra });
  const corpo = await getQuest(deps, `/filtros/${tipo}`, p);
  const itens = corpo?.data?.items ?? corpo?.data ?? corpo?.items;
  if (!Array.isArray(itens)) throw new QuestErro("formato");
  return itens.slice(0, 50);
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
  creditos: number;
  erro: TipoErroQuest | null;
};

const CREDITOS_SEM_GABARITO = 3;

// Para cada missão: total com os filtros fixos, total por banca e o que
// sobra ("outras"). Cada chamada pede per_page=1 e SEM gabarito: o total
// vem no envelope, e o custo é no máximo 3 créditos por chamada.
// Chamadas em série, para não estourar o limite do fornecedor.
export async function medirCobertura(
  deps: DepsQuest,
  missoes: MissaoCobertura[],
  bancas: string[],
): Promise<LinhaCobertura[]> {
  const linhas: LinhaCobertura[] = [];
  const contar = async (linha: LinhaCobertura, banca: string | null) => {
    const r = await buscarQuest(deps, montarConsulta(linha.filtro, { banca, porPagina: 1 }));
    linha.creditos += r.itens.length * CREDITOS_SEM_GABARITO;
    return r.total;
  };
  for (const [i, m] of missoes.entries()) {
    const filtro: FiltroMissao = { materia: m.materia, assunto: m.assunto ?? null, assunto_id: m.assunto_id ?? null };
    const linha: LinhaCobertura = {
      chave: m.chave, nome: m.nome, materia_codigo: m.materia_codigo, filtro,
      total: null, por_banca: {}, outras: null, creditos: 0, erro: null,
    };
    try {
      linha.total = await contar(linha, null);
      // total zero: as bancas também dão zero; não gasta chamada
      for (const b of bancas) linha.por_banca[b] = linha.total === 0 ? 0 : await contar(linha, b);
      const somas = Object.values(linha.por_banca);
      linha.outras = linha.total === null || somas.some((v) => v === null)
        ? null
        : Math.max(0, linha.total - somas.reduce((s: number, v) => s + (v as number), 0));
    } catch (e) {
      linha.erro = e instanceof QuestErro ? e.tipo : "rede";
      // sem chave, chave errada, cota ou plano: nenhuma missão vai passar
      if (e instanceof QuestErro && ["sem_chave", "chave", "cota", "plano"].includes(e.tipo)) {
        linhas.push(linha);
        for (const resto of missoes.slice(i + 1)) {
          linhas.push({
            chave: resto.chave, nome: resto.nome, materia_codigo: resto.materia_codigo,
            filtro: { materia: resto.materia, assunto: resto.assunto ?? null, assunto_id: resto.assunto_id ?? null },
            total: null, por_banca: {}, outras: null, creditos: 0, erro: e.tipo,
          });
        }
        return linhas;
      }
    }
    linhas.push(linha);
  }
  return linhas;
}
