// ============================================================
// FRONTEIRA login-por-código — email e senha, backend ↔ frontend
// ------------------------------------------------------------
// Este arquivo cobriu originalmente a regressão 0093: provisionar-aluno
// gravava `password: codigo` (com traço) enquanto o front normalizava o
// código (sem traço) antes de logar — as duas pontas nunca batiam.
//
// Etapa 7 / BLOCO B1 muda a premissa por baixo desse teste: a senha
// DEIXOU de ser derivada do código nos dois lados. Não existe mais uma
// fórmula "senha = f(código)" pra extrair e comparar — comparar duas
// expressões que não dependem mais do mesmo input não prova nada. A
// invariante que IMPORTA agora é a oposta: senha NUNCA é função do
// código, nem no backend (senha é CSPRNG, `novaSenhaTemporaria()`) nem
// no front (senha é o que o aluno digitou, `senha` — parâmetro, não
// `normalizarCodigo(codigo)`).
//
// O E-MAIL continua sendo derivado do código dos dois lados (código
// segue sendo IDENTIFICADOR — é isso que resolve qual conta é qual) —
// essa parte do teste original (extrair a expressão real de cada
// arquivo e executá-la) continua de pé, sem mudança de método.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const srcBackend = readFileSync(
  resolve(root, "supabase/functions/provisionar-aluno/index.ts"), "utf8",
);
const srcFrontend = readFileSync(
  resolve(root, "app/src/shared/data/index.js"), "utf8",
);

// ============================================================
// PARTE 1 — e-mail: continua derivado do código, dos dois lados,
// executando o código REAL extraído de cada arquivo (não uma cópia).
// ============================================================

const mNormBackend = srcBackend.match(
  /const normalizarCodigo = \(codigo: string\) =>\s*\n?\s*codigo\.(replace\(([\s\S]+?)\));/,
);
assert.ok(
  mNormBackend,
  "não encontrei normalizarCodigo(codigo: string) em provisionar-aluno/index.ts — " +
  "a extração deste teste ficou desatualizada, ajuste o regex junto com a mudança de fonte",
);
const normalizarBackend = new Function("codigo", `return codigo.${mNormBackend[1]};`);

const mEmailBackend = srcBackend.match(
  /const emailDoCodigo = \(codigo: string\) =>\s*\n?\s*`([\s\S]+?)`;/,
);
assert.ok(mEmailBackend, "não encontrei emailDoCodigo() em provisionar-aluno/index.ts");
const emailDoCodigoBackend = new Function(
  "codigo", "normalizarCodigo",
  `return \`${mEmailBackend[1]}\`;`,
);

const mNormFrontend = srcFrontend.match(
  /export function normalizarCodigo\(texto\) \{\s*\n\s*return (texto\.[\s\S]+?);\s*\n\}/,
);
assert.ok(
  mNormFrontend,
  "não encontrei normalizarCodigo(texto) em shared/data/index.js — " +
  "a extração deste teste ficou desatualizada, ajuste o regex junto com a mudança de fonte",
);
const normalizarFrontend = new Function("texto", `return ${mNormFrontend[1]};`);

// BLOCO B1: entrarComCodigo agora recebe (codigo, senha) — dois
// parâmetros, não mais um. O e-mail continua vindo só do código.
const mEntrarComCodigo = srcFrontend.match(
  /export async function entrarComCodigo\(codigo, senha\) \{([\s\S]+?)\n\}/,
);
assert.ok(
  mEntrarComCodigo,
  "não encontrei entrarComCodigo(codigo, senha) em shared/data/index.js — " +
  "se a assinatura voltou a ser (codigo) só, isso é REGRESSÃO do BLOCO B1",
);
const corpoEntrarComCodigo = mEntrarComCodigo[1];

assert.match(
  corpoEntrarComCodigo, /const canonico = normalizarCodigo\(codigo\);/,
  "entrarComCodigo deve normalizar o código digitado antes de tudo",
);
const mEmailFrontend = corpoEntrarComCodigo.match(/email:\s*`([\s\S]+?)`,/);
assert.ok(mEmailFrontend, "não encontrei o email: de signInWithPassword em entrarComCodigo");
const emailFrontendFn = new Function("canonico", `return \`${mEmailFrontend[1]}\`;`);

const emailGravado = emailDoCodigoBackend("WXYZ-2345-6789", normalizarBackend);

test("fronteira: e-mail gravado no provisionamento === e-mail que o front usa pra logar", () => {
  const canonicoFrontend = normalizarFrontend("WXYZ-2345-6789");
  const emailEnviado = emailFrontendFn(canonicoFrontend);
  assert.equal(emailGravado, emailEnviado);
});

// ponta a ponta: aluno digita o código exibido do jeito que a tela manda
// ("sem espaços ou traços"), variando caixa e espaçamento acidental —
// normalizarCodigo tem que absorver isso e ainda bater com o backend.
for (const digitado of ["WXYZ23456789", "wxyz23456789", " WXYZ-2345-6789 ", "wxyz 2345 6789"]) {
  test(`fronteira: e-mail resolve certo quando o aluno digita "${digitado}"`, () => {
    const canonicoFrontend = normalizarFrontend(digitado);
    const emailEnviado = emailFrontendFn(canonicoFrontend);
    assert.equal(emailEnviado, emailGravado, "e-mail não bate com o gravado no provisionamento");
  });
}

// ============================================================
// PARTE 2 — senha: a invariante VIROU independência, não igualdade.
// REGRESSÃO 0093-like seria isto voltar a acoplar senha a código, dos
// dois lados ou de um só (bastaria um lado pra o bug antigo voltar).
// ============================================================

test("backend: password do createUser() NÃO é normalizarCodigo(codigo) — é senha própria", () => {
  const m = srcBackend.match(
    /email:\s*emailDoCodigo\(codigo\),\s*\n\s*password:\s*([^,\n]+),/,
  );
  assert.ok(m, "não encontrei o campo password: do createUser() logo após email: emailDoCodigo(codigo)");
  const expressao = m[1].trim();
  assert.equal(expressao, "senhaTemporaria", `password do createUser() mudou pra "${expressao}" — se voltou a referenciar codigo/normalizarCodigo, é a REGRESSÃO 0093`);
  assert.ok(!/codigo/i.test(expressao), "password do createUser() referencia 'codigo' — não deveria depender dele");
});

test("backend: novaSenhaTemporaria() não recebe nem usa o código como entrada", () => {
  const m = srcBackend.match(/function novaSenhaTemporaria\(\)[\s\S]{0,10}?\{([\s\S]+?)\n\}/);
  assert.ok(m, "não encontrei novaSenhaTemporaria() em provisionar-aluno/index.ts");
  assert.ok(!/codigo/i.test(m[1]), "novaSenhaTemporaria() referencia 'codigo' — deveria ser puramente aleatória");
  assert.match(m[1], /crypto\.getRandomValues/, "novaSenhaTemporaria() não usa CSPRNG");
});

test("frontend: entrarComCodigo envia a SENHA DIGITADA, não uma derivação do código", () => {
  const m = corpoEntrarComCodigo.match(/password:\s*([^,\n]+),/);
  assert.ok(m, "não encontrei o password: de signInWithPassword em entrarComCodigo");
  const expressao = m[1].trim();
  assert.equal(expressao, "senha", `password enviado mudou pra "${expressao}" — se voltou a ser canonico/codigo, é a REGRESSÃO 0093`);
});

test("resetar-senha e reativar-credencial usam o MESMO gerador (não duas fontes de aleatoriedade)", () => {
  // conta só CHAMADAS (const x = novaSenhaTemporaria()), não a declaração
  // da função (que também contém a substring "novaSenhaTemporaria()").
  const ocorrencias = (srcBackend.match(/=\s*novaSenhaTemporaria\(\)/g) ?? []).length;
  // 1x na criação + 1x no bloco de reset/reativação (lidarComCredencial)
  assert.equal(ocorrencias, 2, `novaSenhaTemporaria() chamada ${ocorrencias}x — esperado 2 (criação + lidarComCredencial)`);
});
