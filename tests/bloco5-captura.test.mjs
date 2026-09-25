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
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "../scripts/captura/pack-v2-lib.mjs";
import { chaveGuia, guiaJaVisto } from "../app/src/shared/guia/roteiros.js";

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

test("P03: camada de fundo que contém o alvo não força o recorte a crescer", () => {
  const alvo = { x: 40, y: 400, width: 300, height: 200 };
  const fundo = { x: 0, y: 0, width: 390, height: 3000 }; // gradiente, estrelas
  const r = L.retanguloDeRecorte({ alvo, componentes: [fundo], pagina });
  assert.deepEqual(r.margens, { topo: 24, direita: 24, base: 24, esquerda: 24 });
});

test("P03 (Codex #136): no caminho de reserva, vizinho que SOBREPÕE o alvo entra inteiro", () => {
  const alvo = { x: 40, y: 1400, width: 300, height: 100 };
  const linhas = [];
  for (let y = 0; y < 3000; y += 34) if (y + 20 <= alvo.y - 14 || y >= alvo.y + alvo.height + 14) linhas.push({ x: 20, y, width: 350, height: 20 });
  const selo = { x: 300, y: 1380, width: 60, height: 40 }; // encostado no canto, por cima do alvo
  const componentes = [...linhas, selo];
  const r = L.retanguloDeRecorte({ alvo, componentes, pagina });
  assert.equal(r.aviso, "margem_reduzida");
  assert.equal(cortaAlgum(r.rect, componentes), false, "nem o selo nem as linhas saem cortados");
  assert.ok(r.rect.x + r.rect.width >= 360 && r.rect.y <= 1380, "o selo está inteiro");
});

test("P03: todo recorte devolvido passa na conferência final (nenhum componente cortado)", () => {
  // varredura: alvos e vizinhos em posições variadas; ou sai um recorte
  // sem corte, ou sai "sem_recorte_valido" — nunca um recorte cortado
  let seed = 7;
  const rnd = (n) => { seed = (seed * 48271) % 2147483647; return seed % n; };
  for (let k = 0; k < 300; k++) {
    const alvo = { x: rnd(200), y: 200 + rnd(2000), width: 100 + rnd(180), height: 40 + rnd(300) };
    const componentes = Array.from({ length: 25 }, () => ({ x: rnd(380), y: rnd(2900), width: 10 + rnd(300), height: 10 + rnd(120) }));
    const r = L.retanguloDeRecorte({ alvo, componentes, pagina });
    // o que conta é o visível: cada vizinho aparado na borda da página, e o
    // pano de fundo (quem contém o alvo inteiro) fica de fora
    const visiveis = componentes
      .map((c) => ({ x: c.x, y: c.y, width: Math.min(pagina.width, c.x + c.width) - c.x, height: Math.min(pagina.height, c.y + c.height) - c.y }))
      .filter((c) => !(c.x <= alvo.x && c.y <= alvo.y && c.x + c.width >= alvo.x + alvo.width && c.y + c.height >= alvo.y + alvo.height));
    if (r.rect) assert.equal(cortaAlgum(r.rect, visiveis), false, `caso ${k}`);
    else assert.equal(r.aviso, "sem_recorte_valido");
  }
});

test("modal: vizinhos só da camada fixa, coordenadas da janela, integral da janela", () => {
  const fn = L.coletarGeometria.toString();
  assert.match(fn, /position === "fixed"\) camada = n/);
  assert.match(fn, /\(camada \?\? document\.body\)\.querySelectorAll\("\*"\)/);
  assert.match(fn, /if \(!modal\) window\.scrollTo\(0, 0\)/);
  assert.match(fn, /n\.closest\('\[aria-hidden="true"\]'\)\) continue/, "decoração aria-hidden não é vizinho");
  assert.match(src("scripts/captura/pack-v2.mjs"), /fullPage: !geo\.modal/);
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

test("workflow: só roda à mão (workflow_dispatch), sem push, PR, agenda ou chamada de outro workflow", () => {
  const gatilhos = wf.slice(wf.indexOf("\non:"), wf.indexOf("\npermissions:"));
  assert.match(gatilhos, /^\s*workflow_dispatch:/m);
  assert.doesNotMatch(gatilhos, /^\s{2}(push|pull_request|pull_request_target|schedule|workflow_call|workflow_run|repository_dispatch):/m);
});

test("workflow: só leitura (repositório e artefatos) e exatamente os seis segredos", () => {
  assert.match(wf, /permissions:\s*\n\s*contents: read\s*\n\s*actions: read/);
  assert.doesNotMatch(wf, /id-token|write-all|: write/);
  const usados = [...new Set([...wf.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(usados, [...L.SEGREDOS].sort());
  assert.doesNotMatch(wf, /echo[^\n]*secrets\./, "nenhum segredo ecoado no log");
});

test("workflow: o artefato comercial não leva a pasta interna", () => {
  assert.match(wf, /name: pack-triliva-v2\s*\n\s*path: \.captura\/pack-triliva-v2-\*\//);
  assert.match(wf, /name: interno-captura\s*\n\s*path: \.captura\/interno-\*\//);
});

test("workflow: publica só PNG e os textos do pack; qualquer outro arquivo derruba a publicação", () => {
  const confere = wf.slice(wf.indexOf("- name: Confere o que vai ser publicado"), wf.indexOf("- name: Pack comercial"));
  assert.match(confere, /id: confere/);
  for (const n of ["'*.png'", "'MANIFESTO.md'", "'CAPTURA.json'", "'CHANGELOG.md'", "'COERENCIA-HELENA.md'", "'SHA256SUMS.txt'", "'CAPTURA-INTERNA*.json'"]) {
    assert.ok(confere.includes(`! -name ${n}`), `falta ${n} na lista`);
  }
  assert.match(confere, /exit 1/);
  const uploads = wf.match(/uses: actions\/upload-artifact@v4/g) ?? [];
  const condicionados = wf.match(/if: \$\{\{ !cancelled\(\) && steps\.confere\.outcome == 'success' \}\}\n\s*uses: actions\/upload-artifact@v4/g) ?? [];
  assert.equal(condicionados.length, uploads.length, "todo upload depende da conferência");
});

test("sem trace, vídeo nem HAR do Playwright; DEBUG e PWDEBUG zerados no workflow e recusados no runner", () => {
  assert.doesNotMatch(codigoRunner, /tracing|recordVideo|recordHar|video\s*:|\.har\b|trace\s*:/i);
  assert.match(wf, /DEBUG: ""\n\s*PWDEBUG: ""/);
  assert.match(runner, /if \(\/pw:\/\.test\(env\.DEBUG \?\? ""\) \|\| env\.PWDEBUG\) \{[\s\S]*?process\.exit\(6\)/);
  // o runner abre o navegador direto (chromium.launch), não pelo test runner
  // do Playwright, que é quem lê playwright.config e poderia ligar trace
  assert.match(codigoRunner, /chromium\.launch\(/);
  assert.doesNotMatch(codigoRunner, /playwright\.config|defineConfig/);
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
  assert.match(runner, /if \(OFICIAL\) \{ console\.error\(`ERRO: \$\{msg\}`\); process\.exit\(2\); \}/);
  assert.match(runner, /const MODO = env\.CAPTURA_MODO === "oficial" \? "oficial" : "ensaio";/);
  assert.doesNotMatch(codigoRunner, /"auto"/, "sem modo automático: o workflow só roda à mão");
  assert.match(runner, /ensaio pulado, nada capturado[\s\S]*?process\.exit\(0\)/);
});

// ── tela 24 ───────────────────────────────────────────────────
const baseCaptura = () => ({
  pack: "pack-triliva-v2-2026-09-26", oficial: true, dataLocal: "2026-09-26", escola: "Instituto Meridiano",
  telas: [1, 5], arquivos: [
    { tela: 5, nome: "Hoje", device: "mobile", viewport: "390x844", dpr: 3, integral: "página inteira", arquivo: "01-aluno/05-hoje-mobile.png", recorte: "01-aluno/05-hoje-mobile-recorte.png", nota: "" },
    { tela: 1, nome: "Portal", device: "desktop", viewport: "1440x900", dpr: 2, integral: "página inteira", arquivo: "00-publico/01-portal-desktop.png", recorte: null, nota: "" },
  ],
  naoIncluidas: [
    { tela: 25, nome: "Trilha não configurada", motivo: "estado especial" },
    { tela: 24, nome: "Onboarding", motivo: "NÃO INCLUÍDA nesta execução: capturado por último em execução própria." },
  ],
});
const img24 = { tela: 24, nome: "Onboarding", device: "mobile", viewport: "390x844", dpr: 3, integral: "página inteira", arquivo: "04-estados/24-onboarding-mobile.png", recorte: "04-estados/24-onboarding-mobile-recorte.png", nota: "preparado" };

test("tela 24: quando a imagem sai, entra no pack e sai das não incluídas", () => {
  const c = L.juntarTela24(baseCaptura(), { arquivos: [img24], run: "123", capturadoEm: "2026-09-26T22:00:00Z" });
  assert.deepEqual(c.telas, [1, 5, 24]);
  assert.equal(c.naoIncluidas.some((n) => n.tela === 24), false);
  assert.deepEqual(c.complementos, [{ tela: 24, run: "123", capturadoEm: "2026-09-26T22:00:00Z", resultado: "incluída" }]);
  const m = L.montarManifesto(c);
  assert.match(m, /\| 24 \| Onboarding \| mobile \|/);
  assert.ok(m.indexOf("| 01 |") < m.indexOf("| 05 |") && m.indexOf("| 05 |") < m.indexOf("| 24 |"), "ordem por tela");
  assert.match(m, /Tela 24 capturada por último, em execução própria \(run 123\)[^\n]*: incluída\./);
  assert.doesNotMatch(m, /\*\*24 Onboarding\*\*/);
});

test("tela 24: quando falha, fica NÃO INCLUÍDA com o motivo real, e o resto do pack não muda", () => {
  const base = baseCaptura();
  const c = L.juntarTela24(base, { falha: "o onboarding da Helena não está pendente (o preparo da tela 24 rodou?)" });
  assert.deepEqual(c.arquivos.map((a) => a.arquivo).sort(), base.arquivos.map((a) => a.arquivo).sort());
  const n24 = c.naoIncluidas.filter((n) => n.tela === 24);
  assert.equal(n24.length, 1);
  assert.match(n24[0].motivo, /^NÃO INCLUÍDA: o onboarding da Helena não está pendente/);
  assert.match(L.montarManifesto(c), /- \*\*24 Onboarding\*\*: NÃO INCLUÍDA: o onboarding/);
});

test("tela 24: rodar a junção de novo não duplica a 24", () => {
  const uma = L.juntarTela24(baseCaptura(), { arquivos: [img24] });
  const duas = L.juntarTela24(uma, { arquivos: [img24] });
  assert.equal(duas.arquivos.filter((a) => a.tela === 24).length, 1);
  assert.equal(duas.complementos.length, 1);
});

test("tela 24 no runner: só a 24, só o login do aluno, sobre o pack do mesmo dia e do mesmo modo", () => {
  assert.match(runner, /const SO_TELA_24 = env\.CAPTURA_TELA === "24";/);
  assert.match(runner, /packBase\.oficial !== OFICIAL[\s\S]*?process\.exit\(7\)/);
  assert.match(runner, /packBase\.dataLocal !== DATA[\s\S]*?process\.exit\(7\)/);
  const bloco = runner.slice(runner.indexOf("if (SO_TELA_24) {\n  await capturarDef(TELA_24);"), runner.indexOf("await browser.close();"));
  assert.match(bloco, /capturarDef\(TELA_24\)/);
  assert.doesNotMatch(bloco.split("} else {")[0], /entrar\("(responsavel|coordenacao)"\)/);
  assert.match(runner, /o onboarding da Helena não está pendente \(o preparo da tela 24 rodou\?\)/);
  // no modo principal a 24 aparece como capturada à parte, não como falha
  assert.match(runner, /\{ tela: 24, nome: "Onboarding", motivo: "NÃO INCLUÍDA nesta execução: estado especial, capturado por último/);
});

// ============================================================
// ETAPA 2, FATIA 1 (24/09/2026) — a captura encerra só o que abriu
// ------------------------------------------------------------
// Cada execução fazia quatro logins (aluno, responsável, coordenação
// e o da conferência) e não encerrava nenhum: o signOut() padrão do
// supabase-js é GLOBAL e derrubaria as outras sessões da conta. Como
// not_after é nulo nos dois projetos, as sessões ficavam para sempre.
// Agora o runner encerra cada uma com scope "local".
//
// Três camadas de prova:
//   1. a função pura que tira o par de tokens do estado do navegador;
//   2. inspeção do runner (nenhum signOut sem escopo, nenhum estado em
//      disco, encerramento depois da conferência);
//   3. o supabase-js real contra um Auth falso local: o que o runner
//      chama manda scope=local com o token DESTA sessão, e o que o
//      botão "Sair" do app chama manda scope=global (comportamento de
//      produto registrado em docs/e2-seguranca.md, não alterado).
// ============================================================

// ── 1. o par de tokens no estado do navegador ─────────────────
const chave = `sb-${L.PROJETO_DEMO}-auth-token`;
const estadoCom = (valor, nome = chave) => ({
  cookies: [],
  origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: "outra", value: "x" }, { name: nome, value: valor }] }],
});

test("sessaoDoEstado: acha o par na chave do projeto de demonstração", () => {
  const s = L.sessaoDoEstado(estadoCom(JSON.stringify({ access_token: "a.b.c", refresh_token: "r1", user: { id: "u" } })));
  assert.deepEqual(s, { access_token: "a.b.c", refresh_token: "r1" });
});

test("sessaoDoEstado: aceita o formato antigo (currentSession)", () => {
  const s = L.sessaoDoEstado(estadoCom(JSON.stringify({ currentSession: { access_token: "a.b.c", refresh_token: "r1" } })));
  assert.deepEqual(s, { access_token: "a.b.c", refresh_token: "r1" });
});

test("sessaoDoEstado: outro projeto, JSON quebrado, sem refresh ou sem estado → null", () => {
  assert.equal(L.sessaoDoEstado(estadoCom(JSON.stringify({ access_token: "a", refresh_token: "r" }), "sb-outroprojeto-auth-token")), null);
  assert.equal(L.sessaoDoEstado(estadoCom("{nao é json")), null);
  assert.equal(L.sessaoDoEstado(estadoCom(JSON.stringify({ access_token: "a" }))), null);
  assert.equal(L.sessaoDoEstado(null), null);
  assert.equal(L.sessaoDoEstado({ origins: [] }), null);
});

// ── 2. o runner ───────────────────────────────────────────────
test("runner: todo signOut tem scope local (o padrão global derrubaria as outras sessões)", () => {
  const chamadas = runner.match(/\.signOut\([^)]*\)/g) ?? [];
  assert.ok(chamadas.length >= 2, "encerra os logins pela tela e o da conferência");
  for (const c of chamadas) assert.match(c, /\{ scope: "local" \}/, `signOut sem escopo local: ${c}`);
});

test("runner: o estado do navegador nunca vai para disco", () => {
  assert.doesNotMatch(runner, /storageState\(\s*\{[^}]*path/, "storageState com path gravaria os tokens");
  assert.doesNotMatch(runner, /writeFile[^\n]*(estado|sessao|token)/i);
});

test("runner: encerra as sessões depois da conferência e registra o resultado sem token", () => {
  const conf = runner.indexOf('seguro("dados para a conferência"');
  const fim = runner.indexOf("for (const [perfil, s] of Object.entries(sessoes)) await encerrarSessao(perfil, s);");
  assert.ok(conf > 0 && fim > conf, "o encerramento vem depois da conferência");
  assert.match(runner, /sessoesEncerradas\.push\(\{ perfil: rotulo, resultado: "encerrada \(scope local\)" \}\)/);
  assert.match(runner, /falhas, avisos, requisicoesNaoLeitura: bloqueadas, checks360, sessoesEncerradas,/);
  // os tokens entram na lista que redigir() troca por ••• e que derruba o pack
  assert.match(runner, /function guardarTokens\(s\) \{[\s\S]*?VALORES_SECRETOS\.push\(t\)/);
  assert.match(runner, /guardarTokens\(login\.session\)/);
});

// ── 3. supabase-js real contra um Auth falso ──────────────────
const requireApp = createRequire(resolve(root, "app/package.json"));
function supabaseJs() {
  if (!existsSync(resolve(root, "app/node_modules/@supabase/supabase-js"))) {
    throw new Error("este teste usa o supabase-js do app: rode `cd app && npm ci` antes (o CI já instala)");
  }
  return requireApp("@supabase/supabase-js");
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwtFalso = (sessao) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: "11111111-1111-4111-8111-111111111111", role: "authenticated", session_id: sessao,
  exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated",
})}.assinatura`;

async function authFalso() {
  const logouts = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (req.method === "GET" && u.pathname === "/auth/v1/user") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "x@y.z", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }));
    }
    if (req.method === "POST" && u.pathname === "/auth/v1/logout") {
      logouts.push({ scope: u.searchParams.get("scope"), bearer: req.headers.authorization });
      res.writeHead(204);
      return res.end();
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${srv.address().port}`, logouts, fechar: () => new Promise((r) => srv.close(r)) };
}

test("supabase-js: o caminho do runner (setSession + signOut local) apaga só a sessão do token", async () => {
  const { createClient } = supabaseJs();
  const auth = await authFalso();
  try {
    const sb = createClient(auth.url, "anon-falsa", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const token = jwtFalso("sessao-da-captura");
    const { error: e1 } = await sb.auth.setSession({ access_token: token, refresh_token: "r" });
    assert.equal(e1, null);
    const { error: e2 } = await sb.auth.signOut({ scope: "local" });
    assert.equal(e2, null);
    assert.deepEqual(auth.logouts, [{ scope: "local", bearer: `Bearer ${token}` }]);
  } finally { await auth.fechar(); }
});

test('supabase-js: signOut() sem escopo é GLOBAL — é o que o botão "Sair" do app faz hoje', async () => {
  const { createClient } = supabaseJs();
  const auth = await authFalso();
  try {
    const sb = createClient(auth.url, "anon-falsa", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    await sb.auth.setSession({ access_token: jwtFalso("sessao-do-app"), refresh_token: "r" });
    await sb.auth.signOut();
    assert.equal(auth.logouts[0].scope, "global");
  } finally { await auth.fechar(); }
  // o app chama sem escopo: sair num aparelho desloga a conta em todos.
  // Registrado em docs/e2-seguranca.md como comportamento de produto; se
  // um dia mudar, este teste e o registro mudam juntos.
  assert.match(src("app/src/shared/data/index.js"), /export async function sair\(\) \{\n  const \{ error \} = await supabase\.auth\.signOut\(\);/);
});

// ── guia passo a passo (#150) fora das capturas ───────────────
test("o convite do guia não sai nas capturas: o runner dá o guia como visto, sem gravar nada", () => {
  // a chave que o app usa começa pelo prefixo que o runner responde
  for (const papel of ["coordenacao", "aluno"]) {
    assert.ok(chaveGuia(papel, "u-1").startsWith(L.PREFIXO_GUIA), `chaveGuia(${papel}) mudou de formato`);
  }
  // dentro da página: responde "visto" para o guia e delega o resto
  const StorageAntes = globalThis.Storage;
  const escritas = [];
  globalThis.Storage = class { getItem(k) { return k === "outra" ? "valor" : null; } setItem(k, v) { escritas.push([k, v]); } };
  try {
    L.guiaJaVistoNaPagina(L.PREFIXO_GUIA);
    const armazenamento = new globalThis.Storage();
    assert.equal(guiaJaVisto(chaveGuia("coordenacao", "u-1"), armazenamento), true, "coordenação");
    assert.equal(guiaJaVisto(chaveGuia("aluno", "u-2"), armazenamento), true, "aluno");
    assert.equal(armazenamento.getItem("outra"), "valor", "chave que não é do guia passa direto");
    assert.equal(armazenamento.getItem("sb-token"), null);
    assert.deepEqual(escritas, [], "não grava nada");
  } finally {
    globalThis.Storage = StorageAntes;
  }
  // e é instalado em todo contexto, antes de qualquer navegação
  const runner = src("scripts/captura/pack-v2.mjs");
  const contexto = runner.split("async function contexto(")[1].split("\n}\n")[0];
  assert.match(contexto, /addInitScript\(L\.guiaJaVistoNaPagina, L\.PREFIXO_GUIA\)/);
  assert.ok(contexto.indexOf("addInitScript") < contexto.indexOf("c.route("), "antes da guarda e de abrir página");
  assert.match(L.montarManifesto({ pack: "p", dataLocal: "2026-09-26", oficial: true, escola: "E", arquivos: [], naoIncluidas: [] }),
    /convite do guia passo a passo.*dado como visto/);
});
