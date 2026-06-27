// ============================================================
// COMPARATIVO E RELATÓRIOS (PERF1, Camada 4.6–4.7) — funções
// puras, testáveis sem banco. Cobre comparação por turma, recorte
// por concurso, linhas de CSV e a propriedade de isolamento (o
// resultado é função SÓ dos arrays de entrada).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  resumirGrupo, compararTurmas, compararConcursos,
  linhasRelatorioAlunos, linhasRelatorioTurmas, linhasRelatorioConcursos,
  COLUNAS_ALUNOS,
} from "../app/src/shared/metricas/comparativo.js";

// Resumo no formato de adaptarResumoEscola.
const R = (o = {}) => ({
  q: 0, acc: null, minutos: 0, dias: 0,
  qSem: 0, accSem: null, minSem: 0, diasSem: 0,
  ultimaAtividade: null, feitas: 0, consideradas: 0, metaPct: null,
  metaIncompleta: false, semCredencial: false, semAtividade: false, ...o,
});

const TURMAS = [{ id: "t1", nome: "Turma A" }, { id: "t2", nome: "Turma B" }];
const CONCURSOS = { c1: { codigo: "CN", nome: "Colégio Naval" }, c2: { codigo: "ESA", nome: "ESA" } };

const ALUNOS = [
  { id: "a1", nome: "Ana",   usuario_id: "u1", concurso_id: "c1", alunos_turmas: [{ turma_id: "t1" }] },
  { id: "a2", nome: "Bruno", usuario_id: null, concurso_id: "c1", alunos_turmas: [{ turma_id: "t1" }] },
  { id: "a3", nome: "Caio",  usuario_id: "u3", concurso_id: "c2", alunos_turmas: [{ turma_id: "t2" }] },
  { id: "a4", nome: "Duda",  usuario_id: "u4", concurso_id: null, alunos_turmas: [] },
];

const RESUMO = {
  a1: R({ q: 100, acc: 80, qSem: 20, accSem: 90, minutos: 300, minSem: 60, dias: 12, diasSem: 3, feitas: 3, consideradas: 4, metaIncompleta: true, ultimaAtividade: "2026-06-26" }),
  a2: R({ q: 0, semAtividade: true, semCredencial: true }),
  a3: R({ q: 50, acc: 60, qSem: 10, accSem: 55, minutos: 120, minSem: 40, dias: 6, diasSem: 2 }),
  a4: R({ q: 10, acc: null, qSem: 0, semAtividade: true }),
};
const params = () => ({ alunos: ALUNOS, turmas: TURMAS, concursosPorId: CONCURSOS, resumoPorAluno: RESUMO });

test("resumirGrupo: soma volumes e tira MÉDIA das % (entre quem tem acerto)", () => {
  const g = resumirGrupo([RESUMO.a1, RESUMO.a3]);
  assert.equal(g.n, 2);
  assert.equal(g.questoes, 150);
  assert.equal(g.questoes7d, 30);
  assert.equal(g.acerto, 70, "média de 80 e 60");
  assert.equal(g.acerto7d, 73, "média de 90 e 55 = 72.5 -> 73");
});

test("resumirGrupo: acerto nulo quando ninguém tem acerto lançado", () => {
  const g = resumirGrupo([RESUMO.a2, RESUMO.a4]);
  assert.equal(g.acerto, null);
  assert.equal(g.semAtividade, 2);
  assert.equal(g.ativos, 0);
});

test("compararTurmas: uma linha por turma + 'Sem turma', ordenadas", () => {
  const linhas = compararTurmas(params());
  assert.deepEqual(linhas.map((l) => l.turma), ["Turma A", "Turma B", "Sem turma"]);
  const a = linhas[0];
  assert.equal(a.n, 2, "Ana + Bruno");
  assert.equal(a.questoes, 100);
  assert.equal(a.acerto, 80, "só Ana tem acerto lançado");
  assert.equal(a.semCredencial, 1, "Bruno sem credencial");
  assert.equal(a.semAtividade, 1, "Bruno sem atividade");
  assert.equal(a.metaPendente, 1, "Ana com meta incompleta");
  assert.equal(linhas[2].turma, "Sem turma");
  assert.equal(linhas[2].n, 1, "Duda");
});

test("compararTurmas: sem alunos não cria linha 'Sem turma' e zera as turmas", () => {
  const linhas = compararTurmas({ alunos: [], turmas: TURMAS, concursosPorId: CONCURSOS, resumoPorAluno: {} });
  assert.deepEqual(linhas.map((l) => l.turma), ["Turma A", "Turma B"]);
  assert.ok(linhas.every((l) => l.n === 0 && l.acerto === null));
});

test("compararConcursos: agrupa por concurso e separa 'Sem concurso'", () => {
  const linhas = compararConcursos(params());
  const porNome = Object.fromEntries(linhas.map((l) => [l.concurso, l]));
  assert.equal(porNome["Colégio Naval"].n, 2, "Ana + Bruno");
  assert.equal(porNome["ESA"].n, 1, "Caio");
  assert.equal(porNome["Sem concurso"].n, 1, "Duda");
  // 'Sem concurso' sempre por último
  assert.equal(linhas[linhas.length - 1].concurso, "Sem concurso");
});

test("linhasRelatorioAlunos: uma linha por aluno, ordenada por nome, com turma/concurso e flags", () => {
  const linhas = linhasRelatorioAlunos(params());
  assert.deepEqual(linhas.map((l) => l.nome), ["Ana", "Bruno", "Caio", "Duda"]);
  const ana = linhas[0];
  assert.equal(ana.turma, "Turma A");
  assert.equal(ana.concurso, "Colégio Naval");
  assert.equal(ana.questoes, 100);
  assert.equal(ana.acerto, 80);
  assert.equal(ana.ultimaAtividade, "2026-06-26");
  assert.equal(ana.semCredencial, "Não");
  assert.equal(ana.metaFeitas, 3);
  const bruno = linhas[1];
  assert.equal(bruno.acerto, "", "sem acerto lançado -> célula vazia, não 'null'");
  assert.equal(bruno.semCredencial, "Sim");
  assert.equal(bruno.semAtividade, "Sim");
  const duda = linhas[3];
  assert.equal(duda.turma, "", "sem turma -> vazio");
  assert.equal(duda.concurso, "", "sem concurso -> vazio");
});

test("linhasRelatorioAlunos: nenhuma coluna fica indefinida (CSV não quebra)", () => {
  const [linha] = linhasRelatorioAlunos(params());
  for (const col of COLUNAS_ALUNOS) {
    assert.notEqual(linha[col.chave], undefined, `coluna ${col.chave} indefinida`);
  }
});

test("ISOLAMENTO: o relatório só reflete os alunos recebidos (nada de outra escola entra)", () => {
  // Só Caio é passado; o resultado não pode conter Ana/Bruno/Duda nem
  // somar nada além do que veio no array.
  const sub = { alunos: [ALUNOS[2]], turmas: TURMAS, concursosPorId: CONCURSOS, resumoPorAluno: RESUMO };
  const alunos = linhasRelatorioAlunos(sub);
  assert.deepEqual(alunos.map((l) => l.nome), ["Caio"]);
  const turmas = linhasRelatorioTurmas(sub);
  assert.equal(turmas.find((t) => t.turma === "Turma A").n, 0, "turma sem o aluno recebido fica zerada");
  assert.equal(turmas.find((t) => t.turma === "Turma B").n, 1, "só Caio");
  const concursos = linhasRelatorioConcursos(sub);
  assert.deepEqual(concursos.map((c) => c.concurso).sort(), ["ESA"]);
});

test("linhasRelatorioTurmas/Concursos: acerto nulo vira célula vazia para o CSV", () => {
  const linhas = linhasRelatorioConcursos({
    alunos: [ALUNOS[3]], turmas: TURMAS, concursosPorId: CONCURSOS, resumoPorAluno: RESUMO,
  });
  assert.equal(linhas[0].acerto, "", "Duda não tem acerto -> vazio");
});
