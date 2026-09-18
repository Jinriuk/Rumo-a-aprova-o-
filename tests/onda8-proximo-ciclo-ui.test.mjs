// ============================================================
// PRÓXIMO CICLO — a porta da coordenação (regra da tela)
// ------------------------------------------------------------
// A migration 0051 trouxe o MOTOR (clonar trilha, mover aluno) e a
// própria PR que o abriu registrou que a UI não existia. Sem a UI, a
// promessa feita ao responsável desde a Onda 3 — "a coordenação abre o
// próximo ciclo quando ele estiver pronto" — apontava para uma ação
// que não existia em lugar nenhum do produto.
//
// Estes testes exercem a REGRA da tela (quem aparece, para qual data,
// o que é recusado antes de chegar no banco), não o desenho dela. A
// regra vive em modules/escola/proximoCiclo.js exatamente para poder
// ser testada assim.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { gruposParaRenovar, validarAncora } from "../app/src/modules/escola/proximoCiclo.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOJE = "2026-09-18";

const TRILHAS = {
  "t-cn": { id: "t-cn", nome: "Trilha CN", trilha_semanas: [
    { numero: 1, inicio: "2026-02-02", fim: "2026-02-08" },
    { numero: 2, inicio: "2026-02-09", fim: "2026-08-01" },
  ] },
  "t-esp": { id: "t-esp", nome: "Trilha EsPCEx", trilha_semanas: [
    { numero: 1, inicio: "2026-03-01", fim: "2026-09-01" },
  ] },
};
const CONCURSOS = {
  "c-cn": { id: "c-cn", codigo: "cn", nome: "Colégio Naval", mes_prova: 7, dia_prova: 20 },
  "c-esp": { id: "c-esp", codigo: "espcex", nome: "EsPCEx", mes_prova: 9, dia_prova: 28 },
};

const aluno = (id, nome, trilha, concurso) => ({ id, nome, trilha_id: trilha, concurso_id: concurso });
const RESUMO = [
  { aluno: aluno("a1", "Bruno", "t-cn", "c-cn"), cicloEncerrado: true, semCredencial: false },
  { aluno: aluno("a2", "Ana", "t-cn", "c-cn"), cicloEncerrado: true, semCredencial: true },
  { aluno: aluno("a3", "Carla", "t-cn", "c-esp"), cicloEncerrado: true, semCredencial: false },
  // ainda em curso: não é assunto desta tela
  { aluno: aluno("a4", "Diego", "t-esp", "c-esp"), cicloEncerrado: false, semCredencial: false },
  // encerrado, mas sem trilha: não há o que clonar
  { aluno: aluno("a5", "Eva", null, "c-cn"), cicloEncerrado: true, semCredencial: false },
];

test("próximo ciclo: só entra quem encerrou o ciclo E tem trilha", () => {
  const grupos = gruposParaRenovar({ resumo: RESUMO, trilhasPorId: TRILHAS, concursosPorId: CONCURSOS }, HOJE);

  assert.equal(grupos.length, 1, "só a trilha com alunos encerrados deve aparecer");
  assert.equal(grupos[0].trilhaId, "t-cn");

  const ids = grupos[0].alunos.map((l) => l.aluno.id);
  assert.deepEqual(ids, ["a2", "a1", "a3"], "ordena por nome (Ana, Bruno, Carla)");
  assert.ok(!ids.includes("a4"), "aluno em curso entrou na lista de renovação");
  assert.ok(!ids.includes("a5"), "aluno sem trilha entrou — não há plano a clonar");
});

test("próximo ciclo: a âncora sugerida é a prova MAIS PRÓXIMA do grupo", () => {
  const [g] = gruposParaRenovar({ resumo: RESUMO, trilhasPorId: TRILHAS, concursosPorId: CONCURSOS }, HOJE);

  // em 18/09/2026: CN (20/07) já passou → rola para 20/07/2027;
  // EsPCEx (28/09) ainda não → 28/09/2026. A mais próxima é a EsPCEx.
  assert.equal(g.ancoraSugerida, "2026-09-28");
  assert.equal(g.concursosDivergentes, true, "o grupo mistura CN e EsPCEx e a tela precisa avisar");
  assert.deepEqual(g.concursos.map((c) => c.concurso.codigo), ["espcex", "cn"], "ordenado pela data mais próxima");
  assert.equal(g.concursos.find((c) => c.concurso.codigo === "cn").alunos, 2);
});

test("próximo ciclo: a âncora proposta é sempre posterior ao fim do ciclo atual", () => {
  // é o contrato de app.abrir_proximo_ciclo: delta <= 0 levanta exceção.
  // Se a tela propusesse uma data inválida, o erro do Postgres vazaria.
  const grupos = gruposParaRenovar({ resumo: RESUMO, trilhasPorId: TRILHAS, concursosPorId: CONCURSOS }, HOJE);
  for (const g of grupos) {
    assert.equal(g.fimAtual, "2026-08-01");
    assert.ok(g.ancoraSugerida > g.fimAtual,
      `âncora ${g.ancoraSugerida} não é posterior ao fim ${g.fimAtual}`);
    assert.equal(validarAncora(g.ancoraSugerida, g.fimAtual), null);
  }
});

test("próximo ciclo: a tela recusa a âncora inválida ANTES do banco", () => {
  // mesma regra do banco, dita antes — os dois lados precisam concordar.
  assert.match(validarAncora("2026-08-01", "2026-08-01"), /depois do ciclo atual/);
  assert.match(validarAncora("2026-07-01", "2026-08-01"), /depois do ciclo atual/);
  assert.match(validarAncora("", "2026-08-01"), /Escolha a data/);
  assert.match(validarAncora(null, "2026-08-01"), /Escolha a data/);
  assert.match(validarAncora("2027-01-01", null), /não tem semanas/);
  assert.equal(validarAncora("2026-08-02", "2026-08-01"), null, "um dia depois já é válido");
});

test("próximo ciclo: sem aluno encerrado, não há grupo (a tela mostra o vazio)", () => {
  const semEncerrados = RESUMO.map((l) => ({ ...l, cicloEncerrado: false }));
  assert.deepEqual(gruposParaRenovar({ resumo: semEncerrados, trilhasPorId: TRILHAS, concursosPorId: CONCURSOS }, HOJE), []);
  assert.deepEqual(gruposParaRenovar({}, HOJE), []);
  assert.deepEqual(gruposParaRenovar({ resumo: null }, HOJE), []);
});

test("próximo ciclo: a tela existe, está ligada na Área da Escola e chama o RPC", () => {
  // trava contra a regressão que esta entrega corrige: motor sem porta.
  const tela = readFileSync(resolve(root, "app/src/modules/escola/ProximoCiclo.jsx"), "utf8");
  assert.match(tela, /db\.abrirProximoCiclo\(/, "a tela não chama o RPC do 0051");
  assert.match(tela, /gruposParaRenovar/, "a tela não usa a regra pura de agrupamento");

  const area = readFileSync(resolve(root, "app/src/routes/escola/AreaEscola.jsx"), "utf8");
  assert.match(area, /import \{ ProximoCiclo \}/, "a Área da Escola não importa a tela de ciclo");
  assert.match(area, /tab === "ciclo"/, "não há aba que renderize a tela de ciclo");
  assert.match(area, /\["ciclo", "Ciclo"/, "a aba Ciclo não está no menu da coordenação");

  // a promessa feita ao responsável agora tem destino.
  const resp = readFileSync(resolve(root, "app/src/modules/desempenho/ResumoResponsavel.jsx"), "utf8");
  assert.match(resp, /a coordenação abre o próximo ciclo/,
    "o texto da promessa mudou — reveja se a porta ainda corresponde ao que se promete");
});

test("próximo ciclo: ninguém vem pré-marcado", () => {
  // renovar a turma inteira em silêncio fabrica aluno ativo e corrompe
  // o alerta de "sem atividade" que as Ondas 5 e 7 consertaram.
  const tela = readFileSync(resolve(root, "app/src/modules/escola/ProximoCiclo.jsx"), "utf8");
  assert.match(tela, /useState\(\(\) => new Set\(\)\)/,
    "a seleção inicial deixou de ser vazia — 'seguinte, seguinte' renovaria a turma toda");
});
