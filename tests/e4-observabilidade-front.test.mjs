// ============================================================
// ETAPA 4 — o front manda release, rota, papel e correlation_id ao
// coletor, e o envio nunca quebra a tela
// ------------------------------------------------------------
// observabilidade.js é módulo puro (o `fetch` entra por parâmetro):
// roda direto no Node. ErroFronteira, App, vite.config e a camada de
// dados são travados pela fonte. A prova em navegador real é
// scripts/alertas/prova-front.mjs (coletor interceptado) e, com o
// coletor de verdade, o workflow provas-alertas do PR de banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");
const O = await import("../app/src/shared/lib/observabilidade.js");

const URL_COLETOR = "https://ref.supabase.co/functions/v1/registrar-erro";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function silenciado(fn) {
  const orig = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = orig; }
}
function fetchFalso(comportamento = () => Promise.resolve(new Response(null, { status: 202 }))) {
  const chamadas = [];
  const f = (url, init) => { chamadas.push({ url, init, corpo: JSON.parse(init.body) }); return comportamento(); };
  f.chamadas = chamadas;
  return f;
}

test("E4/front: o relato leva release, rota, papel, correlation_id, origem e componente", () => {
  O._reiniciarLimites();
  globalThis.location = { pathname: "/aluno/0f8fad5b-d9cb-469f-a165-70867728950e/meta" };
  O.definirPapel("coordenacao");
  const f = fetchFalso();
  const erro = new Error("TypeError: x is undefined");
  const id = silenciado(() => O.capturarErro(erro, { origem: "react-error-boundary", componente: "at Painel\nat App" }, { endpoint: URL_COLETOR, enviar: f }));
  assert.equal(f.chamadas.length, 1);
  const { url, init, corpo } = f.chamadas[0];
  assert.equal(url, URL_COLETOR);
  assert.equal(corpo.mensagem, "TypeError: x is undefined");
  assert.equal(corpo.origem, "react-error-boundary");
  assert.equal(corpo.componente, "at Painel\nat App");
  assert.equal(corpo.rota, "/aluno/[id]/meta", "id de pessoa na rota");
  assert.equal(corpo.release, "dev", "fora do Vite o release é 'dev'; no build é o SHA (vite.config.js)");
  assert.equal(corpo.papel, "coordenacao");
  assert.match(corpo.correlation_id, UUID_RE);
  assert.equal(id, corpo.correlation_id, "capturarErro devolve o id do relato");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Content-Type"], "text/plain;charset=UTF-8", "text/plain: pedido simples, sem preflight");
  assert.equal(init.keepalive, true);
  assert.equal(init.credentials, "omit");
  delete globalThis.location;
  O.definirPapel("anonimo");
});

test("E4/front: o id do 5xx da Edge Function (erro.correlation_id) liga as duas pontas", () => {
  O._reiniciarLimites();
  const f = fetchFalso();
  const erro = Object.assign(new Error("gerar-meta: falha ao gerar meta"), { correlation_id: "abcd1234-0000-4000-8000-000000000001" });
  const id = silenciado(() => O.capturarErro(erro, { origem: "unhandledrejection" }, { endpoint: URL_COLETOR, enviar: f }));
  assert.equal(id, "abcd1234-0000-4000-8000-000000000001");
  assert.equal(f.chamadas[0].corpo.correlation_id, id);
});

test("E4/front: papel vem da sessão, e papel estranho vira 'desconhecido'", () => {
  assert.equal(O.papelDaSessao({}), "anonimo");
  assert.equal(O.papelDaSessao({ sessao: {}, superAdmin: true }), "super_admin");
  for (const p of ["coordenacao", "aluno", "responsavel"]) {
    assert.equal(O.papelDaSessao({ sessao: {}, perfil: { usuario: { papel: p } } }), p);
  }
  assert.equal(O.papelDaSessao({ sessao: {}, perfil: null }), "desconhecido");
  assert.equal(O.papelDaSessao({ sessao: {}, perfil: { usuario: { papel: "root" } } }), "desconhecido");
  O._reiniciarLimites();
  O.definirPapel("root");
  const f = fetchFalso();
  silenciado(() => O.capturarErro(new Error("x"), {}, { endpoint: URL_COLETOR, enviar: f }));
  assert.equal(f.chamadas[0].corpo.papel, "desconhecido");
  O.definirPapel("anonimo");
});

test("E4/front: campos grandes são cortados antes de sair do navegador", () => {
  const r = O.montarRelato({ message: "m".repeat(5000), stack: "s".repeat(20000) }, { componente: "c".repeat(9000) });
  assert.equal(r.mensagem.length, O.LIMITES.mensagem);
  assert.equal(r.pilha.length, O.LIMITES.pilha);
  assert.equal(r.componente.length, O.LIMITES.componente);
  assert.ok(JSON.stringify(r).length < 16_384, "o relato cabe no teto de 16 KB do coletor");
});

test("E4/front: coletor fora do ar, lento ou quebrado nunca lança nem rejeita sem tratamento", async () => {
  const modos = {
    "lança na hora": () => { throw new TypeError("Failed to fetch"); },
    "rejeita": () => Promise.reject(new TypeError("Failed to fetch")),
    "503": () => Promise.resolve(new Response("fora", { status: 503 })),
    "pendura": () => new Promise(() => {}),
    "devolve lixo": () => 42,
  };
  const rejeicoes = [];
  const ouvir = (e) => rejeicoes.push(e);
  process.on("unhandledRejection", ouvir);
  try {
    for (const [nome, comp] of Object.entries(modos)) {
      O._reiniciarLimites();
      const id = silenciado(() => O.capturarErro(new Error(`teste ${nome}`), { origem: "teste" }, { endpoint: URL_COLETOR, enviar: fetchFalso(comp) }));
      assert.ok(id === null || typeof id === "string", nome);
    }
    await new Promise((r) => setTimeout(r, 20));
  } finally {
    process.off("unhandledRejection", ouvir);
  }
  assert.deepEqual(rejeicoes, [], "o envio deixou promessa rejeitada sem tratamento");
});

test("E4/front: console sequestrado ou erro que nem é Error não derrubam a captura", () => {
  O._reiniciarLimites();
  const orig = console.error;
  console.error = () => { throw new Error("console quebrado"); };
  try {
    const f = fetchFalso();
    assert.doesNotThrow(() => O.capturarErro(undefined, {}, { endpoint: URL_COLETOR, enviar: f }));
    assert.doesNotThrow(() => O.capturarErro({ toString() { throw new Error("pegadinha"); } }, {}, { endpoint: URL_COLETOR, enviar: f }));
    assert.equal(f.chamadas[0].corpo.mensagem, "erro desconhecido");
  } finally {
    console.error = orig;
  }
});

test("E4/front: sem VITE_ERROR_REPORT_URL, só console; nada é enviado", () => {
  O._reiniciarLimites();
  const f = fetchFalso();
  const id = silenciado(() => O.capturarErro(new Error("x"), {}, { endpoint: undefined, enviar: f }));
  assert.equal(f.chamadas.length, 0);
  assert.equal(id, null, "sem coletor não há código: a tela não mostra o que ninguém acha");
  const doServidor = Object.assign(new Error("y"), { correlation_id: "abcd1234-0000-4000-8000-000000000002" });
  assert.equal(silenciado(() => O.capturarErro(doServidor, {}, { endpoint: undefined, enviar: f })), doServidor.correlation_id,
    "o id do 5xx da Edge Function já está no coletor");
});

test("E4/front: no máximo 10 relatos por página e o mesmo erro uma vez a cada 10 s", () => {
  O._reiniciarLimites();
  const f = fetchFalso();
  const ids = silenciado(() => Array.from({ length: 5 }, () =>
    O.capturarErro(new Error("o mesmo"), { origem: "x" }, { endpoint: URL_COLETOR, enviar: f })));
  assert.equal(f.chamadas.length, 1, "erro repetido em laço virou enxurrada");
  assert.deepEqual(new Set(ids), new Set([f.chamadas[0].corpo.correlation_id]), "o repetido mostra o código do relato que saiu");
  const outros = silenciado(() => Array.from({ length: 30 }, (_, i) =>
    O.capturarErro(new Error(`diferente ${i}`), { origem: "x" }, { endpoint: URL_COLETOR, enviar: f })));
  assert.equal(f.chamadas.length, O.LIMITES.porPagina);
  assert.equal(outros.at(-1), null, "acima do limite da página nada sai, e não há código");
  O._reiniciarLimites();
});

// ── fonte ────────────────────────────────────────────────────────
const semComentario = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

test("E4/front: a fronteira guarda o id do relato e mostra o código curto", () => {
  const src = semComentario(ler("app/src/shared/ui/ErroFronteira.jsx"));
  assert.match(src, /const id = capturarErro\(erro, \{ origem: "react-error-boundary", componente: info\?\.componentStack \?\? null \}\)/);
  assert.match(src, /codigo: String\(id\)\.slice\(0, 8\)/);
  assert.match(src, /Código do erro:/);
});

test("E4/front: o App informa o papel à observabilidade a cada troca de sessão", () => {
  const src = semComentario(ler("app/src/App.jsx"));
  assert.match(src, /definirPapel\(papelDaSessao\(\{ sessao, perfil, superAdmin \}\)\);/);
  assert.doesNotMatch(src, /useEffect\(\(\) => \{\s*definirPapel/, "num efeito, a quebra na 1ª renderização sairia como anonimo");
});

test("E4/front: o build grava o SHA em VITE_RELEASE", () => {
  const src = ler("app/vite.config.js");
  assert.match(src, /"import\.meta\.env\.VITE_RELEASE": JSON\.stringify\(release\(\)\)/);
  assert.match(src, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(src, /GITHUB_SHA/);
});

test("E4/front: o erro de Edge Function carrega o x-correlation-id da resposta", () => {
  const src = semComentario(ler("app/src/shared/data/index.js"));
  assert.match(src, /error\.context\?\.headers\?\.get\?\.\("x-correlation-id"\)/);
  assert.match(src, /e\.correlation_id = correlationId/);
});

test("E4/front: a CSP continua só com *.supabase.co no connect-src", () => {
  const vercel = JSON.parse(ler("vercel.json"));
  const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy").value;
  const connect = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src"));
  assert.equal(connect, "connect-src 'self' https://*.supabase.co wss://*.supabase.co");
});

test("E4/front: o .env.production do demo não define o coletor (o build de produção também o lê)", () => {
  const env = ler("app/.env.production");
  assert.doesNotMatch(env, /^\s*VITE_ERROR_REPORT_URL\s*=/m);
});
