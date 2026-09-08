// ============================================================
// A3 — Faixa/indicador DEMO cobre a escola, não só o deploy
// ------------------------------------------------------------
// O indicador já existia (commit "Resend real, aluno sem meta vira
// pendente, faixa DEMO e CORS multi-prefixo"), mas só olhava
// `VITE_APP_ENV === "demo"` — uma flag do DEPLOY inteiro (fixada no
// projeto Vercel). Duas lacunas reais, as duas comprováveis no próprio
// banco:
//
//   1. A vitrine/beta têm `escolas.status = 'ativa'`, não `'demo'` — a
//      migration 0031 mudou isso de propósito (a RLS trata status como
//      gate operacional). `escola.status === "demo"` erraria
//      exatamente a escola que o indicador precisa cobrir.
//   2. O job `e2e` do CI builda SEM `VITE_APP_ENV` (só
//      VITE_SUPABASE_URL/ANON_KEY — ver .github/workflows/ci.yml) e
//      roda contra um projeto seedado com a MESMA vitrine (slug
//      'vitrine' — ver docs/operacao/e2e-ambiente.md). Ali EH_DEMO é
//      SEMPRE false: só o sinal da escola pode acender a faixa.
//
// A correção reaproveita `categoriaEscola` (já usada no backoffice,
// Tarefa 38) via `escolaEhDemo`, e mostra a faixa quando EH_DEMO OU a
// escola logada é 'demo' — nunca escondendo o aviso, só ampliando
// quando ele acende.
// ============================================================
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { escolaEhDemo } from "../app/src/shared/branding/demoEscola.js";
import { categoriaEscola } from "../app/src/modules/backoffice/operacao.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");
const lerCodigo = (rel) => ler(rel)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

describe("escolaEhDemo — lógica pura", () => {
  it("vitrine real (status ativa, slug vitrine) é demo — o caso que motivou a correção", () => {
    assert.equal(escolaEhDemo({ status: "ativa", slug: "vitrine", plano: "demo" }), true);
  });

  it("escola.status === 'demo' sozinho também é demo", () => {
    assert.equal(escolaEhDemo({ status: "demo" }), true);
  });

  it("slug ou plano contendo 'demo'/'vitrine' é demo, mesmo status ativa", () => {
    assert.equal(escolaEhDemo({ status: "ativa", slug: "vitrine-naval" }), true);
    assert.equal(escolaEhDemo({ status: "ativa", slug: "colegio-x", plano: "demo-2025" }), true);
  });

  it("escola real (ativa, sem sinal de demo) NÃO acende a faixa", () => {
    assert.equal(escolaEhDemo({ status: "ativa", slug: "colegio-naval", plano: "padrao", limite_alunos: 200 }), false);
  });

  it("escola de teste/piloto NÃO acende a faixa — demo é categoria própria", () => {
    assert.equal(escolaEhDemo({ status: "implantacao" }), false);
    assert.equal(escolaEhDemo({ status: "piloto" }), false);
  });

  it("sem escola (backoffice/superadmin, tela de login) não acende por este sinal", () => {
    assert.equal(escolaEhDemo(null), false);
    assert.equal(escolaEhDemo(undefined), false);
  });

  it("delega para categoriaEscola — nunca diverge da classificação do backoffice", () => {
    const casos = [
      { status: "ativa", slug: "vitrine" },
      { status: "demo" },
      { status: "ativa", plano: "individual" },
      { status: "implantacao" },
      {},
    ];
    for (const c of casos) {
      assert.equal(escolaEhDemo(c), categoriaEscola(c).chave === "demo", `divergiu para ${JSON.stringify(c)}`);
    }
  });
});

describe("demoEscola.js — reaproveita categoriaEscola, não duplica a heurística", () => {
  let codigo;
  before(() => { codigo = lerCodigo("app/src/shared/branding/demoEscola.js"); });

  it("importa categoriaEscola do módulo do backoffice", () => {
    assert.ok(codigo.includes("categoriaEscola"), "categoriaEscola não referenciada");
    assert.match(codigo, /from ["']\.\.\/\.\.\/modules\/backoffice\/operacao\.js["']/);
  });

  it("não reimplementa a checagem de slug/status à mão", () => {
    // trava contra reintroduzir uma segunda heurística que pode divergir
    // da do backoffice (ex.: checar só escola.status === "demo")
    assert.ok(!/escola\?\.\s*slug/.test(codigo) && !/escola\.slug/.test(codigo), "heurística própria de slug em demoEscola.js");
  });

  it("não usa import.meta.env — precisa ser importável em node --test", () => {
    assert.ok(!codigo.includes("import.meta"), "demoEscola.js ganhou dependência de import.meta.env");
  });
});

describe("ambiente.js — reexporta escolaEhDemo sem duplicar", () => {
  it("reexporta de demoEscola.js em vez de reimplementar", () => {
    const codigo = lerCodigo("app/src/shared/branding/ambiente.js");
    assert.match(codigo, /export\s*\{\s*escolaEhDemo\s*\}\s*from\s*["']\.\/demoEscola\.js["']/);
  });
});

describe("meuPerfil — seleciona 'plano' (escolaEhDemo precisa dele)", () => {
  it("o SELECT de escolas em meuPerfil inclui plano", () => {
    const dados = ler("app/src/shared/data/index.js");
    const m = dados.match(/from\("escolas"\)\.select\("([^"]+)"\)\.eq\("id", u\.escola_id\)/);
    assert.ok(m, "SELECT de escolas em meuPerfil não encontrado");
    const colunas = m[1].split(",").map((c) => c.trim());
    assert.ok(colunas.includes("plano"), `plano ausente do SELECT: ${m[1]}`);
    // status continua ali — é o sinal do gate de suspensão (D1A.1); não pode sumir
    assert.ok(colunas.includes("status"), "status sumiu do SELECT — quebraria TelaAcessoSuspenso");
  });
});

describe("App.jsx — a faixa combina EH_DEMO com a escola logada", () => {
  let app, codigo;
  before(() => {
    app = ler("app/src/App.jsx");
    codigo = lerCodigo("app/src/App.jsx");
  });

  it("importa escolaEhDemo ao lado de EH_DEMO", () => {
    assert.match(codigo, /import\s*\{\s*EH_DEMO,\s*escolaEhDemo\s*\}\s*from\s*["']\.\/shared\/branding\/ambiente\.js["']/);
  });

  it("a faixa acende por EH_DEMO OU pela escola logada — nunca só um dos dois", () => {
    assert.match(codigo, /EH_DEMO\s*\|\|\s*escolaEhDemo\(/);
  });

  it("useSessao() roda uma ÚNICA vez — dois listeners de auth seria regressão", () => {
    const ocorrencias = codigo.match(/useSessao\(\)/g) ?? [];
    assert.equal(ocorrencias.length, 1, `useSessao() chamado ${ocorrencias.length}x — deveria ser 1 (só em App())`);
  });

  it("AppRoteado recebe o estado de sessão por props, não chama useSessao própria", () => {
    assert.match(codigo, /function AppRoteado\(\{\s*carregando,\s*sessao,\s*perfil,\s*superAdmin,\s*erro\s*\}\)/);
  });

  it("App() passa o estado de sessão inteiro para AppRoteado", () => {
    assert.match(codigo, /<AppRoteado\s*\{\.\.\.sessaoEstado\}\s*\/>/);
  });

  it("a rota de recuperação de senha continua funcionando (regressão da correção anterior)", () => {
    assert.ok(app.includes("ehRotaRecuperacao"), "detecção de recuperação sumiu");
  });
});

describe("FaixaDemo.jsx — continua sem depender de sessão/rede", () => {
  it("o componente permanece puro (sem import de db/supabase)", () => {
    const codigo = lerCodigo("app/src/shared/branding/FaixaDemo.jsx");
    assert.ok(!codigo.includes("shared/data") && !codigo.includes("lib/supabase"), "FaixaDemo passou a depender de dado — quebra a garantia de não travar a tela de login");
  });
});
