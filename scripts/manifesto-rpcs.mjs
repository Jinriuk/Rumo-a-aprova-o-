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
//
// `prosrc` entra por causa da varredura de SECURITY DEFINER lá embaixo.
const { rows: doBanco } = await cliente.query(`
  select n.nspname                                as schema,
         p.proname                                as nome,
         pg_get_function_identity_arguments(p.oid) as args,
         pg_get_function_result(p.oid)            as retorno,
         coalesce(p.proargnames, '{}')            as argnomes,
         p.prosecdef                              as secdef,
         p.proacl is null                         as acl_default,
         coalesce(array_to_string(p.proacl, ','), '') as acl,
         coalesce(p.prosrc, '')                   as corpo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (select 1 from pg_depend d
                      where d.objid = p.oid and d.deptype = 'e')
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
// VARREDURA: SECURITY DEFINER exposta sem checagem no corpo
// ------------------------------------------------------------
// POR QUE ISTO EXISTE, e por que é AVISO e não falha.
//
// O ensaio da Etapa 1 mediu, nos dois bancos hospedados, que o dono das
// funções (`postgres`) tem rolbypassrls = true. Dentro de uma função
// SECURITY DEFINER desse dono, **a RLS não é avaliada**. Toda policy que
// pareceria autorizar a operação — `escola_id = app.tenant_id()`,
// `app.tenant_operacional()`, o que for — simplesmente não roda.
//
// A consequência prática: numa SECURITY DEFINER exposta a
// `authenticated` ou `anon`, a autorização precisa estar NO CORPO. Se
// não estiver, não existe em lugar nenhum. Foi assim que a 0051 deixou
// escola suspensa abrir ciclo.
//
// ISTO É HEURÍSTICA E VAI TER FALSO POSITIVO. Uma função pode autorizar
// por um caminho que esta busca não reconhece, ou pode ser legitimamente
// pública (`sou_super_admin()` responde "você é?" e não precisa de
// gate). Por isso o resultado é AVISO, nunca `exit 1` automático: um
// gate que reprova build por heurística vira ruído e depois vira
// `|| true`.
//
// O que ele exige é DECISÃO REGISTRADA. Função revisada e considerada
// ok entra em `AUTORIZACAO_REVISADA` abaixo, com o motivo por escrito.
// Aí ela sai do aviso e a decisão fica versionada, revisável em PR e
// atribuível — em vez de morar na cabeça de quem olhou uma vez.
// ------------------------------------------------------------

// Sinais de que a função autoriza alguma coisa no próprio corpo.
// Ampla de propósito: o objetivo é ter POUCO falso negativo. Falso
// positivo custa uma linha nesta lista; falso negativo custa um furo.
const SINAIS_DE_CHECAGEM = [
  "app.papel", "app.tenant_id", "app.usuario_id", "app.eh_super_admin",
  "app.meu_aluno_id", "app.tenant_operacional", "auth.uid", "auth.jwt",
  "app.jwt", "acesso negado", "permission denied", "not authorized",
  "sem escola", "raise exception",
];

// Decisões registradas. Chave = nome da função em `public`, valor = o
// MOTIVO. Quem remover uma entrada daqui tem de explicar por quê, num
// diff — que é o ponto inteiro deste mecanismo.
//
// ESTÁ VAZIA, e isso é um resultado, não um esqueleto. Medido em
// 21/09/2026 contra o banco que as migrations do repo produzem: as 12
// SECURITY DEFINER expostas a `authenticated` em `public` têm todas
// algum sinal de checagem no corpo. Nenhuma precisa de dispensa hoje.
//
// Escrever entradas aqui "por precaução" seria pior que deixar vazio:
// sugeriria que aquelas funções foram sinalizadas e perdoadas, quando
// na verdade nunca acenderam o aviso.
const AUTORIZACAO_REVISADA = {
  // exemplo do formato, quando a primeira aparecer:
  // alguma_rpc: "motivo por escrito de por que a ausência de checagem é ok aqui",
};

function pareceSemChecagem(linha) {
  const corpo = String(linha.corpo || "").toLowerCase();
  return !SINAIS_DE_CHECAGEM.some((s) => corpo.includes(s.toLowerCase()));
}

const expostasSemChecagem = [];
const expostasRevisadas = [];
for (const r of doBanco) {
  if (!r.secdef) continue;
  const exposta = temExecute(r, "authenticated") || temExecute(r, "anon");
  if (!exposta) continue;
  if (!pareceSemChecagem(r)) continue;
  const registro = { nome: r.nome, args: r.args, acl: r.acl_default ? "(default: PUBLIC)" : r.acl };
  if (AUTORIZACAO_REVISADA[r.nome]) {
    expostasRevisadas.push({ ...registro, motivo: AUTORIZACAO_REVISADA[r.nome] });
  } else {
    expostasSemChecagem.push(registro);
  }
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
  console.log(JSON.stringify({
    manifesto: linhas,
    dinamicas_nao_declaradas: dinamicasEncontradas,
    secdef_exposta_sem_checagem: expostasSemChecagem,
    secdef_exposta_revisada: expostasRevisadas,
  }, null, 2));
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

// AVISO, não falha. Ver o comentário em SINAIS_DE_CHECAGEM.
if (!process.argv.includes("--json")) {
  if (expostasSemChecagem.length) {
    console.log(`⚠  AVISO — SECURITY DEFINER exposta sem checagem aparente no corpo (${expostasSemChecagem.length}):\n`);
    for (const f of expostasSemChecagem) {
      console.log(`   • public.${f.nome}(${f.args})`);
      console.log(`     execute: ${f.acl}`);
    }
    console.log(`
   Dentro de SECURITY DEFINER a RLS NÃO autoriza: o dono (postgres) tem
   BYPASSRLS nos dois ambientes hospedados, então a policy não roda. Se a
   autorização não está no corpo, ela não está em lugar nenhum.

   Isto é HEURÍSTICA e pode ser falso positivo — não reprova o build.
   Revise cada uma e, se estiver correta, registre a decisão em
   AUTORIZACAO_REVISADA no topo de scripts/manifesto-rpcs.mjs, com o
   motivo. Decisão registrada em diff, não na memória de quem olhou.
`);
  }
  if (expostasRevisadas.length) {
    console.log(`ℹ  ${expostasRevisadas.length} SECURITY DEFINER exposta(s) sem checagem no corpo, já revisada(s):`);
    for (const f of expostasRevisadas) console.log(`   • public.${f.nome} — ${f.motivo}`);
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
