// ============================================================
// P0.3 — manifesto e gerador da trilha CFO PMERJ (sem banco)
// ------------------------------------------------------------
// O manifesto (supabase/seed/trilha-pmerj-cfo-v1.json) tem de:
//   • trazer as 219 linhas do Anexo II com o texto IGUAL ao da matriz
//     (docs/conteudo/pmerj-cfo/PMERJ_CFO_Matriz_e_Modelo_de_Metas.md);
//   • trazer o Apêndice A igual ao do documento de desenho, e com ele
//     dar exatamente um destino a cada linha;
//   • ter o orçamento da seção 6.2 recalculado para a turma de 15 h;
//   • ter 24 missões escritas (semanas 1–4) e 48 pendentes.
// E o gerador não pode fixar data: a turma é parâmetro.
// O lado banco (idempotência, turma nova) está em trilha-pmerj-cfo-db.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  carregarFonte, validarFonte, validarParametros, calcularOrcamento, destinoDasLinhas,
  expandirFaixas, gerarSql, montarSemanas, montarAtividades,
} from "../scripts/gerar-seed-trilha-pmerj-cfo.mjs";
import { validar } from "../scripts/validar-conteudo.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const M = carregarFonte();
const copia = () => structuredClone(M);
const celulas = (l) => l.split("|").slice(1, -1).map((x) => x.trim());

test("manifesto íntegro: o validador não acha nada", () => {
  assert.deepEqual(validarFonte(M), []);
});

test("o validador de conteúdo do repositório também cobra o manifesto PMERJ", () => {
  const { erros } = validar();
  assert.deepEqual(erros, []);
  assert.match(ler("scripts/validar-conteudo.mjs"), /integridadeTrilhaPmerjCfo\(\)/);
});

test("nome público é a decisão do dono, sem ano", () => {
  assert.equal(M.nome, "CFO PMERJ, preparação pré-edital");
  assert.equal(M.concurso.nome, "CFO PMERJ, preparação pré-edital");
  const m = copia(); m.nome = "CFO PMERJ 2026, preparação pré-edital";
  assert.ok(validarFonte(m).some((e) => /sem ano|nome público/.test(e)));
});

// ── Anexo II literal ─────────────────────────────────────────────────

test("as 219 linhas são as da matriz, texto por texto, na mesma ordem", () => {
  const SECS = { "6.1": "dir_adm", "6.2": "dir_const", "6.3": "dir_pen", "6.4": "dir_proc_pen", "6.5": "dir_pen_mil", "6.6": "dir_hum" };
  let sec = null; const doc = [];
  for (const l of ler("docs/conteudo/pmerj-cfo/PMERJ_CFO_Matriz_e_Modelo_de_Metas.md").split("\n")) {
    const m = l.match(/^### (6\.[1-6]) /); if (m) { sec = SECS[m[1]]; continue; }
    if (/^## 7\./.test(l)) sec = null;
    if (sec && l.startsWith("| ") && !l.startsWith("| Matéria |")) doc.push({ materia: sec, texto: celulas(l)[1], fgv: celulas(l)[2] });
  }
  assert.equal(doc.length, 219);
  assert.deepEqual(M.anexoII.map((l) => ({ materia: l.materia, texto: l.texto, fgv: l.questoesFgv2024 })), doc);
});

test("chaves estáveis por matéria: ADM-01…ADM-40, …, DH-01…DH-12", () => {
  const contagem = {};
  for (const l of M.anexoII) contagem[l.chave.split("-")[0]] = (contagem[l.chave.split("-")[0]] ?? 0) + 1;
  assert.deepEqual(contagem, { ADM: 40, CONST: 29, PEN: 71, CPP: 47, CPM: 20, DH: 12 });
  assert.equal(M.anexoII[0].chave, "ADM-01");
  assert.equal(M.anexoII.at(-1).chave, "DH-12");
  const m = copia(); m.anexoII[5].chave = "ADM-99";
  assert.ok(validarFonte(m).some((e) => /chave fora de ordem/.test(e)));
});

test("a grafia do edital é preservada, até nos erros de transcrição", () => {
  const textos = M.anexoII.map((l) => l.texto);
  assert.ok(textos.includes("Legislação extravagante: Crimes resultantes de preconceiro de raça ou de cor (Lei nº 7.716/1989);"));
  assert.ok(textos.includes("Legislação de proteção de diretos humanos."));
});

// ── Apêndice A: toda linha tem destino ───────────────────────────────

test("o Apêndice A do manifesto é o do documento, faixa por faixa", () => {
  const linhas = ler("docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_Auditoria_do_Banco.md").split("\n");
  const i0 = linhas.findIndex((l) => l.startsWith("| Semana de primeira exposição"));
  const doc = [];
  for (let i = i0 + 2; linhas[i]?.startsWith("| "); i += 1) {
    const c = celulas(linhas[i]);
    doc.push({ semana: Number(c[0]), ADM: c[1], CONST: c[2], PEN: c[3], CPP: c[4], CPM: c[5], DH: c[6] });
  }
  assert.deepEqual(M.apendiceA, doc);
});

test("toda linha tem exatamente um destino, e a soma é 219", () => {
  const { destino, repetidas, inexistentes } = destinoDasLinhas(M);
  assert.equal(destino.size, 219);
  assert.deepEqual(repetidas, []);
  assert.deepEqual(inexistentes, []);
  // exemplos de leitura do próprio documento
  assert.equal(destino.get("CONST-07"), 3);
  assert.equal(destino.get("ADM-23"), 8);
  assert.equal(destino.get("ADM-24"), 8);
  assert.equal(destino.get("DH-07"), 4);
  assert.deepEqual(expandirFaixas("1–11,56,70–71").length, 14);
  assert.deepEqual(expandirFaixas("—"), []);
});

test("validador reprova linha sem destino, com dois destinos ou inexistente", () => {
  const sem = copia(); sem.apendiceA[0].ADM = "1–2";
  assert.ok(validarFonte(sem).includes("linha sem destino no Apêndice A: ADM-03"));
  const dois = copia(); dois.apendiceA[1].ADM = "11–12,3";
  assert.ok(validarFonte(dois).some((e) => /linha com dois destinos: ADM-03/.test(e)));
  const fora = copia(); fora.apendiceA[11].DH = "13";
  assert.ok(validarFonte(fora).some((e) => /linha inexistente: DH-13/.test(e)));
});

// ── orçamento recalculado (seção 6.2, turma de 15 h) ─────────────────

test("turma padrão: bacharel em Direito, 15 h = 5 leitura + 8 questões + 2 escrita", () => {
  assert.equal(M.turmaPadrao.horasSemana, 15);
  assert.equal(M.turmaPadrao.horasLeitura, 5);
  assert.equal(M.turmaPadrao.horasQuestoesComCorrecao, 8);
  assert.equal(M.turmaPadrao.horasEscrita, 2);
});

test("orçamento: semana normal 160 e de simulado 112, pesos 15/15/15/15/10/10 exatos", () => {
  const o = calcularOrcamento(M);
  const t = (x) => x.N + x.R + x.S;
  assert.deepEqual(o.normal, {
    dir_adm: { N: 20, R: 7, S: 3 }, dir_const: { N: 20, R: 7, S: 3 }, dir_pen: { N: 20, R: 7, S: 3 },
    dir_proc_pen: { N: 20, R: 7, S: 3 }, dir_pen_mil: { N: 13, R: 5, S: 2 }, dir_hum: { N: 13, R: 5, S: 2 },
  });
  assert.deepEqual(o.simulado, {
    dir_adm: { N: 4, R: 2, S: 15 }, dir_const: { N: 4, R: 2, S: 15 }, dir_pen: { N: 4, R: 2, S: 15 },
    dir_proc_pen: { N: 4, R: 2, S: 15 }, dir_pen_mil: { N: 3, R: 1, S: 10 }, dir_hum: { N: 3, R: 1, S: 10 },
  });
  assert.deepEqual(o.totalNormal, { N: 106, R: 38, S: 16 });
  assert.deepEqual(o.totalSimulado, { N: 22, R: 10, S: 80 });
  assert.equal(t(o.totalNormal), 160);
  assert.equal(t(o.totalSimulado), 112);
  // cabe no tempo: 8 h = 480 min
  assert.equal(o.minutosNormal, 480);
  assert.equal(o.minutosSimulado, 456);
  // ciclo: 9 normais + 3 de simulado
  assert.equal(9 * 160 + 3 * 112, 1776);
});

test("orçamento declarado no manifesto = recalculado; mexer num número reprova", () => {
  const o = calcularOrcamento(M);
  assert.deepEqual(M.orcamento.semanaNormal, o.normal);
  assert.deepEqual(M.orcamento.semanaSimulado, o.simulado);
  const m = copia(); m.orcamento.semanaNormal.dir_hum.N = 15;
  assert.ok(validarFonte(m).some((e) => /semanaNormal\.dir_hum/.test(e)));
  const horas = copia(); horas.turmaPadrao.horasQuestoesComCorrecao = 10;
  assert.ok(validarFonte(horas).some((e) => /horas da turma não somam|recalculado/.test(e)));
});

test("a soma das metas das missões confere com as questões novas da semana", () => {
  for (const n of [1, 2, 3]) {
    const soma = M.missoes.filter((x) => x.semana === n).reduce((s, x) => s + x.metaQuestoes, 0);
    assert.equal(soma, 106, `semana ${n}`);
  }
  assert.ok(M.missoes.filter((x) => x.semana === 4).every((x) => x.metaQuestoes === null && x.tipo === "manual"),
    "semana de simulado: acompanhamento manual");
  const m = copia(); m.missoes[0].metaQuestoes = 25;
  const erros = validarFonte(m);
  assert.ok(erros.some((e) => /PMERJ-M01-ADM: meta 25, orçamento 20/.test(e)));
  assert.ok(erros.some((e) => /semana 1: metas somam 111/.test(e)));
});

// ── missões ──────────────────────────────────────────────────────────

test("24 missões escritas (semanas 1–4) e 48 pendentes (semanas 5–12), uma por matéria e semana", () => {
  assert.equal(M.missoes.length, 24);
  assert.equal(M.missoesPendentes.length, 48);
  assert.ok(M.missoes.every((x) => x.semana <= 4 && x.nome && x.objetivo));
  assert.ok(M.missoesPendentes.every((x) => x.semana >= 5 && x.status === "pendente" && !x.nome));
  const m = copia(); m.missoesPendentes[0].nome = "rascunho";
  assert.ok(validarFonte(m).some((e) => /pendente PMERJ-M05-ADM não deve ter texto/.test(e)));
});

test("missão aponta linha da própria matéria, já introduzida, e não promete domínio", () => {
  const m1 = copia(); m1.missoes[0].assunto = "CONST-01"; m1.missoes[0].linhas.push("CONST-01");
  assert.ok(validarFonte(m1).some((e) => /PMERJ-M01-ADM aponta assunto de outra matéria/.test(e)));
  const m2 = copia(); m2.missoes[0].assunto = "ADM-40"; m2.missoes[0].linhas.push("ADM-40");
  assert.ok(validarFonte(m2).some((e) => /usa ADM-40, que só aparece na semana 4/.test(e)));
  const m3 = copia(); m3.missoes[0].nome = "Domínio completo de organização administrativa";
  assert.ok(validarFonte(m3).some((e) => /promete domínio/.test(e)));
});

// ── datas: parâmetro, nunca valor fixo ───────────────────────────────

test("o manifesto não tem nenhuma data fixa", () => {
  assert.doesNotMatch(ler("supabase/seed/trilha-pmerj-cfo-v1.json"), /\b20\d\d-\d\d-\d\d\b/);
  assert.equal(M.dataProvaConfirmada, null);
});

test("--inicio é obrigatório e precisa ser segunda-feira; --turma é inteiro positivo", () => {
  assert.deepEqual(validarParametros({ inicio: "2026-10-05", turma: 1 }), []);
  assert.match(validarParametros({ turma: 1 })[0], /--inicio é obrigatório/);
  assert.match(validarParametros({ inicio: "2026-10-06", turma: 1 })[0], /não é segunda-feira/);
  assert.match(validarParametros({ inicio: "2026-02-30", turma: 1 })[0], /não é uma data válida/);
  assert.match(validarParametros({ inicio: "2026-10-05", turma: 0 })[0], /--turma/);
  assert.throws(() => gerarSql(M, { turma: 1 }), /--inicio é obrigatório/);
});

test("as 12 semanas saem do parâmetro, de segunda a domingo, sem lacuna", () => {
  for (const inicio of ["2026-10-05", "2027-03-01"]) {
    const s = montarSemanas(M, inicio);
    assert.equal(s.length, 12);
    assert.equal(s[0].inicio, inicio);
    for (let i = 0; i < 12; i += 1) {
      assert.equal(new Date(`${s[i].inicio}T00:00:00Z`).getUTCDay(), 1);
      assert.equal(new Date(`${s[i].fim}T00:00:00Z`).getUTCDay(), 0);
      if (i) assert.equal((new Date(s[i].inicio) - new Date(s[i - 1].fim)) / 86_400_000, 1);
    }
    assert.deepEqual(s.map((x) => x.metaQuestoes), [160, 160, 160, 112, 160, 160, 160, 112, 160, 160, 160, 112]);
  }
});

test("gerar duas vezes dá o mesmo SQL; outro início muda só as datas", () => {
  const a = gerarSql(M, { inicio: "2026-10-05", turma: 1 });
  assert.equal(gerarSql(M, { inicio: "2026-10-05", turma: 1 }), a);
  const b = gerarSql(M, { inicio: "2027-03-01", turma: 1 });
  assert.notEqual(b, a);
  const semDatas = (x) => x.replace(/\b20\d\d-\d\d-\d\d\b/g, "D");
  assert.equal(semDatas(b), semDatas(a));
  assert.match(a, /'2026-10-05', '2026-10-11'/);
  assert.match(a, /'2026-12-21', '2026-12-27'/);
});

test("atividades: conteúdo e revisão por matéria, escrita toda semana, simulado nas 4, 8 e 12", () => {
  const atv = montarAtividades(M);
  for (let n = 1; n <= 12; n += 1) {
    const sem = atv.filter((a) => a.semana === n);
    assert.equal(sem.length, [4, 8, 12].includes(n) ? 14 : 13, `semana ${n}`);
    assert.ok(sem.some((a) => a.s === "esc"));
  }
  const s1 = atv.find((a) => a.semana === 1 && a.s === "dir_adm" && a.p === "F");
  assert.match(s1.t, /Missão: Organização administrativa/);
  assert.match(s1.t, /20 questões novas/);
  assert.ok(atv.every((a) => !/\b1 questões\b/.test(a.t)));
});

test("o gerador PMERJ não reaproveita as regras de data e rodízio da EsPCEx", () => {
  const src = ler("scripts/gerar-seed-trilha-pmerj-cfo.mjs");
  assert.doesNotMatch(src, /from "\.\/gerar-seed-trilha(-espcex)?\.mjs"/);
  assert.doesNotMatch(src, /deslocamentoSemana|semanasConteudo/);
  assert.doesNotMatch(src, /delete from atividades_modelo/, "turma com meta gerada não pode perder atividade");
  assert.doesNotMatch(src, /maturidade\s*=/, "a maturidade é carimbada pelo seed 18");
});
