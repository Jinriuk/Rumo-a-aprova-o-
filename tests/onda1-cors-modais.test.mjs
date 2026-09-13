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
