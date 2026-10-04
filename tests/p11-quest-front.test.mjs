// ============================================================
// P1.1 — lado do FRONT das questões integradas (Quest)
// ------------------------------------------------------------
// O servidor (0065 + questoes-integradas) corrige e conta; aqui a prova
// é que a tela:
//   • só oferece o botão onde o servidor ligou, e na missão certa;
//   • mostra enunciado como texto, nunca como HTML;
//   • cai no registro manual em toda falha do fornecedor;
//   • não conhece a chave da Quest nem fala com ela direto;
//   • reusa o pedido_id ao reabrir (retransmissão não gasta lote).
// Banco e função: p11-quest-db e p11-quest-edge (PR de banco).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mensagemDoEstado, ESTADOS_ESPERADOS_QUEST, textoSimples, podeResolverAqui, resumoDoLote, origemDaQuestao, novoPedidoId,
} from "../app/src/modules/motor/questoesIntegradas.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

test("todo estado da função tem texto; falha do fornecedor, limite e falta de questão oferecem o registro manual", () => {
  for (const e of ["fornecedor_indisponivel", "sem_questoes", "erro", "limite", "indisponivel"]) {
    assert.equal(mensagemDoEstado(e).manual, true, e);
  }
  for (const e of ["fora_da_vez", "missao_invalida", "expirada", "anulada", "resposta_invalida", "nao_encontrada", "sem_aluno"]) {
    assert.ok(mensagemDoEstado(e).texto.length > 10, e);
  }
  assert.equal(mensagemDoEstado("estado-que-nao-existe").manual, true, "desconhecido cai no manual");
});

test("os estados previsíveis da função não viram erro de sistema no console", () => {
  const dados = semComentarios(ler("app/src/shared/data/index.js"));
  const bloco = dados.match(/const ESTADOS_ESPERADOS = new Set\(\[([\s\S]*?)\]\)/)[1];
  for (const e of ESTADOS_ESPERADOS_QUEST.filter((x) => x !== "erro")) {
    assert.match(bloco, new RegExp(`"${e}"`), e);
  }
});

test("enunciado vira texto: tag some, script não executa nem aparece como marcação, entidade decodifica", () => {
  assert.equal(textoSimples("<p>Primeiro&nbsp;parágrafo</p><p>Segundo &amp; fim</p>"), "Primeiro parágrafo\nSegundo & fim");
  const t = textoSimples('<img src=x onerror="alert(1)"><script>alert(2)</script>Texto <b>forte</b>');
  assert.doesNotMatch(t, /<|>/);
  assert.match(t, /Texto forte/);
  assert.equal(textoSimples("a<br>b<br/>c"), "a\nb\nc");
  assert.equal(textoSimples("&lt;b&gt;"), "<b>", "texto literal com sinais continua texto (React escapa)");
  assert.equal(textoSimples(null), "");
});

test("botão só em missão ligada pelo servidor: a da vez, a próxima a começar ou concluída (revisão)", () => {
  const ligadas = new Set(["m1", "m2", "m3", "m4"]);
  assert.equal(podeResolverAqui({ id: "m1", estado: "atual" }, ligadas), true);
  assert.equal(podeResolverAqui({ id: "m2", estado: "a_seguir", proxima: true }, ligadas), true);
  assert.equal(podeResolverAqui({ id: "m3", estado: "concluida" }, ligadas), true);
  assert.equal(podeResolverAqui({ id: "m4", estado: "a_seguir" }, ligadas), false, "fora da vez");
  assert.equal(podeResolverAqui({ id: "m9", estado: "atual" }, ligadas), false, "não ligada");
  assert.equal(podeResolverAqui({ id: "m1", estado: "atual" }, null), false, "sem lista (sem 0065): sem botão");
});

test("resumo do lote e origem da questão", () => {
  const qs = [{ respondida: true, acerto: true }, { respondida: true, acerto: false }, { respondida: false, anulada: true }, { respondida: false }];
  assert.deepEqual(resumoDoLote(qs), { total: 4, respondidas: 2, acertos: 1, proxima: 3 });
  assert.equal(origemDaQuestao({ banca: "FGV", orgao: "PMERJ", ano: 2024 }), "FGV · PMERJ · 2024");
  assert.equal(origemDaQuestao({ banca: "FGV", orgao: null, ano: null }), "FGV");
  assert.match(novoPedidoId(), /^[0-9a-f-]{36}$/);
});

test("a tela não interpreta HTML de fora, não manda gabarito e mantém o pedido_id da abertura", () => {
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  assert.doesNotMatch(tela, /dangerouslySetInnerHTML|innerHTML/);
  assert.match(tela, /textoSimples\(atual\.enunciado\)/);
  assert.match(tela, /textoSimples\(alt\.texto\)/);
  // pedido_id: criado uma vez por abertura (ref), trocado só em "novo lote"
  assert.match(tela, /if \(pedidoRef\.current === null\) pedidoRef\.current = novoPedidoId\(\)/);
  assert.equal((tela.match(/pedidoRef\.current = novoPedidoId\(\)/g) ?? []).length, 2);
  // o envio leva resposta, nunca gabarito ou acerto calculado no cliente
  const envio = tela.match(/db\.responderQuestao\(\{([\s\S]*?)\}\)/)[1];
  assert.doesNotMatch(envio, /gabarito|acerto/);
  // o acerto mostrado é o que o servidor devolveu
  assert.match(tela, /acerto: r\.acerto, gabarito: r\.gabarito/);
});

test("a camada de dados fala só com a Edge Function; nada de chave nem endereço da Quest no front", () => {
  const dados = semComentarios(ler("app/src/shared/data/index.js"));
  assert.match(dados, /invocar\("questoes-integradas", \{ acao: "entregar"/);
  assert.match(dados, /invocar\("questoes-integradas", \{\s*acao: "responder"/);
  assert.match(dados, /supabase\.rpc\("quest_missoes_disponiveis"\)/);
  for (const f of ["app/src/shared/data/index.js", "app/src/modules/motor/ResolverQuestoes.jsx",
                   "app/src/modules/motor/questoesIntegradas.js", "app/src/routes/aluno/VisaoEstudo.jsx"]) {
    assert.doesNotMatch(ler(f), /QUEST_API|quest\.api\.br|X-API-Key/i, f);
  }
});

test("sem a 0065 no ambiente, a lista vem vazia e a tela segue (sem botão, sem erro de console)", () => {
  const dados = semComentarios(ler("app/src/shared/data/index.js"));
  const fn = dados.match(/export async function missoesComQuestoesIntegradas\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /if \(error\) \{[\s\S]*console\.warn[\s\S]*return new Set\(\);/);
  assert.doesNotMatch(fn, /throw/);
});

test("Hoje: o botão só existe para quem registra; falha leva ao Registrar com a missão certa", () => {
  const tela = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(tela, /aoResolver=\{podeEditar \? \(missao, tipo\) => setResolvendo\(\{ missao, tipo \}\) : undefined\}/);
  assert.match(tela, /\{podeEditar && resolvendo && \(/);
  assert.match(tela, /contextoRegistroDaMissao\(resolvendo\.missao, resolvendo\.tipo\)[\s\S]*irAba\("registrar", ctx\)/);
  const painel = semComentarios(ler("app/src/modules/motor/ProgressoVivido.jsx"));
  assert.match(painel, /podeResolverAqui\(mi, questoesIntegradas\)/);
  assert.match(painel, /aoResolver\(mi, mi\.estado === "concluida" \? "revisao" : "missao"\)/);
});
