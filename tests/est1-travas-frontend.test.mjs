// ============================================================
// EST1-A4 — TRAVAS DE ESCRITA NO FRONT: simulados e backoffice
// ------------------------------------------------------------
// Achados EST0 FRONTEND-01 (alta, confirmado) e FRONTEND-06 (média):
// os dois formulários de simulado e os quatro fluxos de escrita do
// backoffice usavam guard por estado (`ocupado===false` lido por dois
// disparos no mesmo tick) — fora da garantia FE1 "duplo envio
// impossível" — e o × de apagar simulado não pedia confirmação.
//
// Como o repo não tem runner de componente, este teste trava a
// propriedade por INSPEÇÃO DE FONTE (mesmo padrão do
// sec3-endurecimento-edge): o hook useEnvioUnico (que já tem teste
// funcional em fe1-trava-envio.test.mjs) precisa estar presente nos
// pontos de escrita, e o anti-padrão não pode voltar.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");

test("simulado genérico (Progresso.jsx): trava real + confirmação de exclusão", () => {
  const src = ler("app/src/modules/desempenho/Progresso.jsx");
  assert.match(src, /useEnvioUnico/, "salvar simulado deve usar a trava do FE1");
  assert.match(src, /dialogo\.confirmar\(/, "apagar simulado exige confirmação");
  assert.match(src, /Salvando…/, "botão comunica o envio em curso");
  // o anti-padrão (INSERT fora do enviar) não pode voltar
  assert.doesNotMatch(src, /try\s*\{\s*await db\.adicionarSimulado/, "insert de simulado precisa passar pela trava enviar()");
  assert.doesNotMatch(src, /try\s*\{\s*\n?\s*await db\.removerSimulado/, "delete de simulado precisa passar pela trava enviar()");
});

test("simulado por concurso (SimuladoConcurso.jsx): trava real + confirmação de exclusão", () => {
  const src = ler("app/src/modules/desempenho/SimuladoConcurso.jsx");
  assert.match(src, /useEnvioUnico/, "salvar simulado deve usar a trava do FE1");
  assert.match(src, /dialogo\.confirmar\(/, "apagar simulado exige confirmação");
  assert.match(src, /Salvando…/, "botão comunica o envio em curso");
  assert.doesNotMatch(src, /try\s*\{\s*await db\.adicionarSimulado/, "insert de simulado precisa passar pela trava enviar()");
});

test("backoffice (AreaAdmin.jsx): os 4 fluxos de escrita usam a trava do FE1", () => {
  const src = ler("app/src/routes/admin/AreaAdmin.jsx");
  const usos = src.match(/useEnvioUnico\(/g) ?? [];
  assert.ok(usos.length >= 4,
    `criar escola, editar, status e provisionar/reenviar devem usar useEnvioUnico (achei ${usos.length})`);
  // o anti-padrão do guard por estado não pode voltar nas escritas
  assert.doesNotMatch(src, /const \[ocupado, setOcupado\] = useState/, "guard por estado não segura duplo disparo no mesmo tick");
});
