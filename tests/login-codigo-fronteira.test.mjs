// ============================================================
// 0093 — FRONTEIRA login-por-código: gerar (provisionar-aluno) → logar
// (entrarComCodigo). Regressão real: provisionar-aluno gravava
// `password: codigo` (com traço, "XXXX-XXXX-XXXX") enquanto o front
// normalizava o código (sem traço, maiúsculo) antes de logar. As duas
// pontas nunca batiam — todo login por código falhava.
//
// Por que este teste é diferente de um unitário por lado: os dois lados
// isoladamente "pareciam certos" (backend gera e-mail/senha a partir de
// um código; front normaliza o que o aluno digita) — o bug só existe NA
// FRONTEIRA, quando os dois resultados são comparados. Um teste que
// reimplementasse a lógica à mão nos dois lados (copiando a normalização
// "correta") não pegaria uma divergência real entre os arquivos: se só
// um lado mudasse no futuro, a cópia continuaria "concordando" consigo
// mesma. Por isso este teste EXTRAI as expressões reais de cada arquivo
// fonte (via regex, padrão sec3/d1c já usado no repo — sem runner de
// Deno para executar o .ts direto) e as EXECUTA de verdade, comparando
// o (email, senha) que o backend grava contra o (email, senha) que o
// front enviaria — exatamente o par que o GoTrue usa em
// signInWithPassword. Se baterem, o login funciona; se não, falha aqui
// antes de qualquer deploy.
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

// ── extrai normalizarCodigo() do backend (TS) ──────────────────────────────
const mNormBackend = srcBackend.match(
  /const normalizarCodigo = \(codigo: string\) =>\s*\n?\s*codigo\.(replace\(([\s\S]+?)\));/,
);
assert.ok(
  mNormBackend,
  "não encontrei normalizarCodigo(codigo: string) em provisionar-aluno/index.ts — " +
  "a extração deste teste ficou desatualizada, ajuste o regex junto com a mudança de fonte",
);
const normalizarBackend = new Function("codigo", `return codigo.${mNormBackend[1]};`);

// ── extrai a expressão passada como `password:` no createUser() ───────────
const mPasswordBackend = srcBackend.match(
  /email:\s*emailDoCodigo\(codigo\),\s*\n\s*password:\s*([^,\n]+),/,
);
assert.ok(
  mPasswordBackend,
  "não encontrei o campo password: do createUser() em provisionar-aluno/index.ts logo após email: emailDoCodigo(codigo) — ajuste o regex junto com a mudança de fonte",
);
const senhaGravada = new Function(
  "codigo", "normalizarCodigo",
  `return ${mPasswordBackend[1]};`,
)("WXYZ-2345-6789", normalizarBackend);

const mEmailBackend = srcBackend.match(
  /const emailDoCodigo = \(codigo: string\) =>\s*\n?\s*`([\s\S]+?)`;/,
);
assert.ok(mEmailBackend, "não encontrei emailDoCodigo() em provisionar-aluno/index.ts");
const emailDoCodigoBackend = new Function(
  "codigo", "normalizarCodigo",
  `return \`${mEmailBackend[1]}\`;`,
);

// ── extrai normalizarCodigo() e entrarComCodigo() do front (JS) ────────────
const mNormFrontend = srcFrontend.match(
  /export function normalizarCodigo\(texto\) \{\s*\n\s*return (texto\.[\s\S]+?);\s*\n\}/,
);
assert.ok(
  mNormFrontend,
  "não encontrei normalizarCodigo(texto) em shared/data/index.js — " +
  "a extração deste teste ficou desatualizada, ajuste o regex junto com a mudança de fonte",
);
const normalizarFrontend = new Function("texto", `return ${mNormFrontend[1]};`);

const mEntrarComCodigo = srcFrontend.match(
  /export async function entrarComCodigo\(codigo\) \{([\s\S]+?)\n\}/,
);
assert.ok(mEntrarComCodigo, "não encontrei entrarComCodigo(codigo) em shared/data/index.js");
const corpoEntrarComCodigo = mEntrarComCodigo[1];

assert.match(
  corpoEntrarComCodigo, /const canonico = normalizarCodigo\(codigo\);/,
  "entrarComCodigo deve normalizar o código digitado antes de tudo",
);
const mEmailFrontend = corpoEntrarComCodigo.match(/email:\s*`([\s\S]+?)`,/);
const mPasswordFrontend = corpoEntrarComCodigo.match(/password:\s*([^,\n]+),/);
assert.ok(mEmailFrontend, "não encontrei o email: de signInWithPassword em entrarComCodigo");
assert.ok(mPasswordFrontend, "não encontrei o password: de signInWithPassword em entrarComCodigo");

const emailFrontendFn = new Function("canonico", `return \`${mEmailFrontend[1]}\`;`);
const senhaEnviadaFn = new Function("canonico", `return ${mPasswordFrontend[1]};`);

// ── monta o e-mail que o backend grava, pra comparar com o do front ────────
const emailGravado = emailDoCodigoBackend("WXYZ-2345-6789", normalizarBackend);

test("fronteira: e-mail gravado no provisionamento === e-mail que o front usa pra logar", () => {
  const canonicoFrontend = normalizarFrontend("WXYZ-2345-6789");
  const emailEnviado = emailFrontendFn(canonicoFrontend);
  assert.equal(emailGravado, emailEnviado);
});

test("fronteira: senha gravada no provisionamento === senha que o front envia (código exibido, sem variação)", () => {
  const canonicoFrontend = normalizarFrontend("WXYZ-2345-6789");
  const senhaEnviada = senhaEnviadaFn(canonicoFrontend);
  assert.equal(
    senhaGravada, senhaEnviada,
    "REGRESSÃO 0093: a senha gravada por provisionar-aluno não bate com a " +
    "senha que entrarComCodigo envia — todo login por código vai falhar",
  );
});

// ── ponta a ponta: aluno digita o código exibido do jeito que a tela manda
//    ("sem espaços ou traços"), variando caixa e espaçamento acidental —
//    normalizarCodigo tem que absorver isso e ainda bater com o backend.
for (const digitado of ["WXYZ23456789", "wxyz23456789", " WXYZ-2345-6789 ", "wxyz 2345 6789"]) {
  test(`fronteira: login funciona quando o aluno digita "${digitado}"`, () => {
    const canonicoFrontend = normalizarFrontend(digitado);
    const emailEnviado = emailFrontendFn(canonicoFrontend);
    const senhaEnviada = senhaEnviadaFn(canonicoFrontend);
    assert.equal(emailEnviado, emailGravado, "e-mail não bate com o gravado no provisionamento");
    assert.equal(
      senhaEnviada, senhaGravada,
      `login falharia: senha enviada para "${digitado}" não bate com a gravada no provisionamento`,
    );
  });
}
