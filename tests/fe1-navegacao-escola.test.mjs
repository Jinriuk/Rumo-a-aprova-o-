// ============================================================
// FE1 — reducer de navegação da Área da Escola.
// Prova que cada transição deixa o estado COERENTE: trocar de aba
// fecha a ficha e zera o filtro; abrir/fechar aluno não perde a aba.
// (Antes eram 3 useState soltos, fácil de esquecer de zerar um.)
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { navReducer, NAV_INICIAL } from "../app/src/routes/escola/navegacaoEscola.js";

test("estado inicial", () => {
  assert.deepEqual(NAV_INICIAL, { tab: "painel", filtroStatus: "", alunoAberto: null });
});

test("ir: troca aba, zera filtro e fecha ficha", () => {
  const aberto = { tab: "alunos", filtroStatus: "sem-atividade", alunoAberto: { id: "a1" } };
  assert.deepEqual(navReducer(aberto, { tipo: "ir", tab: "ranking" }),
    { tab: "ranking", filtroStatus: "", alunoAberto: null });
});

test("irFiltrado: vai para a aba com o filtro aplicado", () => {
  assert.deepEqual(navReducer(NAV_INICIAL, { tipo: "irFiltrado", tab: "alunos", filtro: "meta-atrasada" }),
    { tab: "alunos", filtroStatus: "meta-atrasada", alunoAberto: null });
});

test("irFiltrado sem filtro vira string vazia (não undefined)", () => {
  assert.equal(navReducer(NAV_INICIAL, { tipo: "irFiltrado", tab: "alunos" }).filtroStatus, "");
});

test("abrirAluno preserva aba e filtro; fecharAluno só fecha", () => {
  const base = { tab: "alunos", filtroStatus: "sem-credencial", alunoAberto: null };
  const aberto = navReducer(base, { tipo: "abrirAluno", aluno: { id: "a9" } });
  assert.deepEqual(aberto, { tab: "alunos", filtroStatus: "sem-credencial", alunoAberto: { id: "a9" } });
  const fechado = navReducer(aberto, { tipo: "fecharAluno" });
  assert.deepEqual(fechado, { tab: "alunos", filtroStatus: "sem-credencial", alunoAberto: null });
});

test("ação desconhecida não altera o estado", () => {
  const estado = { tab: "marca", filtroStatus: "", alunoAberto: null };
  assert.equal(navReducer(estado, { tipo: "???" }), estado);
});
