// ============================================================
// BLOCO 4 (24/09/2026) — ACABAMENTO (D08, D09, D12, sequência,
// placeholder do Registrar)
// ------------------------------------------------------------
// D08         modais saem por portal no <body>, que não tinha fonte nem
//             cor: o "Responsáveis de Helena" caía na serifa padrão.
// D09         semanas sempre de segunda a domingo — na trilha-fonte do
//             CN e no gerador (a 0053 cobre abrir_proximo_ciclo; os
//             testes dela estão em ciclo-proxima-edicao-db).
// D12         o exemplo do onboarding dizia "em 2026" numa turma 2027.
// sequência   a ofensiva zerava de manhã para quem estudou ontem
//             (aprovado em 24/09: segue viva até o fim do dia seguinte).
// placeholder "ex: divisibilidade — MDC e MMC (obrigató…" truncado a 390px.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { contarSequencia } from "../app/src/modules/desempenho/metricas.js";
import { domingoDaSemana } from "../app/src/modules/escola/proximoCiclo.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(resolve(root, p), "utf8");

// ── D08 ────────────────────────────────────────────────────────────
test("D08: o <body> declara a família e a cor do tema (portais herdam dele)", () => {
  const tema = src("app/src/shared/ui/tema.js");
  assert.match(tema, /body \{ font-family: Archivo, system-ui, sans-serif; color: \$\{BASE\.ink\}; \}/);
  // os modais continuam saindo por portal no body — é por isso que a
  // regra tem de estar lá, e não só na div raiz do App
  for (const p of ["app/src/shared/ui/componentes.jsx", "app/src/modules/pessoas/VinculosResponsavel.jsx",
                   "app/src/modules/pessoas/CadastroAlunos.jsx", "app/src/routes/admin/AreaAdmin.jsx"]) {
    assert.match(src(p), /createPortal\(/, `${p} deixou de usar portal — revisar se a regra do body ainda cobre`);
  }
});

// ── D12 e placeholder ──────────────────────────────────────────────
test("D12: o exemplo do onboarding não crava ano", () => {
  const onb = src("app/src/modules/motor/Onboarding.jsx");
  assert.doesNotMatch(onb, /placeholder="ex: passar no Colégio Naval em 20\d\d"/);
  assert.match(onb, /placeholder="ex: passar no Colégio Naval"/);
});

test("placeholder do Tópico: curto, sem travessão e sem o '(obrigatório)' que o asterisco já diz", () => {
  const reg = src("app/src/modules/motor/Registrar.jsx");
  const m = reg.match(/id=\{id\("top"\)\}.*?placeholder="([^"]*)"/);
  assert.ok(m, "placeholder do Tópico não encontrado");
  const ph = m[1];
  assert.ok(ph.length <= 24, `"${ph}" tem ${ph.length} caracteres — trunca a 390 px`);
  assert.doesNotMatch(ph, /—|obrigat/);
});

// ── sequência ──────────────────────────────────────────────────────
const dias = (...xs) => new Set(xs);

test("sequência: estudou hoje e nos dois dias anteriores → 3", () => {
  assert.equal(contarSequencia(dias("2026-09-24", "2026-09-23", "2026-09-22"), "2026-09-24"), 3);
});

test("sequência: estudou ontem e anteontem, ainda não hoje → 2 (antes dava 0)", () => {
  assert.equal(contarSequencia(dias("2026-09-23", "2026-09-22"), "2026-09-24"), 2);
});

test("sequência: último estudo anteontem → 0 (a ofensiva caiu)", () => {
  assert.equal(contarSequencia(dias("2026-09-22", "2026-09-21"), "2026-09-24"), 0);
});

test("sequência: a Helena da demonstração — sábado mostra 1 (sexta, sem quinta); quarta mostra 2", () => {
  // semana 4: seg, ter, qua, sex; da semana 3 só o sábado encosta
  const helena = dias("2026-09-19", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-25");
  assert.equal(contarSequencia(new Set([...helena].filter((d) => d < "2026-09-26")), "2026-09-26"), 1);
  assert.equal(contarSequencia(new Set([...helena].filter((d) => d < "2026-09-23")), "2026-09-23"), 2);
});

test("sequência: virada de mês não quebra a conta", () => {
  assert.equal(contarSequencia(dias("2026-10-01", "2026-09-30", "2026-09-29"), "2026-10-01"), 3);
});

// ── D09 ────────────────────────────────────────────────────────────
const trilhaCn = JSON.parse(src("supabase/seed/trilha-cn-v1.json"));
const DIA = 86400000;
const t = (iso) => Date.parse(`${iso}T00:00:00Z`);

test("D09: a trilha-fonte do CN tem 9 semanas de segunda a domingo, contíguas", () => {
  assert.equal(trilhaCn.semanas.length, 9);
  trilhaCn.semanas.forEach((s, i) => {
    assert.equal(new Date(t(s.inicio)).getUTCDay(), 1, `semana ${s.n} começa na segunda`);
    assert.equal((t(s.fim) - t(s.inicio)) / DIA, 6, `semana ${s.n} tem 7 dias`);
    if (i) assert.equal((t(s.inicio) - t(trilhaCn.semanas[i - 1].fim)) / DIA, 1, `semana ${s.n} encosta na anterior`);
  });
});

test("D09: o seed 02 está sincronizado com a fonte (deslocamentos de 7 dias)", () => {
  const seed = src("supabase/seed/02_trilha_cn.sql");
  const valores = [...seed.matchAll(/\('[0-9a-f-]{36}', (\d), (-?\d+), (-?\d+), /g)].map((m) => [+m[1], +m[2], +m[3]]);
  assert.equal(valores.length, 9, "as 9 semanas precisam estar no seed");
  for (const [n, ini, fim] of valores) {
    assert.equal(fim - ini, 6, `seed: semana ${n} não tem 7 dias — rode scripts/gerar-seed-trilha.mjs`);
    assert.equal(((ini % 7) + 7) % 7, 0, `seed: semana ${n} não começa numa segunda`);
  }
});

test("D09: o gerador recusa semana que não seja de segunda a domingo", () => {
  const gerador = src("scripts/gerar-seed-trilha.mjs");
  assert.match(gerador, /não começa na segunda/);
  assert.match(gerador, /não tem 7 dias/);
  assert.match(gerador, /não encosta na/);
});

test("D09: a tela do próximo ciclo diz o domingo da semana da prova (espelho da 0053)", () => {
  assert.equal(domingoDaSemana("2027-08-07"), "2027-08-08", "prova no sábado → domingo seguinte");
  assert.equal(domingoDaSemana("2027-08-08"), "2027-08-08", "prova no domingo → o próprio dia");
  assert.equal(domingoDaSemana("2027-08-02"), "2027-08-08", "prova na segunda → domingo da mesma semana");
  assert.equal(domingoDaSemana(""), null);
  assert.match(src("app/src/modules/escola/ProximoCiclo.jsx"), /domingoDaSemana\(String\(ancora\)\)/);
});
