// ============================================================
// O ÍNDICE DE STATUS NÃO PODE VENCER EM SILÊNCIO
// ------------------------------------------------------------
// `docs/00-indices/03-status-atual.md` ficou dois meses e meio dizendo
// "475 testes, 37 migrations, 6 Edge Functions" e "liberado para piloto
// controlado pequeno / nenhum P0/P1 de segurança aberto" enquanto o
// repositório tinha quase o dobro de testes, 51 migrations, 7 funções e
// um S1 aberto. Um índice assim não é só "antigo": é a página que
// alguém lê para decidir se coloca aluno real dentro, e ela respondia
// por um sistema que não existia mais.
//
// Documento não tem CI, então ele vira teste. Estas travas cobrem só o
// que ROTA sozinho — contagens de arquivo — e a contradição interna que
// deixou a versão anterior perigosa. Não travam prosa.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDICE = resolve(root, "docs/00-indices/03-status-atual.md");
const doc = readFileSync(INDICE, "utf8");

test("índice: a contagem de migrations declarada é a real", () => {
  const reais = readdirSync(resolve(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).length;
  const m = doc.match(/\|\s*Migrations no repo\s*\|\s*\*\*(\d+)\*\*/);
  assert.ok(m, "a linha de migrations sumiu do índice");
  assert.equal(+m[1], reais,
    `o índice diz ${m[1]} migrations e existem ${reais} — atualize docs/00-indices/03-status-atual.md`);
});

test("índice: a contagem de Edge Functions declarada é a real", () => {
  const reais = readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_shared").length;
  const m = doc.match(/\|\s*Edge Functions no repo\s*\|\s*\*\*(\d+)\*\*/);
  assert.ok(m, "a linha de Edge Functions sumiu do índice");
  assert.equal(+m[1], reais,
    `o índice diz ${m[1]} Edge Functions e existem ${reais}`);
});

test("índice: a contagem de arquivos de teste declarada é a real", () => {
  const reais = readdirSync(resolve(root, "tests"))
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => readFileSync(resolve(root, "tests", f), "utf8").includes("node:test")).length;
  const m = doc.match(/\|\s*Arquivos de teste\s*\|\s*\*\*(\d+)\*\*/);
  assert.ok(m, "a linha de arquivos de teste sumiu do índice");
  assert.equal(+m[1], reais,
    `o índice diz ${m[1]} arquivos de teste e existem ${reais}`);
});

test("índice: não declara liberação para piloto nem ausência de P0/P1 de segurança", () => {
  // as duas frases que tornaram a versão de julho perigosa. O Plano
  // Mestre exige G3 antes do primeiro aluno real, e G3 depende de
  // ambiente, e-mail, backup/restore, RLS, monitoramento, E2E e
  // jurídico — nada disso se prova a partir deste repositório.
  // o próprio índice EXPLICA que essas frases foram retiradas; citar não
  // é afirmar. Tudo entre aspas sai antes da checagem, junto das citações
  // em bloco — o que sobra é o que o documento AFIRMA por conta própria.
  const semCitacoes = doc
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join("\n")
    .replace(/"[^"]*"/g, "")
    .replace(/“[^”]*”/g, "");
  assert.doesNotMatch(semCitacoes, /\*\*liberado para piloto/i,
    "o índice voltou a declarar liberação para piloto");
  assert.doesNotMatch(semCitacoes, /Nenhum P0\/P1 de segurança\s*\n?\s*aberto/i,
    "o índice voltou a declarar ausência de P0/P1 de segurança");
});

test("índice: todo número remoto vem marcado como não verificado", () => {
  // o erro anterior não foi ter número remoto — foi repetir o de julho
  // como se fosse de hoje. Se a linha existir, ela tem que dizer como
  // foi obtida.
  for (const rotulo of ["Migrations no ledger remoto", "Tabelas públicas remotas", "Edge Functions ACTIVE"]) {
    const linha = doc.split("\n").find((l) => l.includes(rotulo));
    if (!linha) continue;
    assert.match(linha, /não verificado/i,
      `"${rotulo}" voltou a trazer número remoto sem dizer que não foi verificado`);
  }
});
