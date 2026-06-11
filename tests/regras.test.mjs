// ============================================================
// AS DUAS FÓRMULAS PRESERVADAS — conferidas contra a versão atual
// ------------------------------------------------------------
// O bloco "REFERÊNCIA" abaixo é cópia LITERAL do código da versão
// em produção (src/App.jsx do Rumo ao Naval). O teste prova que o
// módulo novo (app/src/shared/regras) se comporta exatamente igual,
// data a data, nota a nota.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { semanaAtual, notaProjetadaDia1, todayISO } from "../app/src/shared/regras/regras.js";

const trilha = JSON.parse(readFileSync(new URL("../supabase/seed/trilha-cn-v1.json", import.meta.url), "utf8"));
const SEMANAS = trilha.semanas.map((s) => ({ n: s.n, inicio: s.inicio, fim: s.fim }));

// ---------- REFERÊNCIA: copiado literal da versão atual ----------
const WEEKS_REF = SEMANAS.map((s) => ({ n: s.n, start: s.inicio, end: s.fim }));
function currentWeekRef(t) {
  for (const w of WEEKS_REF) if (t >= w.start && t <= w.end) return w;
  if (t < WEEKS_REF[0].start) return WEEKS_REF[0];
  return WEEKS_REF[WEEKS_REF.length - 1];
}
const notaRef = (sm) => Math.round((sm.mat + sm.ing) * 2.5);
// ------------------------------------------------------------------

test("virada por data: todas as datas de 2026-01-01 a 2026-12-31 caem na MESMA semana que na versão atual", () => {
  const d = new Date("2026-01-01T00:00:00");
  const fim = new Date("2026-12-31T00:00:00");
  let dias = 0;
  while (d <= fim) {
    const iso = d.toISOString().slice(0, 10);
    assert.equal(semanaAtual(SEMANAS, iso).n, currentWeekRef(iso).n, `divergiu em ${iso}`);
    d.setDate(d.getDate() + 1);
    dias++;
  }
  assert.equal(dias, 365);
});

test("os limites exatos: 30/05 e 07/06 são semana 1; 08/06 é semana 2; 01/08 (dia da prova) é semana 9", () => {
  assert.equal(semanaAtual(SEMANAS, "2026-05-30").n, 1);
  assert.equal(semanaAtual(SEMANAS, "2026-06-07").n, 1);
  assert.equal(semanaAtual(SEMANAS, "2026-06-08").n, 2);
  assert.equal(semanaAtual(SEMANAS, "2026-08-01").n, 9);
  assert.equal(semanaAtual(SEMANAS, "2026-08-02").n, 9); // depois da prova: clampa na última
  assert.equal(semanaAtual(SEMANAS, "2026-05-29").n, 1); // véspera do plano: clampa na primeira
});

test("nota projetada do Dia 1 = (mat + ing) × 2,5, idêntica à versão atual em todo o domínio (0–20 cada)", () => {
  for (let mat = 0; mat <= 20; mat++) {
    for (let ing = 0; ing <= 20; ing++) {
      assert.equal(notaProjetadaDia1({ mat, ing }), notaRef({ mat, ing }), `divergiu em mat=${mat} ing=${ing}`);
    }
  }
  // os casos âncora
  assert.equal(notaProjetadaDia1({ mat: 20, ing: 20 }), 100);
  assert.equal(notaProjetadaDia1({ mat: 12, ing: 14 }), 65);
  assert.equal(notaProjetadaDia1({ mat: 0, ing: 0 }), 0);
});

test("todayISO devolve a data LOCAL no formato ISO (yyyy-mm-dd)", () => {
  const t = todayISO();
  assert.match(t, /^\d{4}-\d{2}-\d{2}$/);
  const agora = new Date();
  const local = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  assert.equal(t, local, "todayISO tem que ser a data local, não a UTC");
});
