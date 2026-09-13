// ============================================================
// ONDA 2 — I6 (três números para o mesmo simulado) e I5 (eliminação
// fabricada em matéria que o aluno nunca prestou)
// ------------------------------------------------------------
// O dado destes testes NÃO é inventado: é o dos 3 simulados do Lucas
// no demo (bdjkgrzfzoamchdpobbl), lidos em 13/09, e a estrutura CN é a
// de prova_materias (exam_tag='cn'), também lida do banco.
//
// Era esta a medição do relatório de varredura, reproduzida exatamente
// antes da correção:
//
//   simulado      JSON cru   provas.js   simuladoConcurso.js
//   Junho/1          65          57             45
//   Diagnóstico      62          61             55
//   Junho/2          74          64             52
//
// O relatório disse que a regra da divergência "não sai por engenharia
// reversa, tem que sair do código". Sai, e é esta: o motor do
// simuladoConcurso não conhecia a chave legada 'soc' e a DESCARTAVA
// inteira, e ambos capavam por matéria sem avisar. Em Junho/1 a perda
// de 20 = 18 (soc descartado) + 2 (qui 8→6) — por isso "nenhum
// subconjunto de matérias somava 20": não era remoção de matéria.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

import { provaDoConcurso, totalAcertos } from "../app/src/modules/conteudo/provas.js";
import { notaPorMateria, avaliarEliminacao, validarAcertos, objetivoSugerido, insumoParaNivel }
  from "../app/src/modules/conteudo/simuladoConcurso.js";
import { expandirLegado, avaliarAcertos } from "../app/src/modules/conteudo/notaSimulado.js";

// estrutura CN do BANCO (prova_materias, exam_tag='cn') — 90 objetivas
const CN_BANCO = [
  { materia_codigo: "ing", num_questoes: 20, dia_numero: 1, eh_redacao: false },
  { materia_codigo: "mat", num_questoes: 20, dia_numero: 1, eh_redacao: false },
  { materia_codigo: "bio", num_questoes: 6, dia_numero: 2, eh_redacao: false },
  { materia_codigo: "fis", num_questoes: 6, dia_numero: 2, eh_redacao: false },
  { materia_codigo: "geo", num_questoes: 6, dia_numero: 2, eh_redacao: false },
  { materia_codigo: "his", num_questoes: 6, dia_numero: 2, eh_redacao: false },
  { materia_codigo: "por", num_questoes: 20, dia_numero: 2, eh_redacao: false },
  { materia_codigo: "qui", num_questoes: 6, dia_numero: 2, eh_redacao: false },
  { materia_codigo: "red", num_questoes: null, dia_numero: 2, eh_redacao: true },
];

// dado REAL dos simulados do Lucas no demo
const SIMULADOS = {
  "Junho/1": { fis: 4, ing: 9, mat: 9, por: 17, qui: 8, soc: 18 },
  "Diagnóstico": { fis: 6, ing: 14, mat: 12, por: 18, qui: 5, soc: 7 },
  "Junho/2": { fis: 10, ing: 12, mat: 11, por: 19, qui: 4, soc: 18 },
};

const somaMotorConcurso = (acertos) =>
  notaPorMateria(CN_BANCO, acertos).reduce((s, l) => s + l.acertos, 0);

// ── I6: o mesmo simulado tem que dar UM número ───────────────────────────────
test("I6: os dois motores devolvem o MESMO total para os 3 simulados reais", () => {
  const prova = provaDoConcurso("cn");
  for (const [nome, acertos] of Object.entries(SIMULADOS)) {
    const motorProvas = totalAcertos(prova, acertos);
    const motorConcurso = somaMotorConcurso(acertos);
    assert.equal(
      motorProvas, motorConcurso,
      `${nome}: tela do responsável deu ${motorProvas} e a do aluno ${motorConcurso} — é o I6 de volta`,
    );
  }
});

test("I6: os totais são os corretos, não só iguais entre si", () => {
  // Igualdade sozinha passaria com os dois motores errados do mesmo
  // jeito. Estes números vêm da estrutura oficial do CN aplicada ao
  // dado real, com 'soc' expandido em his/geo e capado no teto do bucket.
  const prova = provaDoConcurso("cn");
  const esperado = { "Junho/1": 57, "Diagnóstico": 62, "Junho/2": 64 };
  for (const [nome, acertos] of Object.entries(SIMULADOS)) {
    assert.equal(totalAcertos(prova, acertos), esperado[nome], `${nome}`);
  }
});

test("I6: a chave legada 'soc' entra na conta em vez de ser descartada", () => {
  // Era a causa maior da divergência: 52 contra 64 em Junho/2.
  const semSoc = { fis: 10, ing: 12, mat: 11, por: 19, qui: 4 };
  const comSoc = SIMULADOS["Junho/2"];
  assert.ok(
    somaMotorConcurso(comSoc) > somaMotorConcurso(semSoc),
    "informar Estudos Sociais tem que aumentar o total; antes não mudava nada",
  );
});

test("I6: a expansão de 'soc' não perde o ímpar no rateio", () => {
  // O motor antigo fazia Math.floor nos dois destinos: soc=7 virava
  // 3+3 e sumia 1 acerto do aluno sem explicação.
  const { acertos, expansoes } = expandirLegado({ soc: 7 });
  assert.equal(acertos.his + acertos.geo, 7, "a expansão preserva o total informado");
  assert.equal(acertos.soc, undefined, "a chave agregada sai depois de expandida");
  assert.equal(expansoes.length, 1);
});

test("I6: dado explícito de his/geo manda sobre a chave legada", () => {
  const { acertos } = expandirLegado({ soc: 10, his: 2 });
  assert.equal(acertos.his, 2, "his explícito não é sobrescrito pelo rateio de soc");
});

// ── capping deixou de ser silencioso ─────────────────────────────────────────
test("I6: 'soc' acima do teto de his+geo vira violação nomeada pela chave informada", () => {
  // soc=18 não cabe em his(6)+geo(6)=12. O seed do demo é impossível
  // sob a estrutura oficial do CN — nenhum motor exibe 74 honestamente,
  // e 64 é o máximo defensável. Isso tem que aparecer, não sumir.
  const r = avaliarAcertos(CN_BANCO, SIMULADOS["Junho/2"]);
  const vSoc = r.violacoes.find((v) => v.materia === "soc");
  assert.ok(vSoc, "a violação precisa nomear 'soc', não culpar 'his' por um dado que o usuário não digitou");
  assert.equal(vSoc.informado, 18);
  assert.equal(vSoc.max, 12);
  assert.equal(vSoc.perdido, 6);

  const vFis = r.violacoes.find((v) => v.materia === "fis");
  assert.ok(vFis, "fis 10 > 6 também é dado impossível");
  assert.equal(vFis.perdido, 4);

  // 74 cru − 6 (soc) − 4 (fis) = 64. A perda fica explicada, não some.
  assert.equal(r.totalAcertos, 64);
});

// ── I5: eliminação fabricada ─────────────────────────────────────────────────
test("I5: matéria não prestada tem pct null, não 0", () => {
  const linhas = notaPorMateria(CN_BANCO, SIMULADOS["Junho/2"]);
  const bio = linhas.find((l) => l.materia === "bio");
  assert.equal(bio.respondida, false, "bio não veio no simulado");
  assert.equal(bio.pct, null, "0 diria que o aluno fez e zerou");
});

test("I5: o alerta de eliminação NÃO acusa matéria que o aluno nunca prestou", () => {
  const linhas = notaPorMateria(CN_BANCO, SIMULADOS["Junho/2"]);
  const e = avaliarEliminacao("absoluto_50", linhas);
  const acusadas = e.emRisco.map((r) => r.materia);
  for (const nunca of ["bio"]) {
    assert.ok(!acusadas.includes(nunca), `${nunca} não foi prestada e não pode aparecer em risco`);
  }
  // his/geo agora existem (vieram de soc) e PODEM estar em risco de verdade.
  assert.ok(e.naoPrestadas.includes("bio"), "a tela precisa poder dizer que bio não foi prestada");
});

test("I5: a armadilha é o null coagir para 0 — o filtro tem que ser por 'respondida'", () => {
  // `null < 50` é TRUE em JavaScript. Trocar 0 por null sem filtrar
  // por `respondida` não corrigiria nada — este teste trava isso.
  assert.equal(null < 50, true, "premissa: null coage para 0 na comparação");
  const linhas = [
    { materia: "bio", respondida: false, pct: null, max: 6, acertos: 0 },
    { materia: "mat", respondida: true, pct: 90, max: 20, acertos: 18 },
  ];
  const e = avaliarEliminacao("absoluto_50", linhas);
  assert.deepEqual(e.emRisco, [], "nenhuma matéria em risco: bio não foi prestada e mat vai bem");
});

test("I5: o alerta não dispara em 100% dos simulados", () => {
  // O relatório mediu exatamente isso: "dispara em 100% dos simulados".
  const comAlerta = Object.values(SIMULADOS).filter((acertos) => {
    const linhas = notaPorMateria(CN_BANCO, acertos);
    return avaliarEliminacao("absoluto_50", linhas).emRisco.length > 0;
  });
  assert.ok(
    comAlerta.length < Object.keys(SIMULADOS).length,
    "se todo simulado acusa risco, o alerta não prioriza nada — era o defeito",
  );
});

test("I5: nível e objetivo também ignoram matéria não prestada", () => {
  const linhas = notaPorMateria(CN_BANCO, SIMULADOS["Junho/2"]);
  assert.ok(!("bio" in insumoParaNivel(linhas)), "bio não pode entrar no nível como 0% de acerto");
  assert.doesNotMatch(objetivoSugerido(linhas, "absoluto_50"), /BIO/i, "não sugerir estudar o que não foi prestado");
});

// ── validarAcertos continua servindo avaliarSimulado ─────────────────────────
test("validarAcertos expõe as não respondidas em vez de fingir zero", () => {
  const r = validarAcertos(CN_BANCO, SIMULADOS["Junho/2"]);
  assert.ok(r.naoRespondidas.includes("bio"));
  assert.equal(r.capados.bio, undefined, "não respondida não entra em capados como 0");
  assert.equal(r.capados.his, 6, "veio de soc, expandida e capada");
});

// ── I2: eixo Y ilegível ──────────────────────────────────────────────────────
test("I2: nenhum gráfico usa margem esquerda negativa (cortava o rótulo do eixo Y)", () => {
  // O relatório mediu "100/75/50/25/0" sendo lido como "0/5/0/5/0": a
  // margem negativa empurrava os rótulos para x negativo e o overflow
  // do SVG cortava o começo de cada número. Estava em 5 gráficos, não
  // nos 2 que a varredura viu — mesma causa, mesmo padrão copiado.
  const dir = resolve(root, "app/src/modules/desempenho");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsx"))) {
    const src = readFileSync(resolve(dir, f), "utf8");
    const negativas = [...src.matchAll(/margin=\{\{[^}]*left:\s*-\d+/g)];
    assert.equal(
      negativas.length, 0,
      `${f}: margem esquerda negativa corta o rótulo do eixo Y — use left: 0 e aumente o width do YAxis`,
    );
  }
});

test("I2: o eixo Y esquerdo tem largura para o rótulo mais largo", () => {
  // "100" a fontSize 10 ocupa ~17px; abaixo de ~34 o rótulo encosta ou corta.
  for (const arq of ["Acumulado.jsx", "RadarDesempenho.jsx", "Progresso.jsx"]) {
    const src = readFileSync(resolve(root, "app/src/modules/desempenho", arq), "utf8");
    for (const m of src.matchAll(/<YAxis(?![^>]*orientation="right")(?![^>]*type="category")[^>]*width=\{(\d+)\}/g)) {
      assert.ok(
        Number(m[1]) >= 34,
        `${arq}: YAxis com width=${m[1]} é estreito demais para "100" a 10px`,
      );
    }
  }
});

// ── T9: semáforo de acerto se contradizendo na mesma tabela ──────────────────
test("T9: a cor de acerto sai de uma fonte só, com o ramo vermelho presente", async () => {
  const { corDeAcerto, ACERTO_BOM, ACERTO_ATENCAO } =
    await import("../app/src/modules/desempenho/metricas.js");
  const T = { green: "verde", gold: "dourado", red: "vermelho", sub: "cinza" };

  // O defeito medido: Química 53,8% em vermelho e o TOTAL 53,1% em
  // dourado, na MESMA tabela — o número menor com a cor melhor. A
  // linha TOTAL do Acumulado usava `acc >= 70 ? verde : dourado`, sem
  // o ramo vermelho que a linha de matéria tinha.
  assert.equal(corDeAcerto(T, 53.8), "vermelho");
  assert.equal(corDeAcerto(T, 53.1), "vermelho", "53,1 não pode ser melhor que 53,8");

  assert.equal(corDeAcerto(T, ACERTO_BOM), "verde");
  assert.equal(corDeAcerto(T, ACERTO_ATENCAO), "dourado");
  assert.equal(corDeAcerto(T, ACERTO_ATENCAO - 0.1), "vermelho", "o ramo vermelho existe");
  assert.equal(corDeAcerto(T, null), "cinza", "sem dado não é nota ruim");

  // monotonicidade: nota maior nunca pode receber cor pior
  const ordem = { cinza: 0, vermelho: 1, dourado: 2, verde: 3 };
  for (let a = 0; a < 100; a++) {
    assert.ok(
      ordem[corDeAcerto(T, a)] <= ordem[corDeAcerto(T, a + 1)],
      `${a}% recebeu cor melhor que ${a + 1}%`,
    );
  }
});

test("T9: nenhuma tela reimplementa a escala 70/55 por conta própria", () => {
  const dir = resolve(root, "app/src/modules/desempenho");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsx"))) {
    const src = readFileSync(resolve(dir, f), "utf8");
    assert.doesNotMatch(
      src, />=\s*70\s*\?\s*T\.green\s*:[^;]*>=\s*55/,
      `${f}: cópia local da escala de acerto — use corDeAcerto(T, acc) de metricas.js`,
    );
  }
});
