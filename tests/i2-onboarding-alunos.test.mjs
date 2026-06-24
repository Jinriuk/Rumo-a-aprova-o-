// I2 — Testes de onboarding de alunos, responsáveis, códigos e trilhas
// Testa lógica de parsing, validação, Edge Functions e segurança via
// inspeção de arquivo. Não faz chamadas reais ao Supabase (sem credenciais CI).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

// ── Helpers extraídos do código de produção para testar em isolamento ──────

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function novoCodigo() {
  const crypto = { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } };
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function normalizarCodigo(texto) {
  return texto.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function emailDoCodigo(codigo) {
  return `${codigo.replace(/-/g, "").toLowerCase()}@codigo.acesso.local`;
}

function nomeValido(nome) {
  return typeof nome === "string" && nome.trim().length >= 2 && nome.trim().length <= 80;
}

function limparNome(nome) {
  return nome.replace(/\s+/g, " ").trim();
}

// CSV parser replicado do CadastroAlunos.jsx
function parsearCsv(texto) {
  const SEP = /[,;|\t]/;
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const cols = linha.split(SEP).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return { nome: cols[0] ?? "", turmaNome: cols[1] ?? "" };
    });
}

function detectarCabecalho(linhas) {
  if (!linhas.length) return false;
  const primeira = (linhas[0].nome ?? "").toLowerCase();
  return /^nome$|^name$|^aluno$|^estudante$/.test(primeira);
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("I2 — Geração de código de acesso", () => {
  it("código tem formato XXXX-XXXX-XXXX", () => {
    const codigo = novoCodigo();
    assert.match(codigo, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("alfabeto não contém caracteres ambíguos 0/O/1/I/L", () => {
    assert.ok(!ALFABETO.includes("0"), "0 está no alfabeto");
    assert.ok(!ALFABETO.includes("O"), "O está no alfabeto");
    assert.ok(!ALFABETO.includes("1"), "1 está no alfabeto");
    assert.ok(!ALFABETO.includes("I"), "I está no alfabeto");
    assert.ok(!ALFABETO.includes("L"), "L está no alfabeto");
  });

  it("normalização remove traços e maiuscula", () => {
    assert.equal(normalizarCodigo("abcd-efgh-ijkm"), "ABCDEFGHIJKM");
  });

  it("código normalizado tem 12 caracteres", () => {
    const codigo = novoCodigo();
    assert.equal(normalizarCodigo(codigo).length, 12);
  });

  it("email sintético derivado do código", () => {
    const email = emailDoCodigo("ABCD-EFGH-IJKM");
    assert.equal(email, "abcdefghijkm@codigo.acesso.local");
  });

  it("email sintético não contém traços", () => {
    const codigo = novoCodigo();
    const email = emailDoCodigo(codigo);
    assert.ok(!email.includes("-"), "email contém traço");
  });
});

describe("I2 — Validação de nomes de alunos", () => {
  it("nome válido: 2 a 80 caracteres", () => {
    assert.ok(nomeValido("Jo"));
    assert.ok(nomeValido("Maria da Silva"));
    assert.ok(nomeValido("A".repeat(80)));
  });

  it("nome inválido: vazio ou muito curto", () => {
    assert.ok(!nomeValido(""));
    assert.ok(!nomeValido("A"));
  });

  it("nome inválido: muito longo", () => {
    assert.ok(!nomeValido("A".repeat(81)));
  });

  it("limparNome remove espaços extras", () => {
    assert.equal(limparNome("  Maria   da   Silva  "), "Maria da Silva");
  });
});

describe("I2 — Parsing de CSV para importação em lote", () => {
  it("CSV simples: uma coluna (nome)", () => {
    const linhas = parsearCsv("Maria da Silva\nJoão Souza");
    assert.equal(linhas.length, 2);
    assert.equal(linhas[0].nome, "Maria da Silva");
    assert.equal(linhas[1].nome, "João Souza");
  });

  it("CSV com duas colunas: nome e turma", () => {
    const linhas = parsearCsv("Maria da Silva,Turma A\nJoão,Turma B");
    assert.equal(linhas[0].turmaNome, "Turma A");
    assert.equal(linhas[1].turmaNome, "Turma B");
  });

  it("CSV com ponto-e-vírgula como separador", () => {
    const linhas = parsearCsv("Maria da Silva;Turma A");
    assert.equal(linhas[0].nome, "Maria da Silva");
    assert.equal(linhas[0].turmaNome, "Turma A");
  });

  it("CSV com pipe como separador", () => {
    const linhas = parsearCsv("Maria|Turma C");
    assert.equal(linhas[0].nome, "Maria");
    assert.equal(linhas[0].turmaNome, "Turma C");
  });

  it("detecção de cabeçalho: primeira linha 'nome' é ignorada", () => {
    const linhas = parsearCsv("nome,turma\nMaria,Turma A");
    assert.ok(detectarCabecalho(linhas));
  });

  it("detecção de cabeçalho: 'Name' em inglês também é ignorado", () => {
    const linhas = parsearCsv("Name\nMaria");
    assert.ok(detectarCabecalho(linhas));
  });

  it("linha com nome vazio é identificada como inválida", () => {
    const linhas = parsearCsv(",Turma A\nMaria,Turma B");
    assert.equal(nomeValido(linhas[0].nome), false);
    assert.equal(nomeValido(linhas[1].nome), true);
  });

  it("aspas são removidas dos valores CSV", () => {
    const linhas = parsearCsv('"Maria da Silva","Turma A"');
    assert.equal(linhas[0].nome, "Maria da Silva");
    assert.equal(linhas[0].turmaNome, "Turma A");
  });

  it("linhas em branco são ignoradas", () => {
    const linhas = parsearCsv("Maria\n\n\nJoão");
    assert.equal(linhas.length, 2);
  });
});

describe("I2 — Segurança e arquivos obrigatórios", () => {
  it("Edge Function revogar-responsavel existe", () => {
    const path = resolve(root, "supabase/functions/revogar-responsavel/index.ts");
    assert.ok(existsSync(path), "supabase/functions/revogar-responsavel/index.ts não existe");
  });

  it("revogar-responsavel valida papel do chamador", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/revogar-responsavel/index.ts"),
      "utf8",
    );
    assert.ok(src.includes("coordenacao"), "função não verifica papel coordenacao");
  });

  it("revogar-responsavel verifica escola_id do vínculo", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/revogar-responsavel/index.ts"),
      "utf8",
    );
    assert.ok(src.includes("quem.escola_id"), "função não confere escola_id");
  });

  it("revogar-responsavel registra log", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/revogar-responsavel/index.ts"),
      "utf8",
    );
    assert.ok(src.includes("logs_coordenacao"), "função não registra log");
  });

  it("nenhum arquivo em app/src/ contém service_role", () => {
    let saida = "";
    try {
      saida = execSync(`grep -r "service_role" "${resolve(root, "app/src")}"`, { encoding: "utf8" });
    } catch { saida = ""; }
    assert.equal(saida.trim(), "", `Encontrou service_role em app/src/: ${saida}`);
  });

  it("VinculosResponsavel.jsx existe e usa revogarResponsavel", () => {
    const path = resolve(root, "app/src/modules/pessoas/VinculosResponsavel.jsx");
    assert.ok(existsSync(path), "VinculosResponsavel.jsx não existe");
    const src = readFileSync(path, "utf8");
    assert.ok(src.includes("revogarResponsavel"), "componente não usa revogarResponsavel");
  });

  it("data/index.js exporta listarTrilhas e listarVinculos", () => {
    const src = readFileSync(resolve(root, "app/src/shared/data/index.js"), "utf8");
    assert.ok(src.includes("export async function listarTrilhas"), "listarTrilhas não exportada");
    assert.ok(src.includes("export async function listarVinculos"), "listarVinculos não exportada");
  });

  it("data/index.js exporta revogarResponsavel", () => {
    const src = readFileSync(resolve(root, "app/src/shared/data/index.js"), "utf8");
    assert.ok(src.includes("revogarResponsavel"), "revogarResponsavel não exportada");
  });
});

describe("I2 — Componentes de onboarding", () => {
  it("CadastroAlunos.jsx exporta PainelCadastroAlunos e NovoAluno", () => {
    const src = readFileSync(
      resolve(root, "app/src/modules/pessoas/CadastroAlunos.jsx"),
      "utf8",
    );
    assert.ok(src.includes("export function PainelCadastroAlunos"), "PainelCadastroAlunos não exportado");
    assert.ok(src.includes("export function NovoAluno"), "NovoAluno não exportado");
  });

  it("CadastroAlunos.jsx tem modo CSV com parsearCsv", () => {
    const src = readFileSync(
      resolve(root, "app/src/modules/pessoas/CadastroAlunos.jsx"),
      "utf8",
    );
    assert.ok(src.includes("parsearCsv"), "parsearCsv não presente");
    assert.ok(src.includes("detectarCabecalho"), "detectarCabecalho não presente");
  });

  it("FichaAluno.jsx tem OnboardingAluno", () => {
    const src = readFileSync(
      resolve(root, "app/src/modules/desempenho/FichaAluno.jsx"),
      "utf8",
    );
    assert.ok(src.includes("OnboardingAluno"), "OnboardingAluno não presente");
    assert.ok(src.includes("salvarOnboarding"), "salvarOnboarding não chamado");
  });

  it("ListaAlunos.jsx importa VinculosResponsavel", () => {
    const src = readFileSync(
      resolve(root, "app/src/modules/pessoas/ListaAlunos.jsx"),
      "utf8",
    );
    assert.ok(src.includes("VinculosResponsavel"), "VinculosResponsavel não importado");
  });

  it("ListaAlunos.jsx tem select de trilha", () => {
    const src = readFileSync(
      resolve(root, "app/src/modules/pessoas/ListaAlunos.jsx"),
      "utf8",
    );
    assert.ok(src.includes("trocarTrilha"), "trocarTrilha não presente");
    assert.ok(src.includes("trilha_id"), "trilha_id não usado");
  });
});
