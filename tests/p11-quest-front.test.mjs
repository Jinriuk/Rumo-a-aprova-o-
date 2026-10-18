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
  TAMANHOS_LOTE, progressoDaMissao, fimDoLote, destinoDoInicio, TEXTO_REVISAO,
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

test("sem a 0065 no ambiente a lista vem vazia; falha de rede vem null (não é \"sem questões\")", () => {
  const dados = semComentarios(ler("app/src/shared/data/index.js"));
  const fn = dados.match(/export async function missoesComQuestoesIntegradas\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(dados, /const SEM_FUNCAO_QUEST = new Set\(\["PGRST202", "42883"\]\);/);
  assert.match(fn, /if \(error\) \{[\s\S]*console\.warn[\s\S]*return SEM_FUNCAO_QUEST\.has\(error\.code\) \? new Set\(\) : null;/);
  assert.doesNotMatch(fn, /throw/);
});

test("Hoje: o botão só existe para quem registra; falha leva ao Registrar com a missão certa", () => {
  const tela = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(tela, /aoResolver=\{podeEditar \? \(missao, tipo\) => setResolvendo\(\{ missao, tipo \}\) : undefined\}/);
  assert.match(tela, /\{podeEditar && resolvendo && \(/);
  // a sessão abre acima da lista de missões: rola até ela e leva o foco
  // (no celular, "Iniciar missão" fica abaixo da dobra)
  assert.match(tela, /<div ref=\{resolvendoRef\} tabIndex=\{-1\} aria-label="Questões da missão"/);
  assert.match(tela, /resolvendoRef\.current\?\.scrollIntoView\(\{ behavior: reduzido \? "auto" : "smooth", block: "start" \}\)/);
  assert.match(tela, /resolvendoRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(tela, /\(tipoEfetivo = resolvendo\.tipo\) => \{[\s\S]*contextoRegistroDaMissao\(resolvendo\.missao, tipoEfetivo\)[\s\S]*irAba\("registrar", ctx\)/);
  const painel = semComentarios(ler("app/src/modules/motor/ProgressoVivido.jsx"));
  assert.match(painel, /podeResolverAqui\(mi, questoesIntegradas\)/);
  assert.match(painel, /aoResolver\(mi, "revisao"\)/);
});

test("Iniciar missão: carrega até saber; com questões abre a sessão; sem, vai ao registro (achado 5 do #192)", () => {
  const ligadas = new Set(["m1"]);
  const atual = { id: "m1", estado: "atual" };
  const semQuestao = { id: "m9", estado: "atual" };
  assert.equal(destinoDoInicio(atual, undefined), "carregando", "a lista não chegou: não decide");
  assert.equal(destinoDoInicio(semQuestao, undefined), "carregando", "nem para o registro");
  assert.equal(destinoDoInicio(atual, ligadas), "questoes");
  assert.equal(destinoDoInicio(semQuestao, ligadas), "registro");
  assert.equal(destinoDoInicio(semQuestao, new Set()), "registro", "sem a 0065: resposta certa, sem questões");
  assert.equal(destinoDoInicio(semQuestao, null), "questoes", "não deu para saber: o servidor decide na sessão");
  assert.equal(destinoDoInicio(atual, undefined, { podeResolver: false }), "registro", "quem não resolve não espera");

  const painel = semComentarios(ler("app/src/modules/motor/ProgressoVivido.jsx"));
  assert.match(painel, /const destino = destinoDoInicio\(mi, questoesIntegradas, \{ podeResolver: !!aoResolver && !inalcancavel \}\);/);
  // sem valor padrão: um "= null" transformava o carregando em "abre a sessão"
  assert.match(painel, /export function MissoesPersistidas\(\{[^}]*\bquestoesIntegradas, aoResolver \}\)/);
  assert.match(painel, /if \(destino === "questoes"\) aoResolver\(mi, "missao"\);\s*else if \(destino === "registro"\) aoPraticar\(contextoRegistroDaMissao\(mi, "missao"\)\);/,
    "carregando não faz nada no clique");
  assert.match(painel, /disabled=\{carregando\} aria-busy=\{carregando \|\| undefined\}[\s\S]*?>\s*Iniciar missão\s*</);
  assert.match(painel, /\{carregando && <span role="status"[^>]*>Carregando…<\/span>\}/);
  assert.match(painel, /\{destino !== "registro" && aoPraticar && \([\s\S]*?>\s*Registrar à mão\s*</);
  assert.doesNotMatch(painel, /Resolver questões aqui|Praticar esta missão/, "um botão só por missão da vez");
  // revisão com questões continua só nas concluídas
  assert.match(painel, /mi\.estado === "concluida" && podeResolverAqui\(mi, questoesIntegradas\)/);

  // a tela começa sem saber (undefined), tenta 3 vezes e não apaga uma
  // resposta que já veio quando a recarga falha
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /useState\(undefined\);\s*const \[resolvendo, setResolvendo\]/);
  assert.match(visao, /if \(ids === null && tentativa < 3\) \{ espera = setTimeout\(\(\) => pedir\(tentativa \+ 1\), 1500 \* tentativa\); return; \}/);
  assert.match(visao, /setQuestoesIntegradas\(\(antes\) => \(ids === null && antes instanceof Set \? antes : ids\)\);/);
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
  assert.match(tela, /const novoLote = \(\) => \{\s*pedidoRef\.current = novoPedidoId\(\);\s*setLote\(null\);[\s\S]*?abrir\(tamanho\);\s*\};/, "o lote seguinte mantém o tamanho");
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
  // na escolha, no meio do lote e no fim, sempre pela linha que troca na revisão
  assert.equal((tela.match(/\{linhaProgresso\}/g) ?? []).length, 3);
  assert.doesNotMatch(tela, /\{progresso\.texto\}/);
});

test("fim do lote: 'Continuar: mais N' até a meta; no lote que fecha, 'Missão concluída'; depois, revisão", () => {
  assert.deepEqual(fimDoLote({ tamanho: 5 }), { titulo: null, principal: "Continuar: mais 5", aviso: null });
  assert.deepEqual(fimDoLote({ tamanho: 20 }), { titulo: null, principal: "Continuar: mais 20", aviso: null });
  const fechou = fimDoLote({ fechouNesteLote: true, tamanho: 5 });
  assert.equal(fechou.titulo, "Missão concluída");
  assert.equal(fechou.principal, "Continuar praticando");
  assert.match(fechou.aviso, /revisão: ficam no assunto e não contam para a missão/);
  assert.deepEqual(fimDoLote({ emRevisao: true, tamanho: 5 }), { titulo: null, principal: "Continuar praticando", aviso: null });
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  assert.match(tela, /const fim = fimDoLote\(\{ fechouNesteLote, emRevisao, tamanho \}\);/);
  assert.match(tela, /<Botao onClick=\{novoLote\} disabled=\{ocupado\}>\{fim\.principal\}<\/Botao>/);
  assert.match(tela, /\{fim\.aviso && <div[^>]*>\{fim\.aviso\}<\/div>\}/);
  assert.doesNotMatch(tela, /Mais questões/);
});

test("depois de concluída, 'Continuar praticando' é revisão: título, aviso no lugar de 'X de N' e registro de reserva como revisão (achado 3)", () => {
  assert.match(TEXTO_REVISAO, /^Revisão: .*não contam para a missão, que já está concluída\.$/);
  assert.doesNotMatch(TEXTO_REVISAO, /\d+ de \d+/);
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  assert.match(tela, /const concluida = fechouMissao \|\| missao\.estado === "concluida";/);
  assert.match(tela, /const emRevisao = tipo === "revisao" \|\| \(concluida && !fechouNesteLote\);/);
  assert.match(tela, /const linhaProgresso = emRevisao \? TEXTO_REVISAO : progresso\.texto;/);
  assert.match(tela, /const titulo = `\$\{emRevisao \? "Revisão" : "Questões"\} · \$\{missao\.nome\}`;/);
  // o lote seguinte começa sem o "fechou neste lote": é revisão
  assert.match(tela, /const novoLote = \(\) => \{[\s\S]*?setFechouNesteLote\(false\);[\s\S]*?abrir\(tamanho\);/);
  // falha num lote de revisão: o registro manual vai como revisão
  assert.match(tela, /aoRegistrarManual\?\.\(emRevisao \? "revisao" : tipo\)/);
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /aoRegistrarManual=\{\(tipoEfetivo = resolvendo\.tipo\) => \{\s*const ctx = contextoRegistroDaMissao\(resolvendo\.missao, tipoEfetivo\);/);
});

test("missão fechada também pela resposta repetida (achado 2; o servidor manda desde a 0068)", () => {
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  // a resposta repetida chega com estado ok: o mesmo caminho lê missao_concluida
  assert.match(tela, /if \(r\.missao_concluida\) \{ setFechouMissao\(true\); setFechouNesteLote\(true\); \}/);
  assert.doesNotMatch(tela, /r\.repetida/, "repetida não tem caminho próprio que ignore o fechamento");
});

test("lote em aberto retomado com outro tamanho avisa que a escolha vale para os próximos (achado 1)", () => {
  const tela = semComentarios(ler("app/src/modules/motor/ResolverQuestoes.jsx"));
  assert.match(tela, /setRetomado\(r\.retomado && r\.entrega\.questoes\.length !== tam \? r\.entrega\.questoes\.length : null\);/);
  assert.match(tela, /Você tinha um lote de \{retomado\} questões em aberto: termine este primeiro\. Os próximos vêm com \{tamanho\}\./);
});

test("E2E do demo se recusa a rodar com conta da vitrine (achado 4)", async () => {
  const { recusaCodigoDoDemo, ESCOLA_VITRINE } = await import("../app/e2e-demo/_contas.js");
  for (const c of ["VITRINE012", "vitrine005", "LUCASDEMO2026", "lucas-demo-2026", "BRUNODEMO2026", "RESPDEMO2026X", "RESPBETA2026XX"]) {
    assert.match(recusaCodigoDoDemo(c), /vitrine/, c);
  }
  for (const c of ["ABCD-EFGH-1234", "E2E", ""]) assert.match(recusaCodigoDoDemo(c), /não é conta descartável/, c);
  assert.equal(recusaCodigoDoDemo("E2ES2C6FZHGU"), null);
  // a escola da vitrine é a dos seeds 13 e 21
  assert.match(ler("supabase/seed/21_vitrine_contas_auth.sql"), new RegExp(`v_escola uuid := '${ESCOLA_VITRINE}'`));
  const aluno = ler("app/e2e-demo/questoes-integradas.spec.js");
  assert.match(aluno, /const recusa = recusaCodigoDoDemo\(process\.env\.DEMO_ALUNO_CODIGO\);\s*if \(recusa\) throw new Error/,
    "recusa (falha), não pula");
  assert.match(aluno, /await recusarEscolaDaVitrine\(page\);[^\n]*\n\s*if \(await gate\.isVisible\(\)\)/, "antes de trocar a senha");
  assert.match(ler("app/e2e-demo/jornada-coordenacao-aluno.spec.js"), /await recusarEscolaDaVitrine\(coord\);/);
});
