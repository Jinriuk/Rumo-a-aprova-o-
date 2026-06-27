// ============================================================
// CSV (PERF1, Camada 4.6) — serialização pura, testável sem
// banco nem navegador.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { paraCSV, nomeArquivoSeguro } from "../app/src/shared/lib/csv.js";

const COLS = [
  { chave: "nome", rotulo: "Aluno" },
  { chave: "q", rotulo: "Questões" },
  { chave: "acc", rotulo: "Acerto %" },
];

test("paraCSV: cabeçalho + linhas com separador ; e CRLF", () => {
  const csv = paraCSV(COLS, [{ nome: "Ana", q: 100, acc: 75 }, { nome: "Bia", q: 0, acc: "" }]);
  assert.equal(csv, "Aluno;Questões;Acerto %\r\nAna;100;75\r\nBia;0;");
});

test("paraCSV: lista vazia devolve só o cabeçalho", () => {
  assert.equal(paraCSV(COLS, []), "Aluno;Questões;Acerto %");
  assert.equal(paraCSV(COLS, null), "Aluno;Questões;Acerto %");
});

test("paraCSV: null/undefined viram célula vazia (nunca o texto 'null')", () => {
  const csv = paraCSV(COLS, [{ nome: "Ana", q: null, acc: undefined }]);
  assert.equal(csv, "Aluno;Questões;Acerto %\r\nAna;;");
});

test("paraCSV: célula com separador, aspas ou quebra de linha é escapada (RFC 4180)", () => {
  const cols = [{ chave: "t", rotulo: "Texto" }];
  assert.equal(paraCSV(cols, [{ t: "a;b" }]), 'Texto\r\n"a;b"');
  assert.equal(paraCSV(cols, [{ t: 'diz "oi"' }]), 'Texto\r\n"diz ""oi"""');
  assert.equal(paraCSV(cols, [{ t: "linha1\nlinha2" }]), 'Texto\r\n"linha1\nlinha2"');
});

test("paraCSV: separador customizável (vírgula)", () => {
  const csv = paraCSV(COLS, [{ nome: "Ana", q: 1, acc: 2 }], { separador: "," });
  assert.equal(csv, "Aluno,Questões,Acerto %\r\nAna,1,2");
  // com vírgula como separador, um valor com vírgula é aspeado, não o com ';'
  const cols = [{ chave: "t", rotulo: "T" }];
  assert.equal(paraCSV(cols, [{ t: "a,b" }], { separador: "," }), 'T\r\n"a,b"');
  assert.equal(paraCSV(cols, [{ t: "a;b" }], { separador: "," }), "T\r\na;b");
});

test("nomeArquivoSeguro: tira acento, espaço e caractere inválido", () => {
  assert.equal(nomeArquivoSeguro("Colégio São João", false), "colegio-sao-joao");
  assert.equal(nomeArquivoSeguro("  ---  ", false), "relatorio");
  assert.equal(nomeArquivoSeguro("", false), "relatorio");
  assert.equal(nomeArquivoSeguro(null, false), "relatorio");
});

test("nomeArquivoSeguro: anexa a data ISO por padrão", () => {
  const hoje = new Date().toISOString().slice(0, 10);
  assert.equal(nomeArquivoSeguro("Escola X"), `escola-x-${hoje}`);
});
