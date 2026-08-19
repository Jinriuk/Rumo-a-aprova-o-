import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contextoRegistroDaAtividade,
  primeiroContextoPendente,
  resumoRegistroConfirmado,
} from "../app/src/modules/motor/jornada.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ler = (caminho) => readFileSync(resolve(root, caminho), "utf8");

const trilha = {
  porCodigo: { mat: { nome: "Matemática" }, por: { nome: "Português" } },
  atividadesPorId: {
    a1: { id: "a1", disciplina_codigo: "mat", prioridade: "F", texto: "Geometria plana" },
    a2: { id: "a2", disciplina_codigo: "por", prioridade: "P", texto: "Interpretação textual" },
  },
};

test("UXG2 cria contexto mínimo sem prometer vínculo persistido", () => {
  const contexto = contextoRegistroDaAtividade({ id: "ma1", atividade_modelo_id: "a1", estado: "pendente" }, trilha);
  assert.deepEqual(contexto, {
    chave: "ma1:a1",
    metaAtividadeId: "ma1",
    atividadeModeloId: "a1",
    disciplinaCodigo: "mat",
    titulo: "Geometria plana",
    questoesSugeridas: 30,
  });
  assert.equal("meta_atividade_id" in contexto, false);
});

test("UXG2 escolhe o primeiro objetivo realmente pendente", () => {
  const meta = { meta_atividades: [
    { id: "ma1", atividade_modelo_id: "a1", estado: "concluida" },
    { id: "ma2", atividade_modelo_id: "a2", estado: "pendente" },
  ] };
  assert.equal(primeiroContextoPendente(meta, trilha)?.atividadeModeloId, "a2");
  assert.equal(primeiroContextoPendente({ meta_atividades: [] }, trilha), null);
});

test("confirmação resume somente os valores devolvidos pelo banco", () => {
  assert.deepEqual(resumoRegistroConfirmado({
    disciplina_codigo: "mat", topico: "Ângulos", questoes: 20, acertos: 15, minutos: 50,
  }, trilha.porCodigo), {
    materia: "Matemática", topico: "Ângulos", questoes: 20,
    acertos: 15, acuracia: 75, minutos: 50,
  });
});

test("objetivo inicia prática e a lista compacta preserva acesso ao restante", () => {
  const src = ler("app/src/modules/motor/MetaSemana.jsx");
  assert.match(src, /Praticar agora/);
  assert.match(src, /contextoRegistroDaAtividade/);
  assert.match(src, /compacta = false/);
  assert.match(src, /Ver todos os \{itens\.length\} objetivos/);
});

test("Registrar usa o retorno do insert e mantém sugestão sob ação explícita", () => {
  const src = ler("app/src/modules/motor/Registrar.jsx");
  assert.match(src, /const registro = await db\.adicionarRegistro/);
  assert.match(src, /aoConfirmar\(\{ registro, contexto: contextoInicial \}\)/);
  assert.match(src, /className="journey-use-suggestion"/);
  assert.match(src, /Confirmando no seu progresso/);
  assert.doesNotMatch(src, /\+\s*\d+\s*XP/);
});

test("as duas camadas não misturam registro persistido com recompensa", () => {
  const src = ler("app/src/modules/motor/ProgressoVivido.jsx");
  const camadaRegistro = src.slice(src.indexOf("export function ConfirmacaoRegistro"), src.indexOf("export function FeedbackProgresso"));
  assert.match(camadaRegistro, /Registro confirmado/);
  assert.match(camadaRegistro, /confirmados no seu progresso/);
  assert.doesNotMatch(camadaRegistro, /feedback\.xp|\+\$\{feedback\.xp\}/);
  assert.match(src, /Progresso confirmado/);
});

test("volta ao Hoje destaca a missão e respeita movimento reduzido", () => {
  const visao = ler("app/src/routes/aluno/VisaoEstudo.jsx");
  const css = ler("app/src/shared/ui/experiencia.css");
  assert.match(visao, /verMissaoAtualizada/);
  assert.match(visao, /scrollIntoView/);
  assert.match(visao, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.mission-impact \.mission-card/);
});

test("recompensa espera dados, XP e missões da mesma recarga", () => {
  const visao = ler("app/src/routes/aluno/VisaoEstudo.jsx");
  assert.match(visao, /dados\.versao !== versao \|\| gam\.versao !== versao/);
  assert.match(visao, /setGam\(\{ missoes: missoes \?\? \[\], versao \}\)/);
  assert.match(visao, /xpPersistido, erro: null, versao/);
});

test("acabamentos removem zoom global e tornam Conquistas operável no teclado", () => {
  const tema = ler("app/src/shared/ui/tema.js");
  const conquistas = ler("app/src/modules/motor/Conquistas.jsx");
  assert.doesNotMatch(tema, /body\s*\{\s*zoom:/);
  assert.match(tema, /text-size-adjust:\s*100%/);
  assert.match(conquistas, /tabIndex=\{aoAbrir \? 0 : undefined\}/);
  assert.match(conquistas, /evento\.key === "Enter" \|\| evento\.key === " "/);
});
