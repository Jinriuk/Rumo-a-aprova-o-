// ============================================================
// MÉTRICAS AGREGADAS (cliente) — o helper que substituiu a conta
// de q/cd/cc copiada em várias telas, e o adaptador da RPC do
// painel. Funções puras: testáveis sem banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { resumirRegistros, adaptarResumoEscola } from "../app/src/shared/metricas/agregados.js";

test("resumirRegistros: vazio devolve zeros e acerto nulo", () => {
  const r = resumirRegistros([]);
  assert.deepEqual(r, { questoes: 0, comAcertoQuestoes: 0, acertos: 0, minutos: 0, dias: 0, acc: null });
});

test("resumirRegistros: registro SEM acerto lançado entra em questões/dias, não no % de acerto", () => {
  const regs = [
    { data: "2026-06-01", questoes: 10, acertos: 8, minutos: 30 },   // com acerto
    { data: "2026-06-01", questoes: 5, acertos: null, minutos: 10 }, // sem acerto lançado
  ];
  const r = resumirRegistros(regs);
  assert.equal(r.questoes, 15);
  assert.equal(r.minutos, 40);
  assert.equal(r.dias, 1, "mesma data conta como 1 dia distinto");
  assert.equal(r.comAcertoQuestoes, 10, "denominador do acerto ignora o registro sem acerto");
  assert.equal(r.acertos, 8);
  assert.equal(r.acc, 80, "8/10");
});

test("resumirRegistros: janela `desde` recorta os registros", () => {
  const regs = [
    { data: "2026-05-01", questoes: 100, acertos: 50 },
    { data: "2026-06-10", questoes: 20, acertos: 10 },
  ];
  const r = resumirRegistros(regs, { desde: "2026-06-01" });
  assert.equal(r.questoes, 20);
  assert.equal(r.acc, 50);
});

test("adaptarResumoEscola: mapeia campos da RPC, calcula acertos e sinais de risco", () => {
  const linhas = [{
    aluno_id: "a1",
    questoes_total: 100, ca_questoes_total: 80, acertos_total: 60, minutos_total: 300, dias_total: 12,
    questoes_7d: 20, ca_questoes_7d: 20, acertos_7d: 18, minutos_7d: 60, dias_7d: 3,
    ultima_atividade: "2026-06-10", meta_feitas: 3, meta_consideradas: 4,
  }];
  const alunosPorId = { a1: { id: "a1", nome: "Ana", usuario_id: null } };
  const [x] = adaptarResumoEscola(linhas, alunosPorId);

  assert.equal(x.q, 100);
  assert.equal(x.acc, 75, "60/80");
  assert.equal(x.accSem, 90, "18/20");
  assert.equal(x.diasSem, 3);
  assert.equal(x.metaPct, 75, "3/4");
  assert.equal(x.metaIncompleta, true);
  assert.equal(x.semCredencial, true, "usuario_id nulo");
  assert.equal(x.semAtividade, false, "tem 3 dias na semana");
});

test("adaptarResumoEscola: sem atividade na semana e sem acerto viram flags/null corretos", () => {
  const linhas = [{
    aluno_id: "a2",
    questoes_total: 0, ca_questoes_total: 0, acertos_total: 0, minutos_total: 0, dias_total: 0,
    questoes_7d: 0, ca_questoes_7d: 0, acertos_7d: 0, minutos_7d: 0, dias_7d: 0,
    ultima_atividade: null, meta_feitas: 0, meta_consideradas: 0,
  }];
  const [x] = adaptarResumoEscola(linhas, { a2: { id: "a2", nome: "Bia", usuario_id: "u2" } });
  assert.equal(x.acc, null);
  assert.equal(x.metaPct, null);
  assert.equal(x.metaIncompleta, false);
  assert.equal(x.semAtividade, true);
  assert.equal(x.semCredencial, false);
});

test("adaptarResumoEscola: ignora linha de aluno que não está na lista carregada", () => {
  const linhas = [{ aluno_id: "fantasma", questoes_total: 9 }];
  assert.deepEqual(adaptarResumoEscola(linhas, {}), []);
});
