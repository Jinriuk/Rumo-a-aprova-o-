// ============================================================
// BLOCO 2 (23/09/2026) — LGPD E COERÊNCIA (D01, D03, D10, D11, N02)
// ------------------------------------------------------------
// D01/D03  o contador de consentimentos é "N de M alunos" e só fica
//          verde quando todos têm; nas capturas de 19/09 o "0" saía em
//          verde, a cor de sucesso. Quem falta aparece nominalmente.
// D10      a trilha de acesso mostrava o código cru do papel
//          ("coordenacao", "responsavel").
// D11      o card "Último acesso" tinha como valor a palavra
//          "registrado"; a data ficava escondida no subtítulo.
// N02      consentimentos.registrado_em: quando a LINHA entrou no banco,
//          sempre o real — nem o default nem a coordenação conseguem
//          forjar (a coordenação tem INSERT/UPDATE em todas as colunas).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, como, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";
import {
  rotuloPapel, resumirConsentimentos, formatarUltimoAcesso,
} from "../app/src/modules/consentimento/conformidade.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(resolve(root, p), "utf8");
const PAINEL = "app/src/modules/consentimento/PainelConformidade.jsx";

test.after(async () => { await pool.end(); });

// ── D01/D03 ────────────────────────────────────────────────────────
const alunos = Object.fromEntries(
  ["Helena", "Camila", "Rafael", "Gustavo", "Beatriz", "Thiago", "Larissa", "Enzo"]
    .map((n, i) => [`a${i}`, { id: `a${i}`, nome: `${n} Teste` }]),
);
const consentimentoDe = (ids) => ids.map((id, i) => ({ id: `c${i}`, aluno_id: id }));

test("D03: 7 de 8 é âmbar, e o Enzo aparece como pendente", () => {
  const r = resumirConsentimentos(consentimentoDe(["a0", "a1", "a2", "a3", "a4", "a5", "a6"]), alunos);
  assert.equal(r.consentidos, 7);
  assert.equal(r.total, 8);
  assert.equal(r.tom, "alerta");
  assert.deepEqual(r.pendentes.map((a) => a.nome), ["Enzo Teste"]);
});

test("D03: zero consentimentos também é âmbar (era verde nas capturas de 19/09)", () => {
  assert.equal(resumirConsentimentos([], alunos).tom, "alerta");
});

test("D03: verde só quando todos os alunos têm consentimento", () => {
  const r = resumirConsentimentos(consentimentoDe(Object.keys(alunos)), alunos);
  assert.equal(r.tom, "ok");
  assert.equal(r.completo, true);
  assert.deepEqual(r.pendentes, []);
});

test("D03: escola sem aluno não é verde nem âmbar", () => {
  assert.equal(resumirConsentimentos([], {}).tom, "neutro");
});

test("D03: consentimento duplicado ou de aluno removido não fecha a conta", () => {
  const r = resumirConsentimentos(
    [...consentimentoDe(["a0", "a0", "a1"]), { id: "x", aluno_id: "removido" }], alunos);
  assert.equal(r.consentidos, 2);
  assert.equal(r.tom, "alerta");
});

test("D03: o painel usa o tom calculado, não um 'ok' fixo", () => {
  const codigo = src(PAINEL);
  assert.doesNotMatch(codigo, /rotulo="Consentimentos"[^>]*tom="ok"/, "o contador voltou a ser sempre verde");
  assert.match(codigo, /rotulo="Consentimentos"[\s\S]{0,80}tom=\{cons\.tom\}/);
  assert.match(codigo, /cons\.pendentes\.map/, "os alunos pendentes precisam aparecer pelo nome");
});

// ── D10 ────────────────────────────────────────────────────────────
test("D10: os três papéis de logs_acesso viram rótulo legível", () => {
  assert.equal(rotuloPapel("coordenacao"), "Coordenação");
  assert.equal(rotuloPapel("responsavel"), "Responsável");
  assert.equal(rotuloPapel("aluno"), "Aluno");
  assert.equal(rotuloPapel("outro"), "outro", "papel desconhecido aparece como veio, não some");
});

test("D10: a trilha de acesso não mostra mais o código cru", () => {
  const codigo = src(PAINEL);
  assert.doesNotMatch(codigo, /\{l\.papel\} ·/, "voltou a imprimir l.papel direto");
  assert.match(codigo, /rotuloPapel\(l\.papel\)/);
});

// ── D11 ────────────────────────────────────────────────────────────
test("D11: data e hora são o valor, no fuso do produto", () => {
  const agora = new Date("2026-09-23T20:00:00Z");
  assert.equal(formatarUltimoAcesso("2026-09-23T19:43:00Z", agora), "23/09 16:43");
  // 23:30 em Brasília ainda é dia 23, mesmo já sendo 24 em UTC
  assert.equal(formatarUltimoAcesso("2026-09-24T02:30:00Z", agora), "23/09 23:30");
  assert.equal(formatarUltimoAcesso("2025-12-31T12:00:00Z", agora), "31/12/2025 09:00", "ano só quando não é o corrente");
  assert.equal(formatarUltimoAcesso(null, agora), "—");
  assert.equal(formatarUltimoAcesso("não é data", agora), "—");
});

test("D11: o card não usa mais a palavra 'registrado' como valor", () => {
  const codigo = src(PAINEL);
  assert.doesNotMatch(codigo, /valor=\{logs\.length \? "registrado"/);
  assert.match(codigo, /rotulo="Último acesso" valor=\{formatarUltimoAcesso\(/);
});

test("D02 NÃO entra neste bloco: o texto jurídico continua o aprovado até o advogado validar", () => {
  const codigo = src(PAINEL);
  assert.match(codigo, /esta página é a sua prova de conformidade/,
    "o texto da página LGPD só muda com aprovação do Gabriel e validação do advogado — ao aprovar o D02, troque esta asserção pelo texto novo");
});

// ── N02 (migration 0053) ───────────────────────────────────────────
const inserirConsentimento = (c, extra = "", valores = "") => c.query(
  `insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por, aceito_em${extra})
   values ($1, $2, 'Responsável N02', $3, timestamptz '2026-08-26 10:00-03'${valores}) returning *`,
  [ESCOLA_A, ALUNO_LUCAS, IDS.coordA.sub]);

test("N02: registrado_em existe, é obrigatório e nasce com o momento real", async () => {
  await como(IDS.coordA, async (c) => {
    const agora = (await c.query("select now() as t")).rows[0].t;
    const r = (await inserirConsentimento(c)).rows[0];
    assert.equal(+r.registrado_em, +agora, "registrado_em = now() da transação");
    assert.equal(r.aceito_em.toISOString(), "2026-08-26T13:00:00.000Z", "aceito_em retroativo continua permitido");
  });
  const col = await pool.query(
    `select is_nullable from information_schema.columns
      where table_name = 'consentimentos' and column_name = 'registrado_em'`);
  assert.equal(col.rows[0]?.is_nullable, "NO");
});

test("N02: a coordenação não consegue forjar registrado_em no insert", async () => {
  await como(IDS.coordA, async (c) => {
    const agora = (await c.query("select now() as t")).rows[0].t;
    const r = (await inserirConsentimento(c, ", registrado_em", ", timestamptz '2020-01-01 00:00Z'")).rows[0];
    assert.equal(+r.registrado_em, +agora, "o valor enviado foi ignorado");
  });
});

test("N02: nem no update — o valor gravado não muda, mesmo editando outra coluna", async () => {
  await como(IDS.coordA, async (c) => {
    const r = (await inserirConsentimento(c)).rows[0];
    const u1 = (await c.query(
      "update consentimentos set registrado_em = timestamptz '2020-01-01 00:00Z' where id = $1 returning registrado_em",
      [r.id])).rows[0];
    assert.equal(+u1.registrado_em, +r.registrado_em);
    const u2 = (await c.query(
      "update consentimentos set responsavel_nome = 'Outro nome' where id = $1 returning registrado_em", [r.id])).rows[0];
    assert.equal(+u2.registrado_em, +r.registrado_em);
  });
});
