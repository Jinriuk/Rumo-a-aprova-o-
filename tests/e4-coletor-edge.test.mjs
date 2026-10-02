// ============================================================
// ETAPA 4 — coletor de erros nas Edge Functions (parte pura + fonte)
// ------------------------------------------------------------
// _shared/coletor.ts e _shared/relato5xx.ts não importam nada de rede:
// rodam aqui no Node (type stripping do Node 22), com `registrar` falso.
// A ligação com o banco e o Resend (coletor-servidor.ts) e a função
// registrar-erro são travadas pela fonte; o comportamento HTTP de ponta
// a ponta é a prova da stack local (scripts/alertas/provas.mjs).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");
const semComentario = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const C = await import("../supabase/functions/_shared/coletor.ts");
const { envolverCom5xx } = await import("../supabase/functions/_shared/relato5xx.ts");

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.c2lnbmF0dXJhLWZhbHNhLWRlLXRlc3Rl";
const PESSOAIS = [
  "maria.silva@escola.com.br", JWT, "s3nh4-Secreta!", "tok_abcdef123456", "ABCD-EFGH-JK23",
  "123.456.789-09", "(21) 99876-5432", "0f8fad5b-d9cb-469f-a165-70867728950e", "sb_secret_abcdefghijklmnop",
  "Bearer abcdefghijklmnopqrstuv",
];
const RELATO_SUJO = {
  mensagem: `Falha para maria.silva@escola.com.br com token=tok_abcdef123456 senha: s3nh4-Secreta! código ABCD-EFGH-JK23 cpf 123.456.789-09 tel (21) 99876-5432 aluno 0f8fad5b-d9cb-469f-a165-70867728950e`,
  pilha: `Error\n at f (https://x/assets/a.js:1:2)\n Authorization: Bearer abcdefghijklmnopqrstuv\n jwt ${JWT}\n chave sb_secret_abcdefghijklmnop`,
  origem: "react-error-boundary",
  rota: `/aluno/0f8fad5b-d9cb-469f-a165-70867728950e/123?email=maria.silva@escola.com.br#access_token=${JWT}`,
  release: "a1b2c3d4e5f6",
  papel: "aluno",
  correlation_id: "6c1e1f7a-2b5d-4e1a-9a7b-3f2d1c0b9a88",
  em: "2026-10-02T00:00:00Z",
  extra: "campo desconhecido com maria.silva@escola.com.br",
};

test("E4: o relato higienizado não carrega e-mail, JWT, token, senha, código, CPF, telefone nem uuid", () => {
  const e = C.normalizarEvento(RELATO_SUJO);
  const tudo = JSON.stringify(e);
  for (const p of PESSOAIS) assert.ok(!tudo.includes(p), `vazou: ${p}`);
  assert.match(e.mensagem, /\[email\]/);
  assert.match(e.mensagem, /token=\[redigido\]/);
  assert.match(e.mensagem, /senha: \[redigido\]/);
  assert.match(e.mensagem, /\[codigo\]/);
  assert.match(e.pilha, /\[jwt\]/);
  assert.equal(e.rota, "/aluno/[id]/[n]", "rota sem query, sem fragmento e sem id");
  assert.equal(Object.hasOwn(e, "extra"), false, "campo fora da lista entrou");
  assert.equal(Object.hasOwn(e, "em"), false);
});

test("E4: campos novos passam quando válidos e caem quando não", () => {
  const ok = C.normalizarEvento(RELATO_SUJO);
  assert.equal(ok.release, "a1b2c3d4e5f6");
  assert.equal(ok.papel, "aluno");
  assert.equal(ok.correlation_id, "6c1e1f7a-2b5d-4e1a-9a7b-3f2d1c0b9a88");
  const ruim = C.normalizarEvento({ mensagem: "x", release: "<script>", papel: "root", correlation_id: "a b", origem: "!!" });
  assert.equal(ruim.release, null);
  assert.equal(ruim.papel, "desconhecido");
  assert.equal(ruim.correlation_id, null);
  assert.equal(ruim.origem, "desconhecida");
});

test("E4: o formato que o observabilidade.js já mandava continua aceito", () => {
  const e = C.normalizarEvento({ mensagem: "boom", pilha: "at x", origem: "window.onerror", em: "2026-01-01", rota: "/" });
  assert.equal(e.mensagem, "boom");
  assert.equal(e.origem, "window.onerror");
  assert.equal(e.rota, "/");
  assert.equal(e.papel, "desconhecido");
});

test("E4: campos grandes são cortados nos limites", () => {
  const e = C.normalizarEvento({ mensagem: "m".repeat(5000), pilha: "p ".repeat(9000), componente: "c".repeat(9000), rota: "/" + "r/".repeat(500) });
  assert.ok(e.mensagem.length <= C.LIMITES.mensagem);
  assert.ok(e.pilha.length <= C.LIMITES.pilha);
  assert.ok(e.componente.length <= C.LIMITES.componente);
  assert.ok(e.rota.length <= C.LIMITES.rota);
});

test("E4: fingerprint agrupa o mesmo erro com números diferentes e separa erros diferentes", async () => {
  const a = await C.fingerprint(C.normalizarEvento({ mensagem: "Falhou na linha 10", origem: "x", rota: "/escola" }));
  const b = await C.fingerprint(C.normalizarEvento({ mensagem: "Falhou na linha 99", origem: "x", rota: "/escola" }));
  const c = await C.fingerprint(C.normalizarEvento({ mensagem: "Outra coisa", origem: "x", rota: "/escola" }));
  const d = await C.fingerprint(C.normalizarEvento({ mensagem: "Falhou na linha 10", origem: "x", rota: "/aluno" }));
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

test("E4: a chave do limite não contém o IP, muda por dia e depende do segredo", async () => {
  const d1 = new Date("2026-10-02T10:00:00Z");
  const k = await C.chaveLimiteIp("200.150.10.7", "segredo", d1);
  assert.match(k, /^ip:[0-9a-f]{32}$/);
  assert.ok(!k.includes("200.150"));
  assert.equal(k, await C.chaveLimiteIp("200.150.10.7", "segredo", new Date("2026-10-02T23:59:00Z")));
  assert.notEqual(k, await C.chaveLimiteIp("200.150.10.7", "segredo", new Date("2026-10-03T00:00:01Z")));
  assert.notEqual(k, await C.chaveLimiteIp("200.150.10.7", "outro", d1));
});

test("E4: IP do cliente — cf-connecting-ip, depois x-real-ip, depois o 1º do x-forwarded-for", () => {
  assert.equal(C.ipDoCliente(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9" })), "1.1.1.1");
  assert.equal(C.ipDoCliente(new Headers({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9" })), "2.2.2.2");
  assert.equal(C.ipDoCliente(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" })), "3.3.3.3");
  assert.equal(C.ipDoCliente(new Headers()), "desconhecido");
});

test("E4: corpo acima de 16 KB é recusado, declarado ou não", async () => {
  const grande = "x".repeat(C.LIMITES.corpoBytes + 1);
  assert.equal(await C.lerCorpoLimitado(new Request("http://x", { method: "POST", body: grande }), C.LIMITES.corpoBytes), null);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(grande)); c.close(); } });
  const semTamanho = new Request("http://x", { method: "POST", body: stream, duplex: "half" });
  assert.equal(await C.lerCorpoLimitado(semTamanho, C.LIMITES.corpoBytes), null);
  assert.equal(await C.lerCorpoLimitado(new Request("http://x", { method: "POST", body: "{}" }), C.LIMITES.corpoBytes), "{}");
});

test("E4: e-mail de alerta — ambiente no assunto, sem dado pessoal, HTML escapado", () => {
  const e = C.normalizarEvento({ ...RELATO_SUJO, mensagem: "<img src=x onerror=alert(1)> maria.silva@escola.com.br" });
  const m = C.montarEmail(e, { fingerprint: "f".repeat(32), ocorrencias: 3, primeira_em: "2026-10-02T00:00:00Z", resultado: "registrado" }, "produção");
  assert.match(m.assunto, /^\[Triliva produção\] react-error-boundary: /);
  for (const p of PESSOAIS) assert.ok(!(m.texto + m.html + m.assunto).includes(p), `vazou no e-mail: ${p}`);
  assert.ok(!m.html.includes("<img"), "HTML do relato não escapado");
  assert.match(m.texto, /where fingerprint = 'f{32}'/);
  assert.equal(C.ambienteDoProjeto("https://zckyhihxjjbnqjqilymn.supabase.co"), "produção");
  assert.equal(C.ambienteDoProjeto("https://bdjkgrzfzoamchdpobbl.supabase.co"), "demo");
  assert.equal(C.ambienteDoProjeto("http://127.0.0.1:54321"), "local");
});

// ── relato de 5xx ────────────────────────────────────────────────
function registrarFalso({ demora = 0, falha = false } = {}) {
  const chamadas = [];
  const fn = async (evento, chave) => {
    chamadas.push({ evento, chave });
    if (demora) await new Promise((r) => setTimeout(r, demora));
    if (falha) throw new Error("coletor fora do ar");
  };
  fn.chamadas = chamadas;
  return fn;
}
const req = (h = {}) => new Request("http://x/functions/v1/gerar-meta", { method: "POST", headers: { origin: "https://app.trilivaedu.com.br", ...h } });
const corpo500 = () => new Response(JSON.stringify({ error: "duplicate key (email)=(maria.silva@escola.com.br)" }), { status: 500, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "https://app.trilivaedu.com.br" } });

test("E4: 5xx vira relato só com função, status e correlation_id, e o id volta no cabeçalho", async () => {
  const reg = registrarFalso();
  const h = envolverCom5xx("gerar-meta", async () => corpo500(), reg);
  const r = await h(req());
  assert.equal(r.status, 500);
  assert.equal(reg.chamadas.length, 1);
  const { evento, chave } = reg.chamadas[0];
  assert.equal(chave, "edge:gerar-meta");
  assert.equal(evento.origem, "edge:gerar-meta");
  assert.equal(evento.mensagem, "HTTP 500 em gerar-meta");
  assert.equal(evento.papel, "servidor");
  assert.ok(!JSON.stringify(evento).includes("maria"), "corpo da resposta entrou no relato");
  assert.equal(r.headers.get("x-correlation-id"), evento.correlation_id);
  assert.match(r.headers.get("access-control-expose-headers"), /x-correlation-id/);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://app.trilivaedu.com.br", "CORS da resposta original preservado");
  assert.match(await r.text(), /duplicate key/, "o corpo da resposta não muda");
});

test("E4: correlation_id recebido e válido é reaproveitado; inválido é trocado", async () => {
  const reg = registrarFalso();
  const h = envolverCom5xx("x", async () => corpo500(), reg);
  assert.equal((await h(req({ "x-correlation-id": "abcd1234-ok" }))).headers.get("x-correlation-id"), "abcd1234-ok");
  assert.notEqual((await h(req({ "x-correlation-id": "<script>" }))).headers.get("x-correlation-id"), "<script>");
});

test("E4: resposta abaixo de 500 passa intacta e não relata", async () => {
  const reg = registrarFalso();
  for (const status of [200, 400, 401, 403, 404, 422]) {
    const original = new Response("ok", { status });
    const r = await envolverCom5xx("x", async () => original, reg)(req());
    assert.equal(r, original);
  }
  assert.equal(reg.chamadas.length, 0);
});

test("E4: exceção que escapa do handler vira 500 com CORS, e é relatada", async () => {
  const reg = registrarFalso();
  const h = envolverCom5xx("x", async () => { throw new Error("boom"); }, reg, { cors: () => ({ "Access-Control-Allow-Origin": "https://o" }) });
  const r = await h(req());
  assert.equal(r.status, 500);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://o");
  assert.equal(reg.chamadas.length, 1);
});

test("E4: coletor fora do ar ou lento não muda o status nem segura a resposta além do prazo", async () => {
  const quebrado = envolverCom5xx("x", async () => corpo500(), registrarFalso({ falha: true }));
  assert.equal((await quebrado(req())).status, 500);
  const lento = envolverCom5xx("x", async () => corpo500(), registrarFalso({ demora: 5000 }), { esperaMs: 50 });
  const t0 = Date.now();
  assert.equal((await lento(req())).status, 500);
  assert.ok(Date.now() - t0 < 1000, "esperou o coletor lento além do prazo");
});

// ── fonte ────────────────────────────────────────────────────────
const FUNCOES = readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name);

test("E4: toda Edge Function, menos o próprio coletor, relata 5xx pelo comRelato5xx", () => {
  assert.ok(FUNCOES.includes("registrar-erro"));
  for (const fn of FUNCOES) {
    const src = semComentario(ler(`supabase/functions/${fn}/index.ts`));
    if (fn === "registrar-erro") {
      assert.doesNotMatch(src, /comRelato5xx/, "o coletor relatando a si mesmo vira laço");
      continue;
    }
    assert.match(src, new RegExp(`Deno\\.serve\\(comRelato5xx\\("${fn}", async \\(req\\) => \\{`), `${fn} sem relato de 5xx`);
    assert.match(src, /from "\.\.\/_shared\/coletor-servidor\.ts"/);
  }
});

test("E4: registrar-erro confere a origem antes de ler o corpo, e lê com teto", () => {
  const src = semComentario(ler("supabase/functions/registrar-erro/index.ts"));
  const iOrigem = src.indexOf("origemPermitida(");
  const iCorpo = src.indexOf("lerCorpoLimitado(");
  const iRegistro = src.indexOf("registrarEvento(");
  assert.ok(iOrigem > 0 && iCorpo > iOrigem && iRegistro > iCorpo, "ordem: origem, corpo com teto, registro");
  assert.doesNotMatch(src, /req\.(json|text)\(\)/, "corpo lido sem teto");
  assert.match(src, /return json\(\{ error: "origem não permitida" \}, 403\)/);
  assert.match(src, /, 429\)/);
  assert.match(src, /, 413\)/);
});

test("E4: o servidor do coletor lê o destinatário de ALERTA_EMAIL e reaproveita os RESEND_*", () => {
  const src = semComentario(ler("supabase/functions/_shared/coletor-servidor.ts"));
  assert.match(src, /Deno\.env\.get\("ALERTA_EMAIL"\)/);
  assert.match(src, /Deno\.env\.get\("RESEND_API_KEY"\)/);
  assert.match(src, /Deno\.env\.get\("RESEND_FROM_EMAIL"\)/);
  assert.match(src, /rpc\("coletor_registrar_erro"/);
  assert.match(src, /rpc\("coletor_marcar_email"/);
  assert.match(src, /HOST_LOCAL\.test\(u\.hostname\)/, "RESEND_API_URL só pode apontar para host local");
});

test("E4: o desvio do Resend aceita só host local ou privado", () => {
  const src = ler("supabase/functions/_shared/coletor-servidor.ts");
  const re = new RegExp(src.match(/const HOST_LOCAL = \/(.+)\/;/)[1]);
  for (const h of ["localhost", "127.0.0.1", "host.docker.internal", "172.17.0.1", "10.1.2.3", "192.168.0.5"]) assert.ok(re.test(h), h);
  for (const h of ["api.resend.com", "evil.example", "172.32.0.1", "8.8.8.8", "localhost.evil.example"]) assert.ok(!re.test(h), h);
});
