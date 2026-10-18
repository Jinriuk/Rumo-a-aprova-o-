// ============================================================
// Raio-x fase 2 — Hoje e Plano pelo desenho aprovado em 18/10
// ------------------------------------------------------------
// Missões por semana (trilha_plano_missoes.semana_sugerida), a semana das
// missões pelo ritmo do aluno, a missão de agora, um botão só por missão
// (Iniciar com questões, Registrar sem), "Ver próximas semanas" na própria
// tela, revisão só no Plano, cronômetro ligado pela sessão e zerado ao
// fechar. Lado puro em conteudo/missoesPorSemana.js.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  escolherPlano, semanaPorMissao, montarMissoesPorSemana, podeComecar, resumoMissoesDaSemana, nomeCurtoMateria,
} from "../app/src/modules/conteudo/missoesPorSemana.js";
import { filaDeMissoes } from "../app/src/modules/conteudo/missoes.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

// PMERJ em miniatura: 2 matérias, 2 semanas, uma missão por matéria por semana
const CAT = [
  { id: "adm1", nome: "Organização administrativa", materia_codigo: "dir_adm", ordem: 0, meta_questoes: 20 },
  { id: "con1", nome: "Eficácia das normas", materia_codigo: "dir_const", ordem: 1, meta_questoes: 20 },
  { id: "adm2", nome: "Poderes do ato", materia_codigo: "dir_adm", ordem: 2, meta_questoes: 20 },
  { id: "con2", nome: "Direitos fundamentais", materia_codigo: "dir_const", ordem: 3, meta_questoes: 20 },
  { id: "sim4", nome: "Correção do simulado", materia_codigo: "dir_adm", ordem: 4, meta_questoes: null },
];
const VINC = [
  ...["adm1", "con1"].map((id, i) => ({ missao_id: id, semana: 1, ordem: i, plano_id: "p-int", plano_ordem: 2 })),
  ...["adm2", "con2"].map((id, i) => ({ missao_id: id, semana: 2, ordem: i, plano_id: "p-int", plano_ordem: 2 })),
  { missao_id: "sim4", semana: 4, ordem: 9, plano_id: "p-int", plano_ordem: 2 },
  { missao_id: "adm1", semana: 28, ordem: 0, plano_id: "p-anual", plano_ordem: 0 },
];
const linha = (missao_id, estado, questoes = 0) => ({ missao_id, estado, questoes_acumuladas: questoes, acuracia: null });
const montar = (progresso, total = 12) =>
  montarMissoesPorSemana({ fila: filaDeMissoes({ catalogo: CAT, progresso }), catalogo: CAT, vinculos: VINC, totalSemanas: total });

test("plano: vale o que tem mais missões ligadas a semanas (o PMERJ tem um só)", () => {
  assert.equal(escolherPlano(VINC), "p-int");
  assert.equal(semanaPorMissao(VINC).get("adm1").semana, 1, "o anual (semana 28) não manda");
  assert.equal(escolherPlano([]), null);
});

test("aluno novo: a semana das missões é a 1 (ritmo do aluno), mesmo com o calendário na 2", () => {
  const m = montar([]);
  assert.equal(m.semanaAtual, 1);
  assert.equal(m.missaoDeAgora.id, "adm1", "a primeira não concluída da semana, pela ordem");
  assert.ok(podeComecar(m.missaoDeAgora), "e o motor deixa começar");
  assert.deepEqual(m.porSemana.get(2).map((l) => podeComecar(l)), [false, false], "as da semana 2 esperam as da 1");
});

test("a missão de agora avança na semana e a semana avança quando tudo dela fecha", () => {
  const meio = montar([linha("adm1", "concluida", 20), linha("con1", "em_andamento", 6)]);
  assert.equal(meio.semanaAtual, 1);
  assert.equal(meio.missaoDeAgora.id, "con1");
  assert.equal(resumoMissoesDaSemana(meio.porSemana.get(1)).texto, "1 de 2 missões");
  const fim = montar([linha("adm1", "concluida", 20), linha("con1", "concluida", 20)]);
  assert.equal(fim.semanaAtual, 2);
  assert.equal(fim.missaoDeAgora.id, "adm2");
});

test("missão sem meta (simulado) fica na semana como 'manual', sem contar e sem virar a de agora", () => {
  const m = montar([linha("adm1", "concluida", 20), linha("con1", "concluida", 20), linha("adm2", "concluida", 20), linha("con2", "concluida", 20)]);
  assert.equal(m.porSemana.get(4)[0].estado, "manual");
  assert.equal(m.semanaAtual, null, "nada a fazer: missões em dia");
  assert.equal(m.missaoDeAgora, null);
  assert.equal(resumoMissoesDaSemana(m.porSemana.get(4)).texto, "1 missão com a coordenação", "e não '0 de 0'");
});

test("semana além da trilha vai para 'outras missões'", () => {
  const m = montar([], 1);
  assert.deepEqual(m.semSemana.map((l) => l.id), ["adm2", "con2", "sim4"]);
});

test("concurso sem plano semanal: a de agora sai das missões fora das semanas", () => {
  const m = montarMissoesPorSemana({ fila: filaDeMissoes({ catalogo: CAT, progresso: [] }), catalogo: CAT, vinculos: [], totalSemanas: 12 });
  assert.equal(m.semanaAtual, null);
  assert.equal(m.missaoDeAgora.id, "adm1", "e não 'Missões em dia'");
  assert.equal(m.comMeta, true);
});

test("concurso só com missões sem meta (CN no demo): nada a contar, sem 'Missões em dia'", () => {
  const soManual = CAT.map((c) => ({ ...c, meta_questoes: null }));
  const m = montarMissoesPorSemana({ fila: filaDeMissoes({ catalogo: soManual, progresso: [] }), catalogo: soManual, vinculos: VINC, totalSemanas: 12 });
  assert.equal(m.missaoDeAgora, null);
  assert.equal(m.comMeta, false, "o cartão diz que o concurso ainda não tem missões com questões");
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /semMissoes=\{missoesProntas && !missoesSemana\.comMeta\}/);
});

test("matéria fora da trilha do aluno: a missão fica com a coordenação, sem botão e sem contar (achado do Codex)", () => {
  const m = montarMissoesPorSemana({ fila: filaDeMissoes({ catalogo: CAT, progresso: [] }), catalogo: CAT, vinculos: VINC, totalSemanas: 12,
    materiasDaTrilha: ["dir_const"] });
  const adm1 = m.linhas.find((l) => l.id === "adm1");
  assert.equal(adm1.estado, "manual");
  assert.equal(adm1.coordenacao, true);
  assert.equal(podeComecar(adm1), false);
  assert.equal(m.missaoDeAgora.id, "con1", "a de agora é de matéria que o aluno registra");
  assert.equal(resumoMissoesDaSemana(m.porSemana.get(1)).texto, "0 de 1 missão");
  const concluida = montarMissoesPorSemana({ fila: filaDeMissoes({ catalogo: CAT, progresso: [linha("adm1", "concluida", 20)] }),
    catalogo: CAT, vinculos: VINC, totalSemanas: 12, materiasDaTrilha: ["dir_const"] });
  assert.equal(concluida.linhas.find((l) => l.id === "adm1").estado, "concluida", "a concluída continua concluída");
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /materiasDaTrilha: \(trilha\?\.disciplinas \?\? \[\]\)\.map\(\(d\) => d\.codigo\)/);
});

test("missão desativada pela escola e não concluída some", () => {
  const m = montarMissoesPorSemana({ fila: filaDeMissoes({ catalogo: CAT, progresso: [], ajustesEscola: [{ missao_id: "con1", ativa: false }] }),
    catalogo: CAT, ajustesEscola: [{ missao_id: "con1", ativa: false }], vinculos: VINC, totalSemanas: 12 });
  assert.deepEqual(m.porSemana.get(1).map((l) => l.id), ["adm1"]);
});

test("nome curto da matéria na linha", () => {
  assert.equal(nomeCurtoMateria("Direito Administrativo"), "Administrativo");
  assert.equal(nomeCurtoMateria("Direito Penal Militar"), "Penal Militar");
  assert.equal(nomeCurtoMateria("Direitos Humanos"), "Direitos Humanos");
  assert.equal(nomeCurtoMateria("Matemática"), "Matemática");
});

test("botões: Iniciar com questões, Registrar sem, nenhum fora da vez; concluída sem botão no Hoje e com Revisar no Plano", async () => {
  const src = semComentarios(ler("app/src/modules/motor/MissoesDaSemana.jsx"));
  assert.match(src, /if \(linha\.estado === "concluida"\) \{\s*if \(modo !== "plano"\) return null;/);
  assert.match(src, /if \(!podeComecar\(linha\)\) return null;/, "o servidor recusa a missão fora da vez");
  assert.match(src, /destino === "questoes" \? \{ tipo: "questoes", rotulo: "Iniciar" \} : \{ tipo: "registro", rotulo: "Registrar" \}/);
  assert.match(src, /acao\.tipo === "questoes" \? "▶ Iniciar missão" : "Registrar"/);
});

test("Hoje: cartão + missões da semana abertas; 'Ver próximas semanas' abre ali; nada troca de aba; sem radar nem tarefas", () => {
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  const hoje = visao.slice(visao.indexOf('tab === "hoje" && ('), visao.indexOf('tab === "registrar" && podeEditar'));
  assert.match(hoje, /<MissaoDeAgora missao=\{missoesSemana\.missaoDeAgora\}/);
  assert.match(hoje, /<MissoesDoHoje montagem=\{missoesSemana\}/);
  assert.doesNotMatch(hoje, /irAba\("plano"\)|TarefasDaSemana|RadarDesempenho|MissoesPersistidas/);
  assert.match(hoje, /resolvendo \? sessaoDeQuestoes : registroNoHoje && podeEditar \?/, "sessão e registro no lugar do cartão");
  const bloco = semComentarios(ler("app/src/modules/motor/MissoesDaSemana.jsx"));
  assert.match(bloco, /aria-expanded=\{verProximas\} onClick=\{\(\) => setVerProximas\(\(v\) => !v\)\}/);
  assert.match(visao, /if \(tab === "hoje"\) abrirRegistroNoHoje\(ctx\); else irAba\("registrar", ctx\);/);
});

test("Plano: missões dentro de cada semana, tarefas abaixo delas; abertas a semana das missões e a do calendário", () => {
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  const bloco = visao.slice(visao.indexOf("function BlocoSemana("));
  assert.match(bloco, /const \[aberto, setAberto\] = useState\(isNow \|\| abertaPeloRitmo\);/);
  assert.ok(bloco.indexOf("<ListaMissoes ") < bloco.indexOf("Tarefas da semana"), "missões antes das tarefas");
  assert.match(bloco, /<TarefasDaSemana meta=\{meta\}/);
  assert.match(visao, /missoes=\{missoesSemana\?\.porSemana\.get\(w\.numero\) \?\? \[\]\}/);
});

test("cronômetro: a sessão liga, e ao fechar para e zera só o que ela ligou (o lote já grava os minutos)", () => {
  const c = semComentarios(ler("app/src/shared/ui/Cronometro.jsx"));
  assert.match(c, /export function Cronometro\(\{ aoFinalizar, sessao = false \}\)/);
  assert.match(c, /atual\.fase === "parado" \? \{ fase: "rodando", acumuladoMs: 0, marcoMs: Date\.now\(\), daSessao: true \} : atual/);
  assert.match(c, /atual\.daSessao \? \{ fase: "parado", acumuladoMs: 0, marcoMs: 0 \} : atual/);
  assert.match(c, /\{!st\.daSessao && <button type="button" onClick=\{finalizar\}/, "tempo da sessão não vai ao registro");
  assert.match(semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx")), /<Cronometro sessao=\{!!resolvendo\}/);
});

test("dados: a semana de cada missão vem de trilha_plano_missoes, e o cartão espera ela chegar", () => {
  const dados = semComentarios(ler("app/src/shared/data/index.js"));
  assert.match(dados, /from\("trilha_plano_missoes"\)\s*\.select\("missao_id, semana_sugerida, ordem, trilha_planos!inner\(id, exam_tag, tipo, ordem\)"\)/);
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /db\.carregarSemanasDasMissoes\(examTag\)\.catch\(\(\) => \[\]\)/);
  assert.match(visao, /const missoesProntas = !examTag \|\| \(catalogoMissoes\.examTag === examTag && gam\.versao >= 0\);/);
  assert.match(visao, /carregando=\{!missoesProntas\}/);
});

test("achados do Codex no #197: Revisar espera a lista, catálogo que falha não vira currículo vazio, semana do ritmo abre, cronômetro da sessão não sobra", () => {
  const md = semComentarios(ler("app/src/modules/motor/MissoesDaSemana.jsx"));
  assert.match(md, /const revisao = destinoDoInicio\(linha, questoesIntegradas, \{ podeResolver \}\);\s*if \(revisao === "carregando"\) return \{ tipo: "carregando"/);
  assert.match(md, /Não deu para carregar suas missões/);
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /vinculos: \[\], erro: true \}\); \}\);\s*return \(\) => \{ vivo = false; \};\s*\}, \[examTag, tentativaCatalogo\]\);/);
  assert.match(visao, /useEffect\(\(\) => \{ if \(abertaPeloRitmo\) setAberto\(true\); \}, \[abertaPeloRitmo\]\);/);
  const c = semComentarios(ler("app/src/shared/ui/Cronometro.jsx"));
  assert.match(c, /useEffect\(\(\) => \(\) => \{\s*if \(stRef\.current\.daSessao\)/);
  const guia = ler("app/src/shared/guia/roteiros.js");
  assert.doesNotMatch(guia, /leva ao Plano/, "nada no Hoje troca de aba");
});
