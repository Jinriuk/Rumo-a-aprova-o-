// ============================================================
// P1.1 — lado do FRONT das questões integradas (Quest)
// ------------------------------------------------------------
// O servidor (0065 + questoes-integradas) corrige e conta; aqui a prova
// é que a tela:
//   • só oferece o botão onde o servidor ligou, e na missão certa;
//   • mostra enunciado como texto, nunca como HTML;
//   • cai no registro manual em toda falha do fornecedor;
//   • não conhece a chave da Quest nem fala com ela direto;
//   • reusa o pedido_id ao reabrir (retransmissão não gasta lote);
//   • (18/10) "Iniciar missão" abre a sessão nas missões ligadas; a sessão
//     pede o tamanho (5, 10, 20), mostra "X de N questões desta missão" e
//     termina o lote com "Continuar: mais N" ou "Missão concluída".
// Banco e função: p11-quest-db e p11-quest-edge (PR de banco).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mensagemDoEstado, ESTADOS_ESPERADOS_QUEST, textoSimples, podeResolverAqui, resumoDoLote, origemDaQuestao, novoPedidoId, TAMANHO_LOTE,
  TAMANHOS_LOTE, progressoDaMissao, fimDoLote,
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
  // tag escondida dentro de outra: a remoção repete até não sobrar tag
  assert.doesNotMatch(textoSimples("<<b>script>alert(3)<</b>/script>"), /<\s*\/?\s*script/i);
  assert.doesNotMatch(textoSimples("<scr<i>ipt>x</scr</i>ipt>"), /</);
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
  assert.match(painel, /aoResolver\(mi, "revisao"\)/);
});

test("Iniciar missão: com questões ligadas abre a sessão; sem, vai ao registro; o registro à mão fica como link", () => {
  const painel = semComentarios(ler("app/src/modules/motor/ProgressoVivido.jsx"));
  assert.match(painel, /const comQuestoes = aoResolver && !inalcancavel && podeResolverAqui\(mi, questoesIntegradas\);/);
  assert.match(painel, /onClick=\{\(\) => \(comQuestoes \? aoResolver\(mi, "missao"\) : aoPraticar\(contextoRegistroDaMissao\(mi, "missao"\)\)\)\}>\s*Iniciar missão\s*</);
  assert.match(painel, /\{comQuestoes && aoPraticar && \([\s\S]*?>\s*Registrar à mão\s*</);
  assert.doesNotMatch(painel, /Resolver questões aqui|Praticar esta missão/, "um botão só por missão da vez");
  // revisão com questões continua só nas concluídas
  assert.match(painel, /mi\.estado === "concluida" && podeResolverAqui\(mi, questoesIntegradas\)/);
});

// Tarefa do botão que não apareceu (13/10): o front não conhecia o
// pmerj_cfo na tabela de maturidade. O cadastro mostrava "Este concurso
// está indisponível" e o aluno via "ainda não recebe alunos".
test("CFO PMERJ é pré-edital no front: aceita aluno e acha a trilha do nicho pmerj-cfo", async () => {
  const { aceitaAluno, maturidadeDe, trilhaSemanalDoConcurso } = await import("../app/src/modules/conteudo/maturidade.js");
  assert.equal(maturidadeDe("pmerj_cfo"), "pre_edital");
  assert.equal(aceitaAluno("pmerj_cfo"), true);
  const trilhas = [
    { id: "cn", nicho: "colegio-naval", versao: 9 },
    { id: "pm1", nicho: "pmerj-cfo", versao: 1 },
  ];
  assert.equal(trilhaSemanalDoConcurso("pmerj_cfo", trilhas)?.id, "pm1", "nunca o calendário de outro concurso");
  const nicho = JSON.parse(ler("supabase/seed/trilha-pmerj-cfo-v1.json")).nicho;
  assert.equal(nicho, "pmerj-cfo", "o nicho do front bate com o do seed da trilha");
});

test("tamanho do lote: o aluno escolhe 5, 10 ou 20 antes do primeiro (padrão 5) e a camada de dados o repassa", () => {
  assert.equal(TAMANHO_LOTE, 5);
  assert.deepEqual(TAMANHOS_LOTE, [5, 10, 20]);
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  assert.match(tela, /useState\(TAMANHO_LOTE\)/, "padrão 5");
  assert.match(tela, /if \(tamanho === null\) \{[\s\S]*?Quantas questões por vez\?[\s\S]*?role="radiogroup"[\s\S]*?TAMANHOS_LOTE\.map/);
  assert.match(tela, /role="radio" aria-checked=\{opcao === n\}/);
  assert.doesNotMatch(tela, /useEffect/, "o lote não abre sozinho: só depois da escolha");
  assert.match(tela, /const comecar = \(\) => \{ setTamanho\(opcao\); abrir\(opcao\); \};/);
  assert.match(tela, /entregarQuestoes\(\{ missaoId: missao\.id, pedidoId: pedidoRef\.current, tamanho: tam \}\)/);
  assert.match(tela, /const novoLote = \(\) => \{ pedidoRef\.current = novoPedidoId\(\); setLote\(null\); abrir\(tamanho\); \};/, "o lote seguinte mantém o tamanho");
  const dados = semComentarios(ler("app/src/shared/data/index.js"));
  assert.match(dados, /\.\.\.\(tamanho \? \{ tamanho \} : \{\}\)/);
});

test("a ficha da coordenação diz onde ficam as questões (na tela do aluno) e pede a credencial quando falta", () => {
  const ficha = ler("app/src/modules/desempenho/FichaAluno.jsx");
  assert.match(ficha, /toca em \\"Iniciar missão\\" na aba Hoje/);
  assert.match(ficha, /Sem credencial, o aluno ainda não entra no app\. Gere a credencial/);
});

test("progresso da missão: X de N (N = meta_questoes), somando só o que vale para a missão", () => {
  assert.deepEqual(progressoDaMissao({ questoes: 5, meta_questoes: 20 }, 3),
    { feitas: 8, meta: 20, texto: "8 de 20 questões desta missão" });
  assert.equal(progressoDaMissao({ meta_questoes: 20 }).texto, "0 de 20 questões desta missão");
  assert.equal(progressoDaMissao({ questoes: 2, meta_questoes: null }).texto, "2 questões desta missão", "sem meta, sem \"de N\"");
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  assert.match(tela, /const progresso = progressoDaMissao\(missao, respondidasValendo\);/);
  // revisão e lote depois de fechar não somam (o servidor também não conta)
  assert.match(tela, /if \(tipo === "missao" && lote\.tipo_pratica === "missao" && !fechouMissao\) setRespondidasValendo\(\(n\) => n \+ 1\);/);
  // aparece na escolha, no meio do lote e no fim
  assert.equal((tela.match(/\{progresso\.texto\}/g) ?? []).length, 3);
});

test("fim do lote: 'Continuar: mais N' até a meta; depois 'Missão concluída' e 'Continuar praticando'", () => {
  assert.deepEqual(fimDoLote({ missaoConcluida: false, tamanho: 5 }), { titulo: null, principal: "Continuar: mais 5" });
  assert.deepEqual(fimDoLote({ missaoConcluida: false, tamanho: 20 }), { titulo: null, principal: "Continuar: mais 20" });
  assert.deepEqual(fimDoLote({ missaoConcluida: true, tamanho: 5 }), { titulo: "Missão concluída", principal: "Continuar praticando" });
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  // fechou agora (resposta do servidor) ou já estava fechada ao abrir
  assert.match(tela, /fimDoLote\(\{ missaoConcluida: fechouMissao \|\| missao\.estado === "concluida", tamanho \}\)/);
  assert.match(tela, /<Botao onClick=\{novoLote\} disabled=\{ocupado\}>\{fim\.principal\}<\/Botao>/);
  assert.doesNotMatch(tela, /Mais questões/);
});
