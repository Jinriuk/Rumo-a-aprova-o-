// ============================================================
// MANIFESTO DE RPCs — contrato de banco como gate (Etapa 1)
// ------------------------------------------------------------
// POR QUE ESTE SCRIPT EXISTE
//
// Em 21/09/2026 o baseline da Etapa 0 achou `abrir_proximo_ciclo`
// MORTA: o front chamava `supabase.rpc("abrir_proximo_ciclo", …)` em
// app/src/shared/data/index.js:368, a tela do próximo ciclo existia, e
// a função não existia em NENHUM schema de NENHUM dos dois bancos. A
// migration 0051 estava no repositório, não aplicada. Resultado: botão
// que o usuário aperta e que devolve erro do PostgREST.
//
// Nenhuma ferramenta do repositório pegava isso:
//   • checar-migrations.mjs compara repo × LEDGER. Diria "em dia" se o
//     ledger estivesse em dia, mesmo com a função ausente.
//   • fingerprint-schema.sql compara SCHEMA × SCHEMA. Diria "idênticos"
//     — e disse — porque a função faltava nos DOIS.
//   • o CI roda migrations num banco limpo, onde tudo existe.
// O furo é entre o que o FRONT CHAMA e o que o BANCO ALVO TEM. É isso
// que este script mede.
//
// O QUE ELE CONFERE — as três coisas, não só a primeira
//
//   1. EXISTE   — há função com esse nome no schema exposto (`public`).
//   2. ASSINATURA — os parâmetros que o front manda existem na função,
//      com esses nomes. PostgREST chama por NOME de parâmetro, não por
//      posição: um `p_aluno` virando `p_alunos` quebra em runtime e
//      passa despercebido em qualquer checagem que só olhe o nome da
//      função.
//   3. AUTORIZAÇÃO — o papel que o front usa (`authenticated`, ou
//      `anon` quando a chamada é pública) tem EXECUTE. Função que
//      existe e não pode ser executada é tão morta quanto função que
//      não existe — só falha mais tarde e com mensagem pior.
//
// Existir em pg_proc NÃO prova as outras duas. Era exatamente esse o
// raciocínio que faltou em setembro.
//
// USO
//   SUPABASE_DB_URL="postgresql://…" node scripts/manifesto-rpcs.mjs
//   SUPABASE_DB_URL="…" node scripts/manifesto-rpcs.mjs --json
// Aceita DATABASE_URL também. Roda de qualquer diretório (ver _pg.mjs).
//
// Exit: 0 = contrato íntegro   1 = divergência (BLOQUEIA)   2 = erro de
// conexão ou de uso.
//
// ONDE ENCAIXAR: antes de publicar o front contra um banco, e no CI
// depois do reset-db.sh. No CI ele prova que o repositório é coerente
// consigo mesmo; contra demo/produção ele prova que aquele ambiente
// aguenta o front que está prestes a subir.
// ============================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { carregarPg } from "./_pg.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRONT = join(RAIZ, "app", "src");

// ------------------------------------------------------------
// CHAMADAS NÃO LITERAIS — lista explícita, nunca adivinhação.
//
// O extrator abaixo só enxerga `.rpc("nome-literal"`. Se algum dia
// alguém escrever `.rpc(nomeDaVariavel)`, o extrator NÃO vai inventar
// um nome: ele ACUSA a chamada dinâmica e exige que ela seja declarada
// aqui, à mão, com os parâmetros que ela pode mandar. Adivinhar nome de
// função por análise de fluxo é como este script passaria a mentir.
//
// Formato: { nome, params: [...], papel, origem }
// Hoje está vazia — em 21/09/2026 as 11 chamadas do front são literais.
// ------------------------------------------------------------
const RPCS_DINAMICAS = [];

// Papel que o PostgREST usa para cada chamada. O default é
// `authenticated`; declare aqui a exceção de chamada feita sem login.
const PAPEL_POR_RPC = {
  // exemplo: "alguma_rpc_publica": "anon",
};
const PAPEL_PADRAO = "authenticated";

// ------------------------------------------------------------
// 1) Extrair as chamadas do front
// ------------------------------------------------------------
function arquivosDoFront(dir, acc = []) {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) arquivosDoFront(caminho, acc);
    else if (/\.(js|jsx|ts|tsx)$/.test(caminho)) acc.push(caminho);
  }
  return acc;
}

// Captura `.rpc("nome"` e, quando houver, as CHAVES do objeto de
// parâmetros que vem logo depois. A varredura das chaves para no `}`
// que fecha o objeto, contando aninhamento — um `{` dentro de um valor
// não engana o contador.
function extrairChamadas(texto, arquivo) {
  const achados = [];
  const re = /\.rpc\(\s*(["'`])([A-Za-z0-9_]+)\1\s*(,)?/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const nome = m[2];
    const linha = texto.slice(0, m.index).split("\n").length;
    let params = [];
    if (m[3]) {
      // há segundo argumento: só lemos as chaves se for objeto literal
      const resto = texto.slice(re.lastIndex);
      const abre = resto.match(/^\s*\{/);
      if (abre) {
        let i = resto.indexOf("{"), nivel = 0, fim = -1;
        for (let k = i; k < resto.length; k++) {
          if (resto[k] === "{") nivel++;
          else if (resto[k] === "}") { nivel--; if (nivel === 0) { fim = k; break; } }
        }
        if (fim > 0) {
          const corpo = resto.slice(i + 1, fim);
          // chaves de primeiro nível: `nome:` no começo de um item
          let n = 0;
          for (const pedaco of corpo.split(/,(?![^[({]*[\])}])/)) {
            const c = pedaco.match(/^\s*([A-Za-z0-9_]+)\s*:/);
            if (c) params.push(c[1]);
            n++;
          }
        }
      }
    }
    achados.push({ nome, params, origem: `${relative(RAIZ, arquivo)}:${linha}` });
  }
  return achados;
}

function detectarDinamicas(texto, arquivo) {
  const fora = [];
  const re = /\.rpc\(\s*([^"'`\s)])/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const linha = texto.slice(0, m.index).split("\n").length;
    fora.push(`${relative(RAIZ, arquivo)}:${linha}`);
  }
  return fora;
}

const chamadas = [];
const dinamicasEncontradas = [];
for (const arq of arquivosDoFront(FRONT)) {
  const texto = readFileSync(arq, "utf8");
  chamadas.push(...extrairChamadas(texto, arq));
  dinamicasEncontradas.push(...detectarDinamicas(texto, arq));
}

// Consolida por nome: uma RPC chamada em dois lugares vira uma entrada
// com a UNIÃO dos parâmetros vistos.
const porNome = new Map();
for (const c of [...chamadas, ...RPCS_DINAMICAS]) {
  if (!porNome.has(c.nome)) porNome.set(c.nome, { nome: c.nome, params: new Set(), origens: [] });
  const e = porNome.get(c.nome);
  for (const p of c.params ?? []) e.params.add(p);
  e.origens.push(c.origem);
}
const manifesto = [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome));

// ------------------------------------------------------------
// 2) Conferir contra o banco alvo
// ------------------------------------------------------------
const conexao = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!conexao) {
  console.error("defina SUPABASE_DB_URL (ou DATABASE_URL) no ambiente — nunca no repositório");
  process.exit(2);
}
const pg = await carregarPg();
if (!pg) {
  console.error("pacote `pg` não encontrado. Instale as dependências de tests/:");
  console.error("  cd tests && npm ci");
  process.exit(2);
}
const { Client } = pg.default ?? pg;
const cliente = new Client({ connectionString: conexao });

try {
  await cliente.connect();
} catch (e) {
  console.error(`erro de conexão: ${e.message}`);
  process.exit(2);
}

// Uma linha por sobrecarga. `proacl` NULL significa "default", que para
// função é EXECUTE para PUBLIC — por isso o coalesce explícito abaixo,
// e não um `is null` tratado como "ninguém pode".
const { rows: doBanco } = await cliente.query(`
  select n.nspname                                as schema,
         p.proname                                as nome,
         pg_get_function_identity_arguments(p.oid) as args,
         pg_get_function_result(p.oid)            as retorno,
         coalesce(p.proargnames, '{}')            as argnomes,
         p.prosecdef                              as secdef,
         p.proacl is null                         as acl_default,
         coalesce(array_to_string(p.proacl, ','), '') as acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
   order by 1, 2;
`);
await cliente.end();

const indice = new Map();
for (const r of doBanco) {
  if (!indice.has(r.nome)) indice.set(r.nome, []);
  indice.get(r.nome).push(r);
}

function temExecute(linha, papel) {
  if (linha.acl_default) return true; // default de função = PUBLIC pode
  return new RegExp(`(^|,)(${papel}|)=([a-zA-Z]*X[a-zA-Z]*)/`).test(linha.acl);
}

// ------------------------------------------------------------
// 3) Veredito
// ------------------------------------------------------------
const linhas = [];
let falhas = 0;

for (const entrada of manifesto) {
  const papel = PAPEL_POR_RPC[entrada.nome] ?? PAPEL_PADRAO;
  const params = [...entrada.params].sort();
  const candidatas = indice.get(entrada.nome) ?? [];

  const registro = {
    rpc: entrada.nome,
    chamada_em: entrada.origens,
    params_do_front: params,
    papel_esperado: papel,
    existe: candidatas.length > 0,
    assinatura_ok: false,
    autorizacao_ok: false,
    schema: null, args: null, retorno: null, acl: null,
    problemas: [],
  };

  if (!candidatas.length) {
    registro.problemas.push(`não existe em public — o front chama e o banco não tem`);
  } else {
    // escolhe a sobrecarga cujos nomes de parâmetro COBREM o que o front manda
    const compativel = candidatas.find((c) => params.every((p) => c.argnomes.includes(p)));
    const escolhida = compativel ?? candidatas[0];
    registro.schema = escolhida.schema;
    registro.args = escolhida.args;
    registro.retorno = escolhida.retorno;
    registro.acl = escolhida.acl_default ? "(default: PUBLIC)" : escolhida.acl;

    if (compativel) {
      registro.assinatura_ok = true;
    } else {
      const faltam = params.filter((p) => !escolhida.argnomes.includes(p));
      registro.problemas.push(
        `assinatura incompatível — o front manda {${params.join(", ")}}, a função aceita {${escolhida.argnomes.join(", ")}}; sobra(m): ${faltam.join(", ")}`
      );
    }

    if (temExecute(escolhida, papel)) {
      registro.autorizacao_ok = true;
    } else {
      registro.problemas.push(`\`${papel}\` NÃO tem EXECUTE (acl: ${registro.acl || "vazia"})`);
    }
  }

  if (registro.problemas.length) falhas++;
  linhas.push(registro);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ manifesto: linhas, dinamicas_nao_declaradas: dinamicasEncontradas }, null, 2));
} else {
  console.log(`MANIFESTO DE RPCs — ${linhas.length} chamadas literais no front\n`);
  for (const r of linhas) {
    const marca = r.problemas.length ? "❌" : "✓";
    console.log(`${marca} ${r.rpc}`);
    console.log(`     chamada em: ${r.chamada_em.join(", ")}`);
    console.log(`     front manda: {${r.params_do_front.join(", ") || "(sem parâmetros)"}}`);
    if (r.existe) {
      console.log(`     banco tem:   ${r.schema}.${r.rpc}(${r.args}) → ${r.retorno}`);
      console.log(`     execute:     ${r.acl}`);
    }
    for (const p of r.problemas) console.log(`     ⚠ ${p}`);
    console.log("");
  }
}

if (dinamicasEncontradas.length) {
  console.error(`❌ chamada .rpc() com nome NÃO literal em:`);
  for (const o of dinamicasEncontradas) console.error(`   • ${o}`);
  console.error(`   Declare-a em RPCS_DINAMICAS no topo deste script. Este`);
  console.error(`   checador não adivinha nome de função.`);
  process.exit(1);
}

if (falhas) {
  console.error(`❌ ${falhas} de ${linhas.length} RPCs com contrato quebrado — NÃO publique o front contra este banco.`);
  process.exit(1);
}

console.log(`✓ contrato íntegro: as ${linhas.length} RPCs existem, com assinatura compatível e EXECUTE para o papel usado.`);
process.exit(0);
