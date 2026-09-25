// ============================================================
// ALUNO SEM TRILHA É ESTADO NORMAL, E A COORDENAÇÃO CONSEGUE SAIR DELE
// ------------------------------------------------------------
// Produção, 25/09/2026: o aluno "Joao" foi cadastrado às 13:23 UTC sem
// trilha e sem concurso, e o gerar-meta respondeu 422 "sem_trilha".
//
// Como aconteceu: a carga da coordenação (turmas, alunos, concursos,
// trilhas num Promise.all só) caiu com o HTTP 300 do embed ambíguo. O
// formulário de cadastro continuou aberto com as listas vazias, então não
// havia concurso para escolher nem trilha para derivar dele.
//
// O que a tela mostrava: "Joao cadastrado. Gere a credencial na lista
// abaixo." Nenhum erro para o usuário (gerarMetasEmLote já tratava
// sem_trilha como estado válido), mas o 422 aparecia no console como
// console.error e o aluno ficava sem caminho para ganhar trilha: o
// seletor da lista só existia com mais de uma trilha publicada, e a ficha
// parava em "Aluno sem trilha de estudo." antes da barra de ações.
//
// Inspeção de fonte, no padrão dos testes de tela deste repositório.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(resolve(root, p), "utf8");

function corpoDe(codigo, marcador, fim = "\n}\n") {
  const i = codigo.indexOf(marcador);
  assert.ok(i >= 0, `${marcador} não encontrado`);
  return codigo.slice(i, codigo.indexOf(fim, i) + fim.length);
}

test("cadastro não chama gerar-meta para aluno sem trilha", () => {
  const corpo = corpoDe(src("app/src/modules/pessoas/CadastroAlunos.jsx"), "async function gerarMetasEmLote(");
  assert.match(corpo, /alunos\.filter\(\(a\) => a\.trilha_id\)/);
  assert.match(corpo, /comConcorrenciaLimitada\(comTrilha,/, "o lote tem que iterar só os alunos com trilha");
});

test("422 sem_trilha do gerar-meta é falha esperada (fora do console.error)", () => {
  const dados = src("app/src/shared/data/index.js");
  assert.match(dados, /const ESTADOS_ESPERADOS = new Set\(\["sem_trilha"\]\);/);
  const corpo = corpoDe(dados, "async function invocar(");
  assert.match(corpo, /falha\(fn, new Error\(detalhe\), \{ esperada: ESTADOS_ESPERADOS\.has\(estado\) \}\)/);
});

test("com a carga da escola em erro, o formulário de cadastro não abre", () => {
  const cadastro = src("app/src/modules/pessoas/CadastroAlunos.jsx");
  assert.match(cadastro, /export function PainelCadastroAlunos\(\{[^}]*indisponivel = false \}\)/);
  assert.match(cadastro, /\{indisponivel \? \(/);
  const area = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(area, /<PainelCadastroAlunos [^>]*indisponivel=\{!!erro\} \/>/);
});

test("lista: aluno sem trilha vê o seletor mesmo com uma trilha publicada só", () => {
  const lista = src("app/src/modules/pessoas/ListaAlunos.jsx");
  assert.match(lista, /\{trilhas\.length > 0 && \(trilhas\.length > 1 \|\| !a\.trilha_id\) && \(/);
});

test("primeira trilha gera a meta na hora; troca entre trilhas não", () => {
  for (const [arquivo, quem] of [
    ["app/src/modules/pessoas/ListaAlunos.jsx", "a"],
    ["app/src/modules/desempenho/FichaAluno.jsx", "aluno"],
  ]) {
    const codigo = src(arquivo);
    const corpo = corpoDe(codigo, "const trocarTrilha = async (", "\n  };\n");
    assert.match(corpo, new RegExp(`const primeiraTrilha = !${quem}\\.trilha_id && !!trilhaId;`), arquivo);
    assert.match(corpo, /if \(!primeiraTrilha\) return;/, arquivo);
    assert.match(corpo, new RegExp(`await db\\.gerarMeta\\(${quem}\\.id\\)`), arquivo);
    // a confirmação continua antes de qualquer gravação
    assert.ok(corpo.indexOf("dialogo.confirmar") < corpo.indexOf("db.atualizarAluno"), arquivo);
  }
});

test("ficha: aluno sem trilha tem onde definir a trilha", () => {
  const ficha = src("app/src/modules/desempenho/FichaAluno.jsx");
  assert.doesNotMatch(ficha, /if \(!trilha\) return <Empty txt="Aluno sem trilha de estudo\." \/>;/,
    "a ficha voltou a parar no 'sem trilha' sem ação nenhuma");
  const bloco = corpoDe(ficha, "if (!trilha) return (", "\n  );\n");
  assert.match(bloco, /onChange=\{\(e\) => trocarTrilha\(e\.target\.value\)\}/);
  assert.match(bloco, /\{dialogo\.elemento\}/, "sem o elemento do diálogo a confirmação não aparece");
});

test("carga da escola em erro sem dado anterior: as abas não desenham o estado vazio", () => {
  // Com o HTTP 300 o painel dizia "Nenhum aluno cadastrado ainda" e a
  // lista "0 de 0" embaixo do aviso de erro, como se a escola estivesse
  // vazia. Só a Marca (que não lê o núcleo) segue aberta.
  const area = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(area, /const semNucleo = !!erro && !carregado;/);
  assert.match(area, /const mostrarAbas = !carregando && !semNucleo;/);
  for (const aba of ["painel", "alunos", "ranking", "turmas", "ciclo", "conformidade"]) {
    assert.match(area, new RegExp(`\\{mostrarAbas && !alunoAberto && tab === "${aba}"`), aba);
  }
  assert.match(area, /\{mostrarAbas && alunoAberto && \(/, "a ficha também depende do núcleo");
  assert.doesNotMatch(area, /\{!carregando && !alunoAberto && tab === "(?!marca")/);
});
