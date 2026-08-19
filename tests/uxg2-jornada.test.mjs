import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contextoRegistroDaAtividade,
  objetivosPendentesEmOrdem,
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

/* ============================================================
   UXG2-R2 — correções da auditoria de aplicação.
   Cada teste abaixo falha na versão original do pacote.
   ============================================================ */

test("R2-fix: o alvo do CTA da missão segue a MESMA ordem da lista de objetivos", () => {
  // A ordem crua de `meta_atividades` não é contrato (o embed do
  // PostgREST não ordena). Aqui ela chega embaralhada de propósito.
  const trilhaOrdenada = {
    porCodigo: trilha.porCodigo,
    atividadesPorId: {
      a1: { id: "a1", disciplina_codigo: "mat", prioridade: "F", texto: "Primeiro alvo", ordem: 0 },
      a2: { id: "a2", disciplina_codigo: "por", prioridade: "P", texto: "Segundo alvo", ordem: 1 },
      a3: { id: "a3", disciplina_codigo: "mat", prioridade: "X", texto: "Terceiro alvo", ordem: 2 },
    },
  };
  const meta = { meta_atividades: [
    { id: "ma3", atividade_modelo_id: "a3", estado: "pendente" },
    { id: "ma1", atividade_modelo_id: "a1", estado: "pendente" },
    { id: "ma2", atividade_modelo_id: "a2", estado: "pendente" },
  ] };
  assert.equal(primeiroContextoPendente(meta, trilhaOrdenada)?.titulo, "Primeiro alvo");
  assert.deepEqual(
    objetivosPendentesEmOrdem(meta, trilhaOrdenada).map((x) => x.id),
    ["ma1", "ma2", "ma3"],
  );
});

test("R2-fix: objetivo pendente sem atividade na trilha não vira contexto vazio", () => {
  const meta = { meta_atividades: [
    { id: "ma9", atividade_modelo_id: "inexistente", estado: "pendente" },
    { id: "ma1", atividade_modelo_id: "a1", estado: "pendente" },
  ] };
  // o primeiro item não resolve: o CTA precisa cair no próximo que resolve
  assert.equal(primeiroContextoPendente(meta, trilha)?.atividadeModeloId, "a1");
  assert.equal(objetivosPendentesEmOrdem(meta, trilha).length, 1);
});

test("R2-fix: a prévia compacta nunca fica vazia quando não há pendente", () => {
  const src = ler("app/src/modules/motor/MetaSemana.jsx");
  assert.match(src, /const previa = praticaveis\.length > 0 \? praticaveis : itens;/);
  assert.match(src, /const visiveis = limite == null \? itens : previa\.slice\(0, limite\);/);
  // a lista compacta não pode voltar a fatiar direto os praticáveis
  assert.doesNotMatch(src, /limite == null \? itens : praticaveis\.slice/);
});

test("R2-fix: o foco acompanha a jornada em vez de cair no body", () => {
  const confirmacao = ler("app/src/modules/motor/ProgressoVivido.jsx");
  const visao = ler("app/src/routes/aluno/VisaoEstudo.jsx");
  const registrar = ler("app/src/modules/motor/Registrar.jsx");
  // confirmação assume o foco que o formulário desmontado deixou
  assert.match(confirmacao, /tituloRef\.current\?\.focus\(\)/);
  assert.match(confirmacao, /ref=\{tituloRef\} tabIndex=\{-1\}/);
  // voltar ao Hoje move foco, não só rolagem
  assert.match(visao, /missaoRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(visao, /ref=\{missaoRef\} tabIndex=\{-1\}/);
  // "Usar sugestão" some ao ser usada: o foco fica no campo de questões
  assert.match(registrar, /refQuestoes\.current\?\.focus\(\)/);
});

test("R2-fix: concluir o objetivo é decisão explícita do aluno, nunca efeito do registro", () => {
  const visao = ler("app/src/routes/aluno/VisaoEstudo.jsx");
  const confirmacao = ler("app/src/modules/motor/ProgressoVivido.jsx");
  // existe uma ação explícita, com trava de envio único
  assert.match(visao, /const concluirObjetivoDaJornada = async \(\) => \{/);
  assert.match(visao, /fecharObjetivo\.enviar\(/);
  assert.match(confirmacao, /Concluir este objetivo/);
  // e o estado só muda DEPOIS que o banco aceitou a escrita
  const corpo = visao.slice(visao.indexOf("const concluirObjetivoDaJornada"), visao.indexOf("const verMissaoAtualizada"));
  assert.ok(
    corpo.indexOf("db.definirEstadoAtividade") < corpo.indexOf("setObjetivoConcluido(true)"),
    "setObjetivoConcluido(true) precisa vir depois da escrita confirmada",
  );
  // nada marca o objetivo como concluído junto do insert do registro
  const registroConfirmado = visao.slice(visao.indexOf("const registroConfirmado"), visao.indexOf("const concluirObjetivoDaJornada"));
  assert.doesNotMatch(registroConfirmado, /definirEstadoAtividade|setObjetivoConcluido\(true\)/);
});

test("R2-fix: o CTA da confirmação não promete uma missão que pode não ter mudado", () => {
  const confirmacao = ler("app/src/modules/motor/ProgressoVivido.jsx");
  assert.match(confirmacao, /Voltar para a missão/);
  assert.doesNotMatch(confirmacao, /Ver missão atualizada/);
  // e diz a verdade sobre o objetivo continuar aberto
  assert.match(confirmacao, /O objetivo continua em aberto até você fechá-lo/);
});

test("R2-fix: o contexto do objetivo é aplicado uma vez e não apaga o que o aluno digitou", () => {
  const src = ler("app/src/modules/motor/Registrar.jsx");
  assert.match(src, /contextoAplicadoRef/);
  assert.match(src, /if \(contextoAplicadoRef\.current === contextoInicial\.chave\) return;/);
});

test("R2-fix: a sugestão de questões respeita o alvo mínimo de toque", () => {
  const css = ler("app/src/shared/ui/experiencia.css");
  const bloco = css.slice(css.indexOf(".journey-use-suggestion {"), css.indexOf(".journey-confirmation {"));
  const alvo = bloco.match(/min-height:\s*(\d+)px/);
  assert.ok(alvo, ".journey-use-suggestion precisa declarar min-height");
  assert.ok(Number(alvo[1]) >= 24, `alvo de toque de ${alvo[1]}px é menor que os 24px do WCAG 2.5.8`);
});
