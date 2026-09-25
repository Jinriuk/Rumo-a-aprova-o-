// @ts-check
/* ETAPA 3 — fumaça da stack local: o front buildado para o E2E abre,
   autentica nos dois caminhos (e-mail e código) e só fala com o backend
   LOCAL. A guarda de rede (local/base.js) já reprova qualquer chamada a
   *.supabase.co; aqui se exige também que a API local tenha sido usada. */
import { test, expect } from "./local/base.js";
import { CONTAS, coletarErros, loginAluno, loginCoordenacao, sair } from "./_apoio.js";

test("fumaça: coordenação entra por e-mail e o navegador usa a API local", async ({ page, rede }) => {
  const erros = coletarErros(page);
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
  await expect(page.getByText("Painel de gestão")).toBeVisible();
  expect(rede.api, "nenhuma chamada chegou à API local").toBeGreaterThan(0);
  await sair(page);
  expect(erros).toEqual([]);
});

test("fumaça: aluno entra por código e sai", async ({ page, rede }) => {
  await loginAluno(page, CONTAS.alunoLucas);
  expect(rede.api).toBeGreaterThan(0);
  await sair(page);
});
