// ============================================================
// BLOCO 5 (24/09/2026) — PACK DE CAPTURAS V2 (P01 a P07)
// ------------------------------------------------------------
// As funções puras do runner (scripts/captura/pack-v2-lib.mjs) e o
// que o workflow e o runner NÃO podem fazer: gravar segredo, levar o
// id do projeto para o pack comercial, escrever no banco, capturar
// fora da janela no modo oficial.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "../scripts/captura/pack-v2-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(resolve(root, p), "utf8");

// ── datas e janela ────────────────────────────────────────────
test("data local é a de Brasília, não a UTC (21:53 de 23/09 ainda é 23/09)", () => {
  assert.equal(L.dataLocal(new Date("2026-09-24T00:53:00Z")), "2026-09-23");
  assert.equal(L.dataLocal(new Date("2026-09-24T03:00:00Z")), "2026-09-24");
});

test("janela oficial: só sábado a partir das 18:00 de Brasília", () => {
  assert.equal(L.janelaOficial(new Date("2026-09-26T21:00:00Z")).ok, true, "sábado 18:00");
  assert.equal(L.janelaOficial(new Date("2026-09-27T02:59:00Z")).ok, true, "sábado 23:59");
  assert.equal(L.janelaOficial(new Date("2026-09-26T20:59:00Z")).ok, false, "sábado 17:59");
  assert.equal(L.janelaOficial(new Date("2026-09-25T22:00:00Z")).ok, false, "sexta 19:00");
  assert.equal(L.janelaOficial(new Date("2026-09-27T03:00:00Z")).ok, false, "domingo 00:00");
});

test("P01: nome com versão e data, sem sufixo de download", () => {
  assert.equal(L.nomeDoPack("2026-09-26"), "pack-triliva-v2-2026-09-26");
  assert.throws(() => L.nomeDoPack("26/09/2026"));
  assert.throws(() => L.nomeDoPack("2026-09-26_1_1"));
});

// ── recorte (P03) ─────────────────────────────────────────────
const pagina = { width: 390, height: 3000 };
const cortaAlgum = (rect, componentes) => componentes.some((c) => {
  const dentro = c.x >= rect.x && c.y >= rect.y && c.x + c.width <= rect.x + rect.width && c.y + c.height <= rect.y + rect.height;
  const fora = c.x >= rect.x + rect.width || c.x + c.width <= rect.x || c.y >= rect.y + rect.height || c.y + c.height <= rect.y;
  return !dentro && !fora;
});

test("P03: componente isolado sai com 24 px de margem nos quatro lados", () => {
  const alvo = { x: 40, y: 400, width: 300, height: 200 };
  const r = L.retanguloDeRecorte({ alvo, componentes: [], pagina });
  assert.deepEqual(r.margens, { topo: 24, direita: 24, base: 24, esquerda: 24 });
  assert.equal(r.aviso, null);
});

test("P03: vizinho que entra só em parte na margem é incluído inteiro", () => {
  const alvo = { x: 40, y: 400, width: 300, height: 200 };
  const vizinho = { x: 40, y: 612, width: 300, height: 40 }; // 12 px abaixo
  const r = L.retanguloDeRecorte({ alvo, componentes: [vizinho], pagina });
  assert.equal(cortaAlgum(r.rect, [vizinho]), false);
  assert.equal(r.incluidos.length, 1);
  assert.equal(r.rect.y + r.rect.height, 652 + 24, "margem de 24 depois do vizinho");
});

test("P03: sem como fechar (vizinhos em cadeia), a margem encolhe e nada sai cortado", () => {
  const alvo = { x: 40, y: 1400, width: 300, height: 100 };
  // uma lista de linhas de texto a 14 px uma da outra, de cima a baixo
  const linhas = [];
  for (let y = 0; y < 3000; y += 34) if (y + 20 <= alvo.y - 14 || y >= alvo.y + alvo.height + 14) linhas.push({ x: 20, y, width: 350, height: 20 });
  const r = L.retanguloDeRecorte({ alvo, componentes: linhas, pagina });
  assert.equal(r.aviso, "margem_reduzida");
  assert.equal(cortaAlgum(r.rect, linhas), false, "nenhuma linha cortada ao meio");
  // a linha de cima está a 20 px (entra na margem): o topo encolhe até
  // ela; a de baixo está a 30 px: a base fica com os 24
  assert.equal(r.margens.topo, 20);
  assert.equal(r.margens.base, 24);
});

test("P03: o recorte em pixels não sai da imagem integral", () => {
  const px = L.paraPixels({ x: 370, y: 2990, width: 40, height: 40 }, 3, { width: 1170, height: 9000 });
  assert.ok(px.x + px.width <= 1170 && px.y + px.height <= 9000);
});

// ── conferência (P05) ─────────────────────────────────────────
// A semana 4 do Meridiano (19/09, sem o Enzo): mesmas linhas do bloco3.
const SEMANA4 = [
  // nome, q7, a7, min7, dias7, qCiclo, aCiclo, turma, xp
  ["Helena Vasconcelos", 79, 62, 243, 4, 378, 294, "CN 2027 · Manhã", 1720],
  ["Camila Restrepo", 58, 42, 139, 3, 288, 205, "CN 2027 · Manhã", 1720],
  ["Rafael Munhoz", 59, 41, 183, 3, 304, 198, "CN 2027 · Tarde", 1560],
  ["Beatriz Okamoto", 29, 18, 58, 2, 144, 84, "CN 2027 · Tarde", 1060],
  ["Thiago Albuquerque", 33, 14, 66, 2, 198, 95, "CN 2027 · Manhã", 1160],
  ["Gustavo Peçanha", 18, 13, 36, 1, 222, 139, "CN 2027 · Tarde", 1260],
  ["Larissa Fontoura", 0, 0, 0, 0, 117, 65, "CN 2027 · Manhã", 800],
];
function daSemana4() {
  const alunos = SEMANA4.map(([nome, , , , , , , turma], i) => ({ id: `a${i}`, nome, usuario_id: `u${i}`, alunos_turmas: [{ turmas: { nome: turma } }] }));
  const linhas = SEMANA4.map(([, q7, a7, min7, d7, q, a], i) => ({
    aluno_id: `a${i}`, questoes_7d: q7, ca_questoes_7d: q7, acertos_7d: a7, minutos_7d: min7, dias_7d: d7,
    questoes_total: q, ca_questoes_total: q, acertos_total: a, meta_feitas: i === 0 ? 5 : 0, meta_consideradas: 7,
  }));
  const xpPorAluno = Object.fromEntries(SEMANA4.map((l, i) => [`a${i}`, l[8]]));
  return L.esperadoDaEscola({ linhas, alunos, xpPorAluno });
}

test("P05: painel da semana 4 — 6 ativos, 276 questões, acerto ponderado 69%", () => {
  const e = daSemana4();
  assert.equal(e.painel.ativos7d, 6);
  assert.equal(e.painel.questoes7d, 276);
  assert.equal(e.painel.acerto7dPonderado, 69);
  assert.deepEqual(e.painel.semAtividade, ["Larissa Fontoura"]);
});

test("P05: pódio 'Melhor acerto (7d)' é Helena, Camila, Rafael (Gustavo, 18 q, fica fora)", () => {
  assert.deepEqual(daSemana4().podioAcerto7d, ["Helena Vasconcelos", "Camila Restrepo", "Rafael Munhoz"]);
});

test("P05: Turmas soma questões do ciclo e faz média simples do acerto do ciclo (o que a tela mostra)", () => {
  const manha = daSemana4().turmas.find((t) => t.nome === "CN 2027 · Manhã");
  assert.equal(manha.alunos, 4);
  assert.equal(manha.questoesCiclo, 378 + 288 + 198 + 117);
  // 78, 71, 48, 56 → média simples 63
  assert.equal(manha.acertoCicloMediaSimples, 63);
});

test("P05/D15: números da Helena — acerto do CICLO, o resto da semana", () => {
  const n = Object.fromEntries(L.numerosDaReferencia(daSemana4()).map((x) => [x.numero, x.valor]));
  assert.equal(n["Questões (7 dias)"], "79");
  assert.equal(n["Tempo (7 dias)"], "4h03m");
  assert.equal(n["Acerto no ciclo"], "78%");
  assert.equal(n["Dias ativos (7 dias)"], "4/7");
  assert.equal(n["Atividades da missão"], "5/7");
  assert.equal(n.XP, "1.720");
});

test("P05: a matriz marca em que tela cada grafia aparece", () => {
  const m = L.conferir(L.numerosDaReferencia(daSemana4()), { "05 mobile": "79 questões · 4h03m · 1.720 XP", "13 mobile": "Acerto no ciclo 78%" });
  const q = m.find((x) => x.numero === "Questões (7 dias)");
  assert.deepEqual(q.telas, { "05 mobile": true, "13 mobile": false });
});

// ── P07 e segredos ────────────────────────────────────────────
test("P07: o pack comercial não pode levar o id do projeto nem valor de segredo", () => {
  const v = L.violacoesDoPackComercial({
    "CAPTURA.json": `{"projeto":"${L.PROJETO_DEMO}"}`,
    "MANIFESTO.md": "código merihele2027 visível",
    "CHANGELOG.md": "limpo",
  }, { segredos: ["merihele2027", "ab"] });
  assert.deepEqual(v.map((x) => x.arquivo).sort(), ["CAPTURA.json", "MANIFESTO.md"]);
  assert.deepEqual(L.violacoesDoPackComercial({ interno: L.PROJETO_DEMO }, { projeto: null, segredos: [] }), [],
    "o interno leva o id de propósito");
});

// ── workflow e runner ─────────────────────────────────────────
const wf = src(".github/workflows/captura-pack-v2.yml");
const runner = src("scripts/captura/pack-v2.mjs");
// só o código: os comentários explicam, de propósito, o que o v2 NÃO usa
const codigoRunner = runner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("workflow: só leitura do repositório e exatamente os seis segredos", () => {
  assert.match(wf, /permissions:\s*\n\s*contents: read\s*\n/);
  assert.doesNotMatch(wf, /id-token|write-all|contents: write/);
  const usados = [...new Set([...wf.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(usados, [...L.SEGREDOS].sort());
  assert.doesNotMatch(wf, /echo[^\n]*secrets\./, "nenhum segredo ecoado no log");
});

test("workflow: o artefato comercial não leva a pasta interna", () => {
  assert.match(wf, /name: pack-triliva-v2\s*\n\s*path: \.captura\/pack-triliva-v2-\*\//);
  assert.match(wf, /name: interno-captura\s*\n\s*path: \.captura\/interno-\*\//);
});

test("runner: não usa service role, função de Edge de captura nem OIDC", () => {
  assert.doesNotMatch(codigoRunner, /service.?role|SERVICE_ROLE|capture-oidc|ACTIONS_ID_TOKEN|functions\/v1\/capture/i);
  assert.match(runner, /capture-oidc-20260919/, "o cabeçalho registra de qual mecanismo o v2 se livrou");
});

test("runner: a sessão fica em memória (storageState sem path) e o erro passa pelo filtro de segredos", () => {
  assert.doesNotMatch(runner, /storageState\(\s*\{\s*path/);
  assert.match(runner, /falhas\.push\(\{ rotulo, erro \}\)/);
  assert.match(runner, /const erro = redigir\(/);
});

test("runner: só leitura passa; provisionar-aluno é simulado apenas na tela 21", () => {
  assert.match(runner, /\["GET", "HEAD", "OPTIONS"\]\.includes\(metodo\)/);
  assert.match(runner, /RPCS_DE_LEITURA = new Set\(\["resumo_escola", "sou_super_admin"\]\)/);
  assert.match(runner, /return route\.abort\("blockedbyclient"\)/);
  const telas = runner.match(/credencialSimulada: true/g) ?? [];
  assert.equal(telas.length, 1, "só uma tela simula a credencial");
  assert.match(runner, /codigo: "ENZO••••", senhaTemporaria: "••••••••"/);
});

test("runner: tela 18 nunca vai para o pack comercial", () => {
  const def = runner.match(/\{ tela: 18,[\s\S]*?\},\n/)[0];
  assert.match(def, /interna: true/);
  assert.match(runner, /comercial: !def\.interna/);
});

test("runner: modo oficial fora da janela ou sem segredo aborta; ensaio sem segredo não captura nada", () => {
  assert.match(runner, /if \(OFICIAL && !janela\.ok\) \{[\s\S]*?process\.exit\(3\)/);
  assert.match(runner, /if \(MODO === "oficial"\) \{ console\.error[\s\S]*?process\.exit\(2\)/);
  assert.match(runner, /ensaio pulado, nada capturado[\s\S]*?process\.exit\(0\)/);
});
