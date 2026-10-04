// ============================================================
// P1.1 — Quest API: módulo puro, função e ferramenta de cobertura
// ------------------------------------------------------------
// _shared/quest.ts não importa rede: roda aqui (type stripping do Node
// 22) com fetch falso. A função questoes-integradas é travada pela fonte
// (o comportamento de ponta a ponta depende do secret e da stack). O SQL
// dos filtros é aplicado no Postgres local sobre as missões do CFO PMERJ
// geradas pelo P0.3, numa transação desfeita.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./identidades.mjs";
import { carregarFonte, gerarSql, uid } from "../scripts/gerar-seed-trilha-pmerj-cfo.mjs";
import { carregarMapa, validarMapa, montarTabela, gerarSqlFiltros, situacao } from "../scripts/quest-cobertura.mjs";

const Q = await import("../supabase/functions/_shared/quest.ts");

test.after(async () => { await pool.end(); });

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");
const CHAVE = "qk_chave-falsa-de-teste-0123456789";

const itemQuest = (extra = {}) => ({
  id: 9001, enunciado: "Sobre a administração indireta, assinale a correta.", gabarito: "C",
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `alternativa ${l}` })),
  prova: { banca: { nome: "FGV" }, orgao: "PMERJ", cargo: "Oficial", ano: 2024, alternative_type: "multiple_choice" },
  classificacao: { materia: "Direito Administrativo", assunto: "Administração Indireta" },
  ...extra,
});

function fetchFalso(rotas) {
  const chamadas = [];
  const f = async (url, init) => {
    chamadas.push({ url: new URL(url), init });
    const r = rotas(new URL(url), init);
    if (r instanceof Error) throw r;
    return new Response(typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo), { status: r.status ?? 200 });
  };
  f.chamadas = chamadas;
  return f;
}

// ── normalização ─────────────────────────────────────────────────────

test("normaliza múltipla escolha com banca em objeto e mantém as 5 alternativas", () => {
  const q = Q.normalizarQuestao(itemQuest());
  assert.equal(q.id_externo, "9001");
  assert.equal(q.banca, "FGV");
  assert.equal(q.ano, 2024);
  assert.equal(q.tipo, "multipla_escolha");
  assert.equal(q.gabarito, "C");
  assert.equal(q.alternativas.length, 5);
  assert.equal(q.assunto, "Administração Indireta");
});

test("certo/errado vira C/E com as duas alternativas fixas", () => {
  const q = Q.normalizarQuestao(itemQuest({ alternativas: [], gabarito: "ERRADO", prova: { alternative_type: "certo_errado", banca: "CEBRASPE" } }));
  assert.equal(q.tipo, "certo_errado");
  assert.equal(q.gabarito, "E");
  assert.deepEqual(q.alternativas.map((a) => a.letra), ["C", "E"]);
});

test("descarta o que não dá para corrigir com segurança", () => {
  const casos = {
    "sem gabarito": { gabarito: "" },
    "gabarito fora das alternativas": { gabarito: "F" },
    "anulada": { anulada: true },
    "desatualizada": { desatualizada: true },
    "anexo": { anexos: [{ url: "x" }] },
    "imagem no enunciado": { enunciado: 'Veja <img src="x.png"> e responda' },
    "imagem na alternativa": { alternativas: [{ letra: "A", texto: "a", imagens: ["x"] }, { letra: "B", texto: "b" }], gabarito: "A" },
    "letras repetidas": { alternativas: [{ letra: "A", texto: "a" }, { letra: "A", texto: "b" }], gabarito: "A" },
    "sem id": { id: null },
  };
  for (const [nome, extra] of Object.entries(casos)) {
    assert.equal(Q.normalizarQuestao(itemQuest(extra)), null, nome);
  }
});

// ── cliente ──────────────────────────────────────────────────────────

test("consulta leva os filtros fixos, prefere assunto_id, pagina por after_id e só embute gabarito quando pedido", () => {
  const p = Q.montarConsulta({ materia: "Direito Penal", assunto: "Prescrição", assunto_id: "77" }, { afterId: "q-90", porPagina: 500, banca: "FGV" });
  assert.equal(p.get("assunto_id"), "77");
  assert.equal(p.get("assunto"), null);
  for (const [k, v] of [["tem_gabarito", "true"], ["anulada", "false"], ["tem_anexos", "false"], ["after_id", "q-90"], ["per_page", "100"], ["banca", "FGV"]]) {
    assert.equal(p.get(k), v, k);
  }
  assert.equal(p.get("include_gabarito"), null, "sem pedir, sem gabarito (3 créditos, não 6)");
  assert.equal(p.get("page"), null);
  assert.equal(p.get("desatualizada"), null, "a Quest recusa o filtro desatualizada (422)");
  assert.equal(Q.montarConsulta({ materia: "x" }).get("per_page"), "1", "padrão: 1 por chamada");
  assert.equal(Q.montarConsulta({ materia: "x" }, { gabarito: true }).get("include_gabarito"), "true");
  assert.equal(Q.baseV2("https://api.quest.api.br"), "https://api.quest.api.br/v2");
  assert.equal(Q.baseV2("https://api.quest.api.br/v2/"), "https://api.quest.api.br/v2");
});

test("a chave vai só no cabeçalho, nunca na URL", async () => {
  const f = fetchFalso(() => ({ corpo: { data: { items: [itemQuest()], total: 1 } } }));
  const r = await Q.buscarQuest({ fetch: f, chave: CHAVE }, Q.montarConsulta({ materia: "x" }));
  assert.equal(r.total, 1);
  assert.equal(f.chamadas[0].url.origin + f.chamadas[0].url.pathname, "https://api.quest.api.br/v2/questoes");
  assert.equal(r.proximo, "9001", "sem next_cursor, o cursor é o id do último item (after_id)");
  assert.equal(f.chamadas[0].init.headers["X-API-Key"], CHAVE);
  assert.ok(!f.chamadas[0].url.href.includes(CHAVE));
});

test("erros do fornecedor viram tipos, sem a chave na mensagem", async () => {
  const casos = [[401, "chave"], [402, "cota"], [403, "plano"], [429, "limite"], [500, "indisponivel"], [503, "indisponivel"], [404, "formato"]];
  for (const [status, tipo] of casos) {
    const f = fetchFalso(() => ({ status, corpo: { erro: "x" } }));
    await assert.rejects(Q.buscarQuest({ fetch: f, chave: CHAVE }, Q.montarConsulta({ materia: "x" })),
      (e) => e instanceof Q.QuestErro && e.tipo === tipo && !e.message.includes(CHAVE), `HTTP ${status}`);
  }
  await assert.rejects(Q.buscarQuest({ fetch: fetchFalso(() => ({ corpo: "<html>" })), chave: CHAVE }, new URLSearchParams()),
    (e) => e.tipo === "formato");
  await assert.rejects(Q.buscarQuest({ fetch: fetchFalso(() => ({ corpo: { data: { itens: [] } } })), chave: CHAVE }, new URLSearchParams()),
    (e) => e.tipo === "formato", "envelope diferente do esperado não vira lista vazia");
  await assert.rejects(Q.buscarQuest({ fetch: fetchFalso(() => new TypeError("fetch failed")), chave: CHAVE }, new URLSearchParams()),
    (e) => e.tipo === "rede");
  await assert.rejects(Q.buscarQuest({ fetch: fetchFalso(() => ({})), chave: "" }, new URLSearchParams()),
    (e) => e.tipo === "sem_chave");
});

test("timeout: fornecedor que não responde é abortado no prazo", async () => {
  const lento = (url, init) => new Promise((_, rej) => {
    init.signal.addEventListener("abort", () => rej(Object.assign(new Error("abortado"), { name: "AbortError" })));
  });
  const t0 = Date.now();
  await assert.rejects(Q.buscarQuest({ fetch: lento, chave: CHAVE, timeoutMs: 50 }, new URLSearchParams()),
    (e) => e.tipo === "timeout");
  assert.ok(Date.now() - t0 < 2000);
});

// ── cobertura ────────────────────────────────────────────────────────

test("cobertura: per_page=1, sem gabarito, total por banca, outras e créditos", async () => {
  const f = fetchFalso((url) => {
    const banca = url.searchParams.get("banca");
    const total = { CESGRANRIO: 12, FGV: 30 }[banca] ?? 100;
    return { corpo: { data: { items: [itemQuest({ gabarito: undefined })], total } } };
  });
  const [l] = await Q.medirCobertura({ fetch: f, chave: CHAVE }, [{ chave: "M1", materia: "Direito Penal", assunto: "Prescrição" }], ["CESGRANRIO", "FGV"]);
  assert.deepEqual([l.total, l.por_banca.CESGRANRIO, l.por_banca.FGV, l.outras, l.creditos, l.erro], [100, 12, 30, 58, 9, null]);
  assert.equal(f.chamadas.length, 3);
  for (const ch of f.chamadas) {
    assert.equal(ch.url.searchParams.get("per_page"), "1");
    assert.equal(ch.url.searchParams.get("include_gabarito"), null);
  }
});

test("cobertura: total zero não gasta chamada por banca", async () => {
  const f = fetchFalso(() => ({ corpo: { data: { items: [], total: 0 } } }));
  const [l] = await Q.medirCobertura({ fetch: f, chave: CHAVE }, [{ chave: "M1", materia: "x", assunto: "y" }], ["CESGRANRIO", "FGV"]);
  assert.equal(f.chamadas.length, 1);
  assert.deepEqual([l.total, l.por_banca.FGV, l.outras, l.creditos], [0, 0, 0, 0]);
});

test("filtros: consulta /v2/filtros com q e não pede questão", async () => {
  const f = fetchFalso(() => ({ corpo: { data: { items: [{ id: 1, nome: "Direito Penal Militar" }] } } }));
  const itens = await Q.buscarFiltros({ fetch: f, chave: CHAVE }, "assuntos", "Imputabilidade", { materia: "Direito Penal Militar" });
  assert.equal(itens.length, 1);
  assert.equal(f.chamadas[0].url.pathname, "/v2/filtros/assuntos");
  assert.equal(f.chamadas[0].url.searchParams.get("q"), "Imputabilidade");
  assert.equal(f.chamadas[0].url.searchParams.get("materia"), "Direito Penal Militar");
});

test("cobertura: chave errada para tudo na primeira chamada, sem gastar cota nas outras missões", async () => {
  const f = fetchFalso(() => ({ status: 401, corpo: {} }));
  const linhas = await Q.medirCobertura({ fetch: f, chave: CHAVE }, [1, 2, 3].map((i) => ({ chave: `M${i}`, materia: "x", assunto: "y" })), ["FGV"]);
  assert.equal(f.chamadas.length, 1);
  assert.deepEqual(linhas.map((l) => l.erro), ["chave", "chave", "chave"]);
});

test("mapa de filtros cobre as 24 missões do manifesto, sem sobra", () => {
  const mapa = carregarMapa();
  const M = carregarFonte();
  assert.equal(mapa.missoes.length, 24);
  assert.deepEqual(validarMapa(mapa, M), []);
  // conferido = nome exato achado em /v2/filtros; a única sem assunto na Quest fica marcada
  assert.equal(mapa.missoes.filter((f) => f.conferido).length, 23);
  assert.deepEqual(mapa.missoes.filter((f) => !f.conferido).map((f) => f.chave), ["PMERJ-M04-DH"]);
  assert.ok(mapa.missoes.find((f) => f.chave === "PMERJ-M04-DH").semAssuntoNaQuest);
  const quebrado = { ...mapa, missoes: mapa.missoes.slice(1) };
  assert.match(validarMapa(quebrado, M).join(), /missão sem filtro/);
});

test("tabela: situação de cada linha frente à meta da missão", () => {
  assert.equal(situacao({ total: 0 }, 20), "zero: conferir filtro");
  assert.equal(situacao({ total: 10 }, 20), "abaixo da meta (20)");
  assert.equal(situacao({ total: 50 }, 20), "ok");
  assert.equal(situacao({ total: 6 }, undefined), "sem meta (acompanhamento manual)", "sem meta não vira ok");
  assert.equal(situacao({ total: 0 }, undefined, true), "sem assunto na Quest");
  assert.equal(situacao({ erro: "timeout" }, 20), "erro: timeout");
  const M = carregarFonte();
  const t = montarTabela({ bancas: ["CESGRANRIO", "FGV"], medido_em: "x", linhas: [
    { chave: "PMERJ-M01-ADM", materia_codigo: "dir_adm", filtro: { assunto: "Adm" }, total: 40, por_banca: { CESGRANRIO: 5, FGV: 10 }, outras: 25, creditos: 9, erro: null },
  ] }, M);
  assert.match(t, /\| PMERJ-M01-ADM \| dir_adm \| Adm \| 20 \| 40 \| 5 \| 10 \| 25 \| ok \|/);
  assert.match(t, /Missões com volume para a meta: 1 de 1 com meta automática \(0 sem meta: semana de simulado\)\. Créditos gastos na medição: 9/);
});

test("SQL dos filtros: aplica nas missões do CFO PMERJ, nasce desligado, liga só o pedido, reaplica sem duplicar", async () => {
  const M = carregarFonte();
  const mapa = carregarMapa();
  const semTransacao = (s) => s.replace(/^begin;$/m, "").replace(/^commit;$/m, "");
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(semTransacao(gerarSql(M, { inicio: "2026-10-05", turma: 1 })));
    await c.query(semTransacao(gerarSqlFiltros(mapa)));
    const n = async (onde = "true") => Number((await c.query(`select count(*) as n from app.quest_filtros_missao where ${onde}`)).rows[0].n);
    assert.equal(await n(), 24);
    assert.equal(await n("ativo"), 0);
    await c.query(semTransacao(gerarSqlFiltros(mapa, { ativar: ["PMERJ-M01-ADM"] })));
    assert.equal(await n(), 24);
    assert.equal(await n("ativo"), 1);
    assert.equal(await n(`ativo and missao_id = '${uid("missao:PMERJ-M01-ADM")}'`), 1);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
  assert.throws(() => gerarSqlFiltros(mapa, { ativar: ["NAO-EXISTE"] }), /não está no mapa/);
});

test("SQL dos filtros recusa rodar antes da publicação das missões", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await assert.rejects(c.query(gerarSqlFiltros(carregarMapa()).replace(/^begin;$/m, "").replace(/^commit;$/m, "")),
      /nem todas as 24 missões/);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── travas de fonte ──────────────────────────────────────────────────

const semComentario = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

test("a chave da Quest só é lida pela Edge Function, do secret, e nunca vai a log", () => {
  const fn = semComentario(ler("supabase/functions/questoes-integradas/index.ts"));
  assert.match(fn, /Deno\.env\.get\("QUEST_API_KEY"\)/);
  assert.doesNotMatch(fn, /console\.[a-z]+\([^)]*chave/i);
  assert.doesNotMatch(fn, /console\.[a-z]+\([^)]*QUEST_API_KEY/);
  const mod = semComentario(ler("supabase/functions/_shared/quest.ts"));
  assert.doesNotMatch(mod, /console\./, "o módulo não loga nada (nem enunciado, nem chave)");
  assert.doesNotMatch(mod, /Deno\./, "o módulo recebe a chave por parâmetro");
});

function arquivos(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === "dist" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(p)); else out.push(p);
  }
  return out;
}

test("diagnóstico de secret ausente devolve só NOMES de variável, nunca valores, e só ao super_admin", () => {
  const fn = semComentario(ler("supabase/functions/questoes-integradas/index.ts"));
  const bloco = fn.slice(fn.indexOf('corpo.acao === "filtros"'), fn.indexOf("const quem = await chamador"));
  assert.match(bloco, /superAdmin\(req\)/);
  assert.match(bloco, /Object\.keys\(Deno\.env\.toObject\(\)\)\.filter\(\(k\) => \/quest\/i\.test\(k\)\)/);
  assert.doesNotMatch(fn, /Object\.values\(Deno\.env|Object\.entries\(Deno\.env|Deno\.env\.toObject\(\)\[/);
});

test("nada do front fala com a Quest nem menciona a chave (sem VITE_ da Quest)", () => {
  for (const f of arquivos(resolve(root, "app"))) {
    if (!/\.(jsx?|tsx?|html|json|env.*)$/.test(f)) continue;
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /QUEST_API|quest\.api\.br|X-API-Key/i, f);
  }
});

test("a função tem entrada no config.toml com verify_jwt = false (preflight) e autentica no código", () => {
  assert.match(ler("supabase/config.toml"), /\[functions\.questoes-integradas\]\s*\n(?:#.*\n)*verify_jwt = false/);
  const fn = semComentario(ler("supabase/functions/questoes-integradas/index.ts"));
  assert.match(fn, /req\.method === "OPTIONS"/);
  assert.match(fn, /quem\.papel !== "aluno"/);
  assert.match(fn, /internal_admins/);
  assert.match(fn, /escolaOperacional/);
  // usuário e escola vêm do token, não do corpo
  assert.match(fn, /p_usuario: quem\.id, p_escola: quem\.escola_id/);
  assert.doesNotMatch(fn, /corpo\.(usuario|escola|aluno)/);
});
