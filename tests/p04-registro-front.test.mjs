// ============================================================
// P0.4 — lado do FRONT: o registro sai com missão e assunto certos
// ------------------------------------------------------------
// O banco (0064) confere tudo; aqui a prova é que o front MANDA o que o
// aluno quis dizer:
//   • registro sem missão sai 'livre' (soma volume, não conclui missão);
//   • "Praticar esta missão" sai 'missao' com o id dela, presa à matéria;
//   • "Registrar revisão" sai 'revisao' com o id da missão revisada;
//   • a recusa do servidor chega legível ao aluno.
// O lado banco está em p04-registro-tematico-db.test.mjs.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validarRegistroEstudo } from "../app/src/shared/contratos/registroEstudo.js";
import { contextoRegistroDaMissao, contextoRegistroDaAtividade } from "../app/src/modules/motor/jornada.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const FORM = { data: "2026-10-03", disciplina_codigo: "mat", topico: "Funções", questoes: "20", acertos: "18", tempo: "", obs: "" };
const MISSAO = { id: "m-1", nome: "Funções integradas", materia_codigo: "mat", meta_questoes: 70, questoes: 20 };

test("sem contexto, o registro é livre e não leva missão", () => {
  const v = validarRegistroEstudo(FORM);
  assert.equal(v.ok, true);
  // sem as chaves: o padrão do banco é 'livre', e o payload segue aceito
  // por um banco ainda sem a 0064 (front e banco podem chegar em ordens
  // diferentes)
  assert.equal("tipo_pratica" in v.campos, false);
  assert.equal("missao_id" in v.campos, false);
});

test("objetivo da semana (atividade) continua livre: não é missão", () => {
  const trilha = { atividadesPorId: { a1: { id: "a1", disciplina_codigo: "mat", texto: "Bloco", prioridade: "F" } } };
  const ctx = contextoRegistroDaAtividade({ id: "ma1", atividade_modelo_id: "a1" }, trilha);
  const v = validarRegistroEstudo(FORM, ctx);
  assert.equal("tipo_pratica" in v.campos, false);
  assert.equal("missao_id" in v.campos, false);
});

test("praticar a missão: sai 'missao' com o id dela e sugere o que falta", () => {
  const ctx = contextoRegistroDaMissao(MISSAO, "missao");
  assert.deepEqual(ctx, {
    chave: "missao:m-1", tipo: "missao", missaoId: "m-1", disciplinaCodigo: "mat",
    titulo: "Funções integradas", questoesSugeridas: 50,
  });
  const v = validarRegistroEstudo(FORM, ctx);
  assert.equal(v.campos.tipo_pratica, "missao");
  assert.equal(v.campos.missao_id, "m-1");
});

test("revisar a missão: sai 'revisao' com o id dela e sem sugestão de volume", () => {
  const ctx = contextoRegistroDaMissao({ ...MISSAO, questoes: 70 }, "revisao");
  assert.equal(ctx.tipo, "revisao");
  assert.equal(ctx.questoesSugeridas, null);
  const v = validarRegistroEstudo(FORM, ctx);
  assert.equal(v.campos.tipo_pratica, "revisao");
  assert.equal(v.campos.missao_id, "m-1");
});

test("prática de missão com outra matéria é barrada antes de ir ao servidor", () => {
  const v = validarRegistroEstudo({ ...FORM, disciplina_codigo: "fis" }, contextoRegistroDaMissao(MISSAO));
  assert.equal(v.ok, false);
  assert.match(v.erros.disciplina, /matéria tem de ser a dela/);
});

test("contexto inválido não vira missão", () => {
  assert.equal(contextoRegistroDaMissao(null), null);
  assert.equal(contextoRegistroDaMissao({ ...MISSAO, materia_codigo: null }), null);
  assert.equal(contextoRegistroDaMissao(MISSAO, "legado"), null, "o cliente nunca pede 'legado'");
  assert.equal("tipo_pratica" in validarRegistroEstudo(FORM, { tipo: "missao" }).campos, false, "sem id, é livre");
});

test("a recusa do servidor chega ao aluno com o motivo, sem detalhe técnico", async () => {
  globalThis.window ??= {};
  const { mensagemAmigavel } = await import("../app/src/shared/lib/erros.js");
  const original = console.error; console.error = () => {};
  try {
    const e = new Error("registrar estudo: registro de estudo: a matéria do registro (fis) não é a da missão (mat)");
    assert.equal(mensagemAmigavel(e, "salvar"), "A matéria do registro (fis) não é a da missão (mat).");
    assert.equal(mensagemAmigavel(new Error("duplicate key"), "salvar"), "Não foi possível salvar agora. Tente novamente em alguns instantes.");
  } finally { console.error = original; }
});

test("telas: o painel de missões tem 'Praticar' e 'Revisão', e a área do aluno liga ao Registrar", () => {
  const painel = semComentarios(ler("app/src/modules/motor/ProgressoVivido.jsx"));
  assert.match(painel, /contextoRegistroDaMissao\(mi, "missao"\)/);
  assert.match(painel, /contextoRegistroDaMissao\(mi, "revisao"\)/);
  assert.match(painel, />\s*Praticar esta missão\s*</);
  assert.match(painel, />\s*Registrar revisão\s*</);
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /<MissoesPersistidas[^>]*aoPraticar=\{podeEditar \? \(contexto\) => irAba\("registrar", contexto\)/s);
  const reg = semComentarios(ler("app/src/modules/motor/Registrar.jsx"));
  assert.match(reg, /validarRegistroEstudo\(f, contextoInicial\)/, "o formulário passa o contexto ao contrato");
  assert.doesNotMatch(reg, /validarRegistroEstudo\(f\)/, "nenhuma validação sem contexto sobrou");
  assert.match(reg, /disabled=\{deMissao\}/, "prática de missão fica presa à matéria");
});

test("modo essencial não esconde o botão da missão, e o registro solto avisa que não avança missão", () => {
  // desde a 0064 o botão é o único caminho que avança missão: o modo
  // essencial deixa o painel compacto, mas não pode tirá-lo da tela
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /<MissoesPersistidas[^>]*compacta=\{essencial\}/s);
  assert.doesNotMatch(visao, /!essencial && examTag && filaMissoes/, "o painel não pode sumir no modo essencial");
  const painel = semComentarios(ler("app/src/modules/motor/ProgressoVivido.jsx"));
  assert.match(painel, /compacta = false/);
  assert.match(painel, /mi\.estado === "atual" \|\| mi\.proxima\)\.slice\(0, 1\)/, "compacto: só a missão da vez de cada matéria");
  const reg = semComentarios(ler("app/src/modules/motor/Registrar.jsx"));
  assert.match(reg, /\{!contextoInicial && \(/);
  assert.match(reg, /Registro livre: entra no seu histórico e no volume, mas não avança missão\. Para avançar uma missão, use o botão “Praticar esta missão” na aba Hoje\./);
});
