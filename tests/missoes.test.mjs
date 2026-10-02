// ============================================================
// TRILHAS E MISSÕES (Fase 15.4) — lógica pura (sem banco)
// ------------------------------------------------------------
// Cobre: tipo de trilha pelo prazo; regra anti-furo (missão de
// outro concurso não entra); seleção por nível; ajuste da escola
// com sinalização de desvio; montagem final das missões do aluno.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  TIPOS_TRILHA, tipoTrilhaPorPrazo, missaoCabeNoAlvo, missoesDoAlvo,
  missoesParaNivel, aplicarAjusteEscola, montarMissoesDoAluno, desviosDeMissao, filaDeMissoes,
} from "../app/src/modules/conteudo/missoes.js";
import { readFileSync } from "node:fs";

const M = (over) => ({
  id: "m", exam_tag: "cn", materia_codigo: "mat", nivel: "intermediario",
  nome: "Missão", objetivo: "x", qtd_questoes_sugerida: 40, criterio_conclusao: "c",
  xp_sugerido: 50, ordem: 0, ...over,
});

test("tipo de trilha segue o prazo até a prova", () => {
  assert.equal(tipoTrilhaPorPrazo(400), TIPOS_TRILHA.ANUAL);
  assert.equal(tipoTrilhaPorPrazo(200), TIPOS_TRILHA.SEMESTRAL);
  assert.equal(tipoTrilhaPorPrazo(120), TIPOS_TRILHA.INTENSIVA);
  assert.equal(tipoTrilhaPorPrazo(45), TIPOS_TRILHA.RETA_FINAL);
});

test("regra anti-furo: missão só entra se for do exam_tag ATIVO do aluno", () => {
  assert.equal(missaoCabeNoAlvo(M({ exam_tag: "cn" }), "cn"), true);
  assert.equal(missaoCabeNoAlvo(M({ exam_tag: "epcar" }), "cn"), false, "missão de EPCAR não entra para alvo CN");
  assert.equal(missaoCabeNoAlvo(M({ exam_tag: "cn" }), null), false, "sem alvo, nada entra");
  const lista = [M({ id: "a", exam_tag: "cn" }), M({ id: "b", exam_tag: "eear" }), M({ id: "c", exam_tag: "cn" })];
  assert.deepEqual(missoesDoAlvo(lista, "cn").map((m) => m.id), ["a", "c"]);
});

test("missões por nível: traz o nível atual e os já alcançados, nunca o acima", () => {
  const lista = [
    M({ id: "base", nivel: "base" }),
    M({ id: "inter", nivel: "intermediario" }),
    M({ id: "avan", nivel: "avancado" }),
  ];
  assert.deepEqual(missoesParaNivel(lista, "intermediario").map((m) => m.id), ["base", "inter"]);
  assert.deepEqual(missoesParaNivel(lista, "base").map((m) => m.id), ["base"]);
});

test("na Reta Final, só missões de reta final", () => {
  const lista = [M({ id: "inter", nivel: "intermediario" }), M({ id: "rf", nivel: "reta_final" })];
  assert.deepEqual(missoesParaNivel(lista, "reta_final").map((m) => m.id), ["rf"]);
});

test("ajuste da escola: o valor da escola vence, o oficial NÃO some e o desvio é sinalizado", () => {
  const oficial = M({ qtd_questoes_sugerida: 40, xp_sugerido: 50 });
  const ajustada = aplicarAjusteEscola(oficial, { qtd_questoes: 60, desvio_do_edital: true });
  assert.equal(ajustada.qtd_questoes_sugerida, 60);
  assert.equal(ajustada.desvioDoEdital, true);
  assert.equal(ajustada.oficial.qtd_questoes_sugerida, 40, "a referência oficial continua visível");
});

test("ajuste da escola pode DESATIVAR a missão (some da lista)", () => {
  assert.equal(aplicarAjusteEscola(M(), { ativa: false }), null);
});

test("sem ajuste, a missão fica como oficial, sem desvio", () => {
  const r = aplicarAjusteEscola(M({ qtd_questoes_sugerida: 40 }), null);
  assert.equal(r.desvioDoEdital, false);
  assert.equal(r.ativa, true);
});

test("montarMissoesDoAluno junta alvo + nível + ajustes, ordenado", () => {
  const missoes = [
    M({ id: "cn-base", exam_tag: "cn", nivel: "base", ordem: 1 }),
    M({ id: "cn-inter", exam_tag: "cn", nivel: "intermediario", ordem: 0 }),
    M({ id: "cn-avan", exam_tag: "cn", nivel: "avancado", ordem: 2 }),
    M({ id: "eear-x", exam_tag: "eear", nivel: "base", ordem: 0 }),
  ];
  const ajustes = [{ missao_id: "cn-base", ativa: false }]; // desativa a base
  const r = montarMissoesDoAluno({ missoes, examTagAtivo: "cn", nivel: "intermediario", ajustesEscola: ajustes });
  // eear sai (anti-furo); avançado sai (acima do nível); base foi desativada → sobra só inter
  assert.deepEqual(r.map((m) => m.id), ["cn-inter"]);
});

test("desviosDeMissao lista só as missões com ajuste divergente", () => {
  const missoes = [M({ id: "a", nome: "A" }), M({ id: "b", nome: "B" })];
  const ajustes = [{ missao_id: "a", desvio_do_edital: true }, { missao_id: "b", desvio_do_edital: false }];
  assert.deepEqual(desviosDeMissao(missoes, ajustes), [{ missao_id: "a", nome: "A" }]);
});

// ── FILA DE MISSÕES (0061): a tela mostra a fila inteira da matéria ──
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const MAT = [
  M({ id: "f", nome: "Funções integradas", materia_codigo: "mat", ordem: 12, meta_questoes: 70, meta_acuracia: 82, xp_sugerido: 90 }),
  M({ id: "ga", nome: "Geometria Analítica", materia_codigo: "mat", ordem: 13, meta_questoes: 60, meta_acuracia: 82, xp_sugerido: 90 }),
  M({ id: "gp", nome: "Geometria Plana fechada", materia_codigo: "mat", ordem: 14, meta_questoes: 70, meta_acuracia: 82, xp_sugerido: 90 }),
  M({ id: "red", nome: "Redação", materia_codigo: "red", ordem: 3, meta_questoes: null }),
  M({ id: "fis", nome: "Eletricidade", materia_codigo: "fis", ordem: 6, meta_questoes: 45, meta_acuracia: 78 }),
];

test("fila: concluídas, a atual e as próximas como 'a seguir', na ordem do catálogo", () => {
  const fila = filaDeMissoes({
    catalogo: MAT,
    progresso: [
      { missao_id: "f", estado: "concluida", questoes_acumuladas: 70, acuracia: 86, xp_concedido: 90 },
      { missao_id: "ga", estado: "em_andamento", questoes_acumuladas: 30, acuracia: 80 },
    ],
  });
  assert.deepEqual(fila.map((g) => g.materia_codigo), ["fis", "mat"], "matérias na ordem da primeira missão; sem meta (red) fora");
  const mat = fila.find((g) => g.materia_codigo === "mat").missoes;
  assert.deepEqual(mat.map((m) => [m.nome, m.estado, m.questoes]), [
    ["Funções integradas", "concluida", 70], ["Geometria Analítica", "atual", 30], ["Geometria Plana fechada", "a_seguir", 0]]);
  assert.deepEqual(fila.find((g) => g.materia_codigo === "fis").missoes.map((m) => m.estado), ["a_seguir"], "não esconde a matéria que ainda não começou");
});

test("fila: meta e XP da escola valem; missão desativada sai, mas a concluída fica", () => {
  const fila = filaDeMissoes({
    catalogo: MAT,
    ajustesEscola: [
      { missao_id: "f", ativa: true, qtd_questoes: 30, xp: 40 },
      { missao_id: "ga", ativa: false },
      { missao_id: "gp", ativa: false },
    ],
    progresso: [{ missao_id: "gp", estado: "concluida", questoes_acumuladas: 70, acuracia: 90, xp_concedido: 90 }],
  });
  const mat = fila.find((g) => g.materia_codigo === "mat").missoes;
  assert.deepEqual(mat.map((m) => [m.nome, m.estado, m.meta_questoes, m.xp]),
    [["Funções integradas", "a_seguir", 30, 40], ["Geometria Plana fechada", "concluida", 70, 90]]);
});

test("fila: no máximo uma missão atual por matéria, mesmo com o motor antigo (todas em andamento)", () => {
  // banco sem a 0061: o motor antigo deixa todas as missões com meta em
  // andamento, com o histórico inteiro somado em cada uma
  const fila = filaDeMissoes({
    catalogo: MAT,
    progresso: ["f", "ga", "gp", "fis"].map((id) => ({ missao_id: id, estado: "em_andamento", questoes_acumuladas: 70, acuracia: 85 })),
  });
  for (const g of fila) assert.equal(g.missoes.filter((m) => m.estado === "atual").length, 1, g.materia_codigo);
  const mat = fila.find((g) => g.materia_codigo === "mat").missoes;
  assert.deepEqual(mat.map((m) => [m.id, m.estado, m.questoes, m.acuracia]),
    [["f", "atual", 70, 85], ["ga", "a_seguir", 0, null], ["gp", "a_seguir", 0, null]],
    "a seguir não exibe o volume que o motor antigo somou nela");
});

test("fila: sem atual na matéria, a primeira 'a seguir' é a próxima (começa no próximo registro)", () => {
  const nova = filaDeMissoes({ catalogo: MAT });
  const mat = nova.find((g) => g.materia_codigo === "mat").missoes;
  assert.deepEqual(mat.map((m) => m.proxima), [true, false, false], "aluno novo: a primeira não espera anterior");
  const depois = filaDeMissoes({ catalogo: MAT, progresso: [{ missao_id: "f", estado: "concluida", questoes_acumuladas: 70 }] });
  assert.deepEqual(depois.find((g) => g.materia_codigo === "mat").missoes.map((m) => [m.estado, m.proxima]),
    [["concluida", false], ["a_seguir", true], ["a_seguir", false]], "depois de concluir, a seguinte começa no próximo registro");
  const comAtual = filaDeMissoes({ catalogo: MAT, progresso: [{ missao_id: "f", estado: "em_andamento", questoes_acumuladas: 5 }] });
  assert.ok(comAtual.find((g) => g.materia_codigo === "mat").missoes.every((m) => !m.proxima), "com atual, as seguintes esperam a anterior");
});

test("fila: a barra da atual é o menor entre volume e acurácia (volume batido não enche a barra)", () => {
  const de = (questoes, acuracia) => filaDeMissoes({
    catalogo: MAT, progresso: [{ missao_id: "f", estado: "em_andamento", questoes_acumuladas: questoes, acuracia }],
  }).find((g) => g.materia_codigo === "mat").missoes[0];
  const travada = de(70, 50); // 70/70 a 50% contra 82%
  assert.deepEqual([travada.pct, travada.volume_batido, travada.falta_acerto], [61, true, true]);
  const meio = de(35, 90);
  assert.deepEqual([meio.pct, meio.volume_batido, meio.falta_acerto], [50, false, false], "acurácia acima do alvo: vale o volume");
  const semAcerto = de(14, null);
  assert.deepEqual([semAcerto.pct, semAcerto.falta_acerto], [20, false], "sem acurácia medida: só volume");
  assert.ok(de(140, 50).pct < 100, "volume além da meta não compensa acurácia baixa");
});

test("tela: matéria fora da trilha fica 'Com a coordenação', sem 'Atual' nem 'começa no próximo registro'", () => {
  const painel = ler("app/src/modules/motor/ProgressoVivido.jsx");
  assert.match(painel, /const coordenacao = inalcancavel && mi\.estado !== "concluida"/);
  assert.match(painel, /coordenacao \? "Com a coordenação" : ROTULO_ESTADO\[mi\.estado\]/);
  // o ramo da coordenação vem antes dos ramos de atual e de a seguir
  const iCoord = painel.indexOf(") : coordenacao ? (");
  assert.ok(iCoord > 0 && iCoord < painel.indexOf(') : mi.estado === "atual" ? (') && iCoord < painel.indexOf("mi.proxima ?"));
  assert.match(painel, /<BarraXP pct=\{mi\.pct\}/);
});

test("tela: a VisaoEstudo monta a fila com catálogo + ajustes + progresso e não esconde as próximas", () => {
  const visao = ler("app/src/routes/aluno/VisaoEstudo.jsx");
  assert.match(visao, /filaDeMissoes\(\{/);
  assert.match(visao, /db\.carregarMissoes\(examTag\), db\.carregarMissoesEscola\(examTag\)/);
  assert.match(visao, /<MissoesPersistidas fila=\{filaMissoes\}/);
  const painel = ler("app/src/modules/motor/ProgressoVivido.jsx");
  assert.match(painel, /a_seguir: "A seguir"/);
  assert.match(painel, /atual: "Atual"/);
  assert.match(painel, /começa depois da anterior/);
  assert.match(painel, /mi\.proxima \? "começa no seu próximo registro desta matéria com acertos"/);
});

test("tela: o Registrar avisa que, sem acertos, o estudo não conta para a missão", () => {
  const src = ler("app/src/modules/motor/Registrar.jsx");
  assert.match(src, /const semAcertos = f\.questoes !== "" && \+f\.questoes > 0 && String\(f\.acertos\)\.trim\(\) === ""/);
  assert.match(src, /Sem acertos, este estudo fica no seu histórico mas não conta para a missão\./);
  assert.match(src, /aria-describedby=\{semAcertos \? id\("dica-acertos"\) : undefined\}/);
});
