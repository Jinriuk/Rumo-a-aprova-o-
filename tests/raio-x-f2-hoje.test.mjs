// ============================================================
// Raio-x fase 2, PR 2 — Hoje com uma ação (mudanças 2 e 3)
// ------------------------------------------------------------
// Decisões de 18/10: o topo do Hoje é a missão da vez (matéria, assunto,
// "X de N questões") com um botão só; a semana vira uma linha; a missão
// da vez é a da matéria da primeira tarefa pendente da semana.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { acaoDaVez, resumoDaSemana, textoDaTarefa, tituloDaTarefa, contextoRegistroDaAtividade } from "../app/src/modules/motor/jornada.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const TRILHA = {
  semanas: [{ numero: 1 }, { numero: 2 }, { numero: 3 }],
  atividadesPorId: {
    a1: { id: "a1", disciplina_codigo: "por", ordem: 1, texto: "Missão: Crase. Leitura: 20 min." },
    a2: { id: "a2", disciplina_codigo: "mat", ordem: 2, texto: "Equações" },
    a3: { id: "a3", disciplina_codigo: "sim", ordem: 3, texto: "Simulado completo" },
  },
};
const meta = (estados, semana = 2) => ({
  semana_numero: semana,
  meta_atividades: Object.entries(estados).map(([id, estado]) => ({ id: `ma-${id}`, atividade_modelo_id: id, estado })),
});
const missao = (id, materia, estado, extra = {}) => ({ id, materia_codigo: materia, estado, proxima: false, nome: id, questoes: 0, meta_questoes: 20, ...extra });
const FILA = [
  { materia_codigo: "mat", missoes: [missao("M-MAT-1", "mat", "concluida"), missao("M-MAT-2", "mat", "atual")] },
  { materia_codigo: "por", missoes: [missao("M-POR-1", "por", "a_seguir", { proxima: true })] },
];

test("a missão da vez é a da matéria da primeira tarefa pendente da semana", () => {
  const a = acaoDaVez({ fila: FILA, meta: meta({ a1: "pendente", a2: "pendente" }), trilha: TRILHA });
  assert.equal(a.tipo, "missao");
  assert.equal(a.missao.id, "M-POR-1", "a primeira pendente é de Português: a próxima a começar dele");
  const b = acaoDaVez({ fila: FILA, meta: meta({ a1: "concluida", a2: "pendente" }), trilha: TRILHA });
  assert.equal(b.missao.id, "M-MAT-2", "Português feito: a da vez de Matemática (a atual, não a concluída)");
});

test("tarefa sem missão na matéria (simulado) passa para a próxima pendente; sem nenhuma, a primeira da fila", () => {
  const a = acaoDaVez({ fila: FILA, meta: meta({ a3: "pendente", a2: "pendente" }), trilha: TRILHA });
  assert.equal(a.missao.id, "M-MAT-2");
  const b = acaoDaVez({ fila: FILA, meta: meta({ a1: "concluida", a2: "concluida" }), trilha: TRILHA });
  assert.equal(b.missao.id, "M-MAT-2", "semana em dia: a primeira da fila");
  const c = acaoDaVez({ fila: FILA, meta: null, trilha: TRILHA });
  assert.equal(c.missao.id, "M-MAT-2", "sem meta (semana sendo preparada) ainda há missão");
});

test("matéria fora da trilha do aluno não vira a missão da vez", () => {
  const a = acaoDaVez({ fila: FILA, meta: meta({ a1: "pendente" }), trilha: TRILHA, registraveis: new Set(["mat"]) });
  assert.equal(a.missao.id, "M-MAT-2");
});

test("sem missão: a tarefa pendente é a ação; sem tarefa, registro livre", () => {
  const fechada = [{ materia_codigo: "mat", missoes: [missao("M-MAT-1", "mat", "concluida")] }];
  const a = acaoDaVez({ fila: fechada, meta: meta({ a2: "pendente", a1: "pendente" }), trilha: TRILHA });
  assert.equal(a.tipo, "tarefa");
  assert.equal(a.tarefa.atividade_modelo_id, "a1", "na ordem da semana, não na do banco");
  assert.equal(a.atividade.disciplina_codigo, "por");
  assert.deepEqual(acaoDaVez({ fila: [], meta: meta({ a1: "concluida" }), trilha: TRILHA }), { tipo: "livre" });
  assert.deepEqual(acaoDaVez(), { tipo: "livre" });
});

test("a semana em uma linha: posição na trilha e tarefas feitas sem as adiadas", () => {
  const r = resumoDaSemana(meta({ a1: "concluida", a2: "pendente", a3: "ignorada" }), TRILHA);
  assert.equal(r.texto, "Semana 2 de 3 · 1 de 2 tarefas");
  assert.equal(resumoDaSemana(meta({ a1: "concluida", a2: "ignorada" }, 1), TRILHA).texto, "Semana 1 de 3 · 1 de 1 tarefa");
  assert.equal(resumoDaSemana(null, TRILHA), null);
});

test("mudança 3: o item da semana que diz 'Missão:' é um estudo; o título é a primeira frase", () => {
  assert.equal(textoDaTarefa("Missão: Crase. Leitura: 20 min."), "Estudo: Crase. Leitura: 20 min.");
  assert.equal(textoDaTarefa("Equações"), "Equações");
  assert.equal(tituloDaTarefa("Missão: Crase. Leitura: 20 min."), "Estudo: Crase");
  assert.equal(tituloDaTarefa("Equações e sistemas lineares"), "Equações e sistemas lineares");
});

test("o Hoje tem uma ação: cartão da missão da vez e linha da semana; lista de missões, tarefas e radar saíram", () => {
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  const hoje = visao.slice(visao.indexOf('tab === "hoje" && ('), visao.indexOf('tab === "registrar" && podeEditar'));
  assert.match(hoje, /<MissaoDaVez acao=\{acao\}/);
  assert.match(hoje, /<LinhaDaSemana resumo=\{resumoDaSemana\(meta, trilha\)\} aoAbrir=\{\(\) => irAba\("plano"\)\} \/>/);
  assert.doesNotMatch(hoje, /<MissoesPersistidas|<MetaSemana|<MissaoAtual|RadarDesempenho/);
  assert.match(hoje, /\) : !resolvendo && \(/, "a sessão de questões abre no lugar do cartão");
  const plano = visao.slice(visao.indexOf('tab === "plano" && ('));
  assert.match(plano, /<Plano [^>]*podeEditar=\{podeEditar\} aoMudar=\{recarregar\}/, "Concluir/Adiar vão para o Plano");
  assert.match(plano, /<MissoesPersistidas /);
  assert.match(visao, /k === "plano" && podeEditar && pendentes > 0/, "o número de pendentes vai com as tarefas");
  const hero = semComentarios(ler("app/src/modules/motor/MetaHero.jsx"));
  assert.doesNotMatch(hero, /MissaoAtual|RADAR|L\.radar/);
});

test("o botão do cartão: questões ligadas → Resolver questões; sem → Registrar estudo com a missão; carregando não decide", () => {
  const card = semComentarios(ler("app/src/modules/motor/MissaoDaVez.jsx"));
  assert.match(card, /destino = destinoDoInicio\(mi, questoesIntegradas, \{ podeResolver: !!aoResolver \}\);/);
  assert.match(card, /contexto = contextoRegistroDaMissao\(mi, "missao"\);/);
  assert.match(card, /if \(destino === "questoes"\) aoResolver\(acao\.missao\);\s*else if \(destino === "registro"\) aoRegistrar\(contexto\);/);
  assert.match(card, /carregando \? "Carregando…" : destino === "questoes" \? "Resolver questões" : "Registrar estudo"/);
  assert.match(card, /disabled=\{carregando\} aria-busy=\{carregando \|\| undefined\}/);
  assert.equal((card.match(/<button /g) ?? []).length, 2, "um botão no cartão, outro na linha da semana");
  assert.match(card, /\$\{mi\.questoes\} de \$\{mi\.meta_questoes\} questões/);
});

// PR 3: o Plano no lugar da Trilha, para o aluno
test("abas do aluno: Hoje, Plano, Registrar, Desempenho, Simulados e Histórico por último; Conquistas pelo XP", () => {
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  const bloco = visao.slice(visao.indexOf("const ABAS = ["), visao.indexOf("].filter", visao.indexOf("const ABAS = [")));
  assert.deepEqual([...bloco.matchAll(/\["([a-z]+)", "/g)].map((m) => m[1]), ["hoje", "plano", "registrar", "desempenho", "simulados", "historico"]);
  assert.doesNotMatch(visao, /<TrilhaConcurso|tab === "concurso"/, "a Trilha sai para o aluno");
  assert.match(visao, /aoAbrirConquistas=\{\(\) => irAba\("conquistas"\)\}/, "o XP do topo abre as conquistas");
  assert.match(visao, /tab === "conquistas" && m && \([\s\S]*?← Voltar ao Hoje/);
  // a coordenação continua com a visão dela (ficha + trilha do concurso)
  assert.match(ler("app/src/modules/desempenho/FichaAluno.jsx"), /<TrilhaConcurso /);
});

test("Plano: semanas em blocos (a atual aberta), tarefas dentro, Concluir só na atual, missões abaixo", () => {
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /const \[aberto, setAberto\] = useState\(isNow\);/, "a atual nasce aberta, as outras fechadas");
  assert.match(visao, /aria-expanded=\{aberto\} aria-controls=\{idCorpo\}/);
  assert.match(visao, /<TarefasDaSemana meta=\{meta\} atividades=\{previstas\}/);
  assert.match(visao, /podeEditar=\{podeEditar && w\.numero === meta\?\.semana_numero && meta\?\.status === "ativa"\}/);
  assert.match(visao, /const metaPorSemana = Object\.fromEntries\(\(metas \?\? \[\]\)\.map\(\(x\) => \[x\.semana_numero, x\]\)\);/,
    "semana passada mostra o que foi feito nela, não o estado da atual");
  const plano = visao.slice(visao.indexOf("function Plano("), visao.indexOf("function BlocoSemana("));
  assert.ok(plano.indexOf("trilha.semanas.map") < plano.indexOf("{children}"), "missões depois das semanas");
});

// achados do Codex no #194
test("o cartão espera o catálogo e o progresso das missões antes de escolher a ação", () => {
  const visao = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(visao, /const missoesProntas = !examTag \|\| \(catalogoMissoes\.examTag === examTag && gam\.versao >= 0\);/);
  assert.match(visao, /: \{ tipo: "carregando" \};/);
  assert.match(visao, /\.catch\(\(\) => \{ if \(vivo\) setCatalogoMissoes\(\{ examTag, missoes: \[\], ajustes: \[\], nomes: \{\} \}\); \}\);/,
    "catálogo que falha não deixa o cartão esperando para sempre");
  const card = semComentarios(ler("app/src/modules/motor/MissaoDaVez.jsx"));
  assert.match(card, /acao\.tipo === "carregando"\) \{[\s\S]*?destino = "carregando";/);
});

test("o registro aberto pela tarefa leva o mesmo texto que ela mostra ('Estudo:', não 'Missão:')", () => {
  const ctx = contextoRegistroDaAtividade({ id: "ma-a1", atividade_modelo_id: "a1" }, TRILHA);
  assert.equal(ctx.titulo, "Estudo: Crase. Leitura: 20 min.");
});
