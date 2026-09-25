// ============================================================
// ONDA 1 — B1 (preflight CORS) e B2 (modais fora da tela)
// ------------------------------------------------------------
// Como o repo não sobe GoTrue nem navegador no CI, estes testes
// travam as propriedades por INSPEÇÃO DE FONTE — mesmo padrão de
// sec3-endurecimento-edge.test.mjs e est1-travas-frontend.test.mjs.
//
// B1 tinha DUAS causas empilhadas, e as duas precisam continuar
// corrigidas ou o defeito volta inteiro:
//   A) o gate `verify_jwt` da plataforma rejeitava o preflight
//      OPTIONS (que vai sem Authorization, por especificação) antes
//      do código da função rodar. `virar-semana` era a única com
//      false e a única que funcionava — a assinatura do problema.
//   B) a allowlist de origens não tinha os domínios da marca, então
//      mesmo com o preflight passando a resposta saía sem
//      Access-Control-Allow-Origin.
//
// B2 não era o CSS do modal (esse sempre esteve certo): `.fade`
// anima transform e vira containing block para position:fixed, e as
// três áreas envolvem o conteúdo de aba nessa classe. A correção é
// estrutural (createPortal em document.body), não CSS.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");

const FUNCOES = readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

// ── B1 causa A: o preflight não pode depender de JWT ─────────────────────────
test("B1: toda Edge Function tem entrada no config.toml com verify_jwt = false", () => {
  const toml = ler("supabase/config.toml");
  assert.ok(FUNCOES.length >= 7, `esperava as 7 funções, achei ${FUNCOES.length}`);
  for (const fn of FUNCOES) {
    const bloco = new RegExp(`\\[functions\\.${fn}\\]([\\s\\S]*?)(?=\\n\\[|$)`);
    const m = toml.match(bloco);
    assert.ok(m, `${fn} não tem entrada [functions.${fn}] no config.toml — cai no default true da plataforma e o preflight morre`);
    assert.match(
      m[1],
      /verify_jwt\s*=\s*false/,
      `${fn} precisa de verify_jwt = false: o gate da plataforma roda ANTES do código e rejeita o OPTIONS, que o navegador manda sem Authorization`,
    );
  }
});

test("B1: toda função responde OPTIONS antes de qualquer verificação de credencial", () => {
  for (const fn of FUNCOES) {
    const arquivo = ler(`supabase/functions/${fn}/index.ts`);

    // Só o CORPO DO HANDLER interessa. Em escopo de módulo a chave de
    // serviço aparece para montar o client admin (backoffice-coordenador:31)
    // e isso não é guarda de requisição — comparar posições no arquivo
    // inteiro daria falso positivo.
    const iServe = arquivo.indexOf("Deno.serve(");
    assert.ok(iServe > 0, `${fn} não tem Deno.serve`);
    const handler = arquivo.slice(iServe);

    const iOptions = handler.indexOf('req.method === "OPTIONS"');
    assert.ok(iOptions > 0, `${fn} não trata OPTIONS no handler`);

    // o preflight tem que ser respondido antes de ler credencial —
    // senão desligar o verify_jwt só troca o 401 de lugar.
    for (const guarda of ["chamador(req)", "superAdmin(req)", "resolverSuperAdmin(req)", "timingSafeEqual("]) {
      const iGuarda = handler.indexOf(guarda);
      if (iGuarda > 0) {
        assert.ok(
          iOptions < iGuarda,
          `${fn}: OPTIONS é tratado depois de ${guarda} — o preflight ia bater na autenticação`,
        );
      }
    }
  }
});

test("B1: desligar o gate de plataforma não removeu a autenticação do código", () => {
  // A garantia que sustenta o verify_jwt = false: cada função continua
  // identificando quem chama. Se alguém apagar isso, a função abre.
  const guardaPorFuncao = {
    "gerar-meta": /chamador\(req\)/,
    "lgpd-titular": /chamador\(req\)/,
    "provisionar-aluno": /chamador\(req\)/,
    "trocar-senha": /chamador\(req\)/,
    "revogar-responsavel": /chamador\(req\)|resolverSuperAdmin\(req\)/,
    "backoffice-coordenador": /superAdmin\(req\)/,
    "virar-semana": /timingSafeEqual/,
  };
  for (const [fn, re] of Object.entries(guardaPorFuncao)) {
    const src = ler(`supabase/functions/${fn}/index.ts`);
    assert.match(src, re, `${fn} perdeu a guarda de credencial no código — com verify_jwt = false isso deixa a função aberta`);
  }
});

test("B1: chamador() valida o token contra o Auth, não confia em campo do corpo", () => {
  const src = ler("supabase/functions/_shared/contexto.ts");
  assert.match(src, /admin\.auth\.getUser\(token\)/, "a identidade precisa sair do token verificado pelo Auth");
  assert.match(src, /headers\.get\("authorization"\)/i, "o token vem do cabeçalho Authorization");
});

// ── B1 causa B: a allowlist precisa conter os domínios da marca ──────────────
test("B1: a allowlist padrão do CORS inclui os domínios da marca", () => {
  const src = ler("supabase/functions/_shared/cors.ts");
  for (const origem of ["https://app.trilivaedu.com.br", "https://www.trilivaedu.com.br"]) {
    assert.ok(
      src.includes(origem),
      `${origem} fora de DEFAULT_ORIGINS — o preflight passaria e a resposta ainda sairia sem Access-Control-Allow-Origin`,
    );
  }
  // o default não pode depender de secret certo num painel
  assert.match(src, /DEFAULT_ORIGINS\s*=\s*\[/, "DEFAULT_ORIGINS precisa existir no código");
});

// A allowlist corrigida só vale para quem CHEGA nela. Quatro das sete
// funções (backoffice-coordenador, provisionar-aluno, revogar-responsavel,
// trocar-senha) carregavam uma CÓPIA inline da allowlist, herdada de um
// fluxo antigo de publicação pelo MCP, que não resolvia import relativo.
// Nelas a correção de _shared/cors.ts não mudava nada — e o teste acima
// passava mesmo assim, porque só olhava _shared/cors.ts. Era um teste que
// não pegava o defeito que existia para pegar. Este pega.
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

test("B1: nenhuma função redeclara a allowlist — todas leem _shared/cors.ts", () => {
  for (const nome of FUNCOES) {
    const bruto = ler(`supabase/functions/${nome}/index.ts`);
    const codigo = semComentarios(bruto);
    assert.match(
      codigo,
      /from\s+"\.\.\/_shared\/(?:cors|contexto)\.ts"/,
      `${nome} não importa o CORS compartilhado — uma correção em _shared/cors.ts não a alcança`,
    );
    assert.doesNotMatch(
      codigo,
      /DEFAULT_ORIGINS\s*=\s*\[/,
      `${nome} redeclara DEFAULT_ORIGINS: cópia inline, imune à correção de _shared/cors.ts`,
    );
    assert.match(
      codigo,
      /corsHeaders\(req\)/,
      `${nome} importa o CORS mas não o aplica na resposta`,
    );
  }
});

test("B1: previews da Vercel cobrem os dois projetos que publicam este repo", () => {
  const src = ler("supabase/functions/_shared/cors.ts");
  const m = src.match(/PREVIEW_PREFIX_DEFAULTS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, "PREVIEW_PREFIX_DEFAULTS precisa existir");
  assert.match(m[1], /rumo-a-aprova-o/, "slug legado da Vercel");
  assert.match(m[1], /triliva-producao/, "projeto de produção da marca — preview dele nascia bloqueado");
});

test("B1: o curinga de origem não pode voltar", () => {
  const src = ler("supabase/functions/_shared/cors.ts");
  assert.doesNotMatch(
    src,
    /"Access-Control-Allow-Origin"\s*\]?\s*[:=]\s*"\*"/,
    "allowlist por reflexão de Origin, nunca curinga",
  );
});

// ── B2: os modais precisam escapar do containing block do .fade ──────────────
const MODAIS = [
  "app/src/shared/ui/componentes.jsx",
  "app/src/modules/pessoas/CadastroAlunos.jsx",
  "app/src/modules/pessoas/VinculosResponsavel.jsx",
  "app/src/routes/admin/AreaAdmin.jsx",
];

test("B2: todo overlay fixo vai por portal em document.body", () => {
  for (const arquivo of MODAIS) {
    const src = ler(arquivo);
    assert.match(src, /import \{ createPortal \}|createPortal\s*\(/, `${arquivo} precisa importar createPortal`);
    assert.match(
      src,
      /createPortal\([\s\S]*?document\.body/,
      `${arquivo}: o overlay precisa ser renderizado em document.body — dentro da árvore ele cai no containing block criado pela animação de transform do .fade`,
    );
  }
});

test("B2: a armadilha do .fade está documentada onde ela mora", () => {
  const src = ler("app/src/shared/ui/tema.js");
  assert.match(src, /\.fade \{ animation: fade/, "a classe continua existindo");
  assert.match(src, /containing block/i, "tema.js precisa avisar que transform animado captura position:fixed");
  assert.match(src, /createPortal/, "e apontar a saída correta para overlay novo");
});

test("B2: as três áreas ainda envolvem conteúdo de aba em .fade (premissa do diagnóstico)", () => {
  // Se um dia isso deixar de ser verdade, o portal continua correto,
  // mas o comentário do tema.js vira mentira — este teste avisa.
  const areas = [
    "app/src/routes/escola/AreaEscola.jsx",
    "app/src/routes/aluno/VisaoEstudo.jsx",
    "app/src/routes/admin/AreaAdmin.jsx",
  ];
  const comFade = areas.filter((a) => /className="fade"/.test(ler(a)));
  assert.ok(
    comFade.length > 0,
    "nenhuma área usa .fade — revise o comentário do tema.js e este teste",
  );
});

// ── T44 (movido da Onda 4 para cá: mesmo elemento editado pelo portal) ───────
test("T44: o modal de vínculos é um diálogo nomeado, não uma div anônima", () => {
  const src = ler("app/src/modules/pessoas/VinculosResponsavel.jsx");
  assert.match(src, /role="dialog"/, "precisa de role=dialog");
  assert.match(src, /aria-modal="true"/, "precisa de aria-modal");
  assert.match(src, /aria-labelledby=\{tituloId\}/, "o leitor de tela precisa anunciar o título, não só 'diálogo'");
  assert.match(src, /id=\{tituloId\}/, "o título precisa carregar o id referenciado");
});

// ============================================================
// ETAPA 2, FATIA 5 — C-S02: o COMPORTAMENTO do CORS, não só o fonte
// ------------------------------------------------------------
// _shared/cors.ts é importado de verdade (o Node 22 roda TypeScript sem
// passo de build), com um Deno.env simulado por caso. Cada import leva
// uma query diferente para o módulo ser avaliado de novo com o env novo.
// O que a função faz com a requisição depois (exigir Bearer válido) fica
// nos testes B1 acima e na camada HTTP da E3.
// ============================================================
let rodada = 0;
async function corsCom(env = {}) {
  globalThis.Deno = { env: { get: (k) => env[k] } };
  const url = new URL(`../supabase/functions/_shared/cors.ts?caso=${++rodada}`, import.meta.url);
  return import(url.href);
}
const cabecalhos = (m, origem, metodo = "OPTIONS") =>
  m.buildCorsHeaders(new Request("https://projeto.supabase.co/functions/v1/gerar-meta", {
    method: metodo, headers: origem === null ? {} : { origin: origem },
  }));

test("C-S02: sem ALLOWED_ORIGINS, a origem da marca recebe CORS e localhost NÃO recebe", async () => {
  const m = await corsCom({});
  for (const ok of ["https://app.trilivaedu.com.br", "https://www.trilivaedu.com.br", "https://trilivaedu.com.br", "https://rumo-a-aprova-o.vercel.app"]) {
    assert.equal(cabecalhos(m, ok)["Access-Control-Allow-Origin"], ok, `${ok} devia ser permitida`);
  }
  for (const fora of ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "https://evil.example", "https://app.trilivaedu.com.br.evil.example", "null", "", null]) {
    const h = cabecalhos(m, fora);
    assert.equal(h["Access-Control-Allow-Origin"], undefined, `${fora} recebeu Access-Control-Allow-Origin`);
    assert.equal(h["Access-Control-Allow-Credentials"], undefined, "modelo Bearer: nunca credenciais de cookie");
  }
});

test("C-S02: a resposta nunca é curinga, sempre varia por Origin e só anuncia POST/OPTIONS", async () => {
  const m = await corsCom({});
  for (const origem of ["https://app.trilivaedu.com.br", "https://evil.example"]) {
    for (const metodo of ["OPTIONS", "POST"]) {
      const h = cabecalhos(m, origem, metodo);
      assert.notEqual(h["Access-Control-Allow-Origin"], "*");
      assert.equal(h.Vary, "Origin", "sem Vary: Origin um cache intermediário serviria a resposta de uma origem para outra");
      assert.equal(h["Access-Control-Allow-Methods"], "POST, OPTIONS");
    }
  }
});

test("C-S02: dev local entra só pelo ambiente — ALLOWED_ORIGINS substitui a lista inteira", async () => {
  const m = await corsCom({ ALLOWED_ORIGINS: "http://localhost:5173" });
  assert.equal(cabecalhos(m, "http://localhost:5173")["Access-Control-Allow-Origin"], "http://localhost:5173");
  assert.equal(cabecalhos(m, "https://app.trilivaedu.com.br")["Access-Control-Allow-Origin"], undefined,
    "com ALLOWED_ORIGINS só de dev, o domínio da marca sai: é substituição, não soma");
});

test("C-S02: o default no código não tem localhost nem 127.0.0.1", () => {
  const src = ler("supabase/functions/_shared/cors.ts");
  const m = src.match(/const DEFAULT_ORIGINS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(m, "DEFAULT_ORIGINS precisa existir");
  assert.doesNotMatch(m[1], /localhost|127\.0\.0\.1/, "origem de desenvolvimento voltou para o default publicado");
});

test("C-S02: previews dos projetos Vercel passam SEMPRE, com ou sem ALLOWED_ORIGINS (decisão do dono pendente)", async () => {
  // Comportamento atual, registrado e não decidido nesta etapa: o
  // triliva-producao tem as VITE_ em Preview, então preview de qualquer
  // branch fala com o banco e com as funções de produção. Se o dono
  // decidir fechar, o código e este teste mudam juntos.
  const preview = "https://triliva-producao-git-qualquer-branch-jinriuks-projects.vercel.app";
  for (const env of [{}, { ALLOWED_ORIGINS: "https://app.trilivaedu.com.br" }]) {
    const m = await corsCom(env);
    assert.equal(cabecalhos(m, preview)["Access-Control-Allow-Origin"], preview);
  }
  const m = await corsCom({});
  assert.equal(cabecalhos(m, "https://outro-projeto-git-x-alguem.vercel.app")["Access-Control-Allow-Origin"], undefined,
    "*.vercel.app de outro projeto não passa");
});
