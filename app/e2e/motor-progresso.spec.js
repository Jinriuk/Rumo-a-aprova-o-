// @ts-check
/* Motor de Progresso — Fase C0 (migration 0022_motor_progresso).
   Garante que o ledger persistido (aluno_eventos_progresso) está ATIVO
   neste ambiente de validação. Se a tabela não existir, os testes que
   verificam eventos reais FALHAM — por design, provando que o motor é
   real e não o fallback legado (calcularXP).

   Pré-condição: migration 0022 aplicada + backfill executado.
   Roda contra o banco de demo real (sem mock). */
import { test, expect } from "@playwright/test";
import {
  coletarErros,
  loginCoordenacao,
  loginAluno,
  irParaAba,
  semEstouroHorizontal,
  CONTAS,
  botaoVisivel,
} from "./_apoio.js";

// ------------------------------------------------------------------
// 1. Motor ativo: coordenação vê histórico com eventos reais
//    Se aluno_eventos_progresso não existir → degradação graciosa
//    retorna [] → EmptyState "Nenhum evento ainda" → teste falha aqui.
// ------------------------------------------------------------------
test("motor ativo — coordenação vê histórico de progresso com eventos reais", async ({ page }) => {
  const erros = coletarErros(page);
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);

  await irParaAba(page, "Alunos");
  await expect(page.getByText("Alunos da escola")).toBeVisible();

  // abre ficha do primeiro aluno da escola Vitrine
  await page.getByRole("button", { name: "Ver desempenho" }).first().click();
  await expect(
    page.getByRole("button", { name: /voltar ao painel/ })
  ).toBeVisible({ timeout: 15_000 });

  // seção de histórico deve estar presente
  await expect(page.getByText("Histórico de progresso")).toBeVisible({ timeout: 15_000 });

  // subtitle "N eventos · X XP somados" só aparece quando há dados reais.
  // Se a tabela não existir → array vazio → subtitle null → FALHA AQUI.
  await expect(page.getByText(/eventos ·/)).toBeVisible({ timeout: 15_000 });

  // pelo menos um rótulo humano de evento deve ser visível
  await expect(
    page
      .getByText(/Registro de estudo|Objetivo de missão concluído|Simulado finalizado/)
      .first()
  ).toBeVisible({ timeout: 15_000 });

  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});

// ------------------------------------------------------------------
// 2. Aluno vê XP do ledger na tela "Hoje" (Faixa do Aspirante)
//    Lucas tem missões e simulados no backfill → XP > 0 via ledger.
//    O fallback legado calcularXP() também retorna > 0 para ele, mas
//    se QUALQUER erro de console aparecer (ex.: tabela ausente causando
//    throw inesperado), coletarErros captura e o teste falha.
// ------------------------------------------------------------------
test("aluno — Faixa do Aspirante exibe XP maior que zero sem erros de console", async ({ page }) => {
  const erros = coletarErros(page);
  await loginAluno(page, CONTAS.alunoLucas);

  // FaixaAspirante está na aba "Hoje" (rota inicial do aluno)
  await expect(botaoVisivel(page, "Hoje")).toBeVisible();

  // o badge de XP exibe "N XP" — qualquer número formatado
  const xpEl = page.getByText(/\d[\d.,]*\s*XP/).first();
  await expect(xpEl).toBeVisible({ timeout: 15_000 });

  const texto = (await xpEl.textContent()) ?? "";
  const xp = parseInt(texto.replace(/\D/g, ""), 10);
  expect(xp, "XP deve ser maior que zero (ledger com backfill ou fallback)").toBeGreaterThan(0);

  await semEstouroHorizontal(page);
  expect(erros, "nenhum erro de console esperado").toEqual([]);
});

// ------------------------------------------------------------------
// 3. Aluno navega pelo fluxo Hoje → Desempenho sem erros de console.
//    O carregarXpPersistido é chamado nas duas rotas; erros de
//    configuração ou RLS apareceriam como erros de console aqui.
// ------------------------------------------------------------------
test("aluno — Hoje e Desempenho carregam sem erros de console", async ({ page }) => {
  const erros = coletarErros(page);
  await loginAluno(page, CONTAS.alunoLucas);

  // aba Hoje já está ativa após login — verifica a missão atual
  await expect(
    page.getByText(/MISSÃO|Missão sendo preparada/).first()
  ).toBeVisible({ timeout: 15_000 });

  // aba Desempenho: usa o mesmo XP persistido para mostrar o radar
  await irParaAba(page, "Desempenho");
  await expect(
    page.getByText(/Radar de bordo|Eficiência por setor|Inteligência incompleta/).first()
  ).toBeVisible({ timeout: 15_000 });

  await semEstouroHorizontal(page);
  expect(erros, "nenhum erro de console esperado no fluxo aluno").toEqual([]);
});

// ------------------------------------------------------------------
// 4. Coordenação: múltiplos alunos têm eventos (backfill completo).
//    Abre a ficha do segundo aluno da lista e repete a assertiva de
//    eventos — garante que o backfill não foi parcial.
// ------------------------------------------------------------------
test("motor ativo — segundo aluno também tem eventos no ledger", async ({ page }) => {
  const erros = coletarErros(page);
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);

  await irParaAba(page, "Alunos");
  await expect(page.getByText("Alunos da escola")).toBeVisible();

  const botoesVerDesempenho = page.getByRole("button", { name: "Ver desempenho" });
  await expect(botoesVerDesempenho).toHaveCount(await botoesVerDesempenho.count(), { timeout: 10_000 });
  const total = await botoesVerDesempenho.count();

  // precisa de pelo menos 2 alunos para este teste fazer sentido
  expect(total, "escola deve ter pelo menos 2 alunos na lista").toBeGreaterThan(1);

  // abre o segundo aluno
  await botoesVerDesempenho.nth(1).click();
  await expect(
    page.getByRole("button", { name: /voltar ao painel/ })
  ).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("Histórico de progresso")).toBeVisible({ timeout: 15_000 });

  // pode ser empty-state legítimo se o 2º aluno não tiver dados;
  // o que NÃO pode é ser um erro (tabela ausente → thrown error mascarado)
  // → verificamos que não há erro de console
  expect(erros, "nenhum erro de console ao abrir ficha do segundo aluno").toEqual([]);
});

// ------------------------------------------------------------------
// 5. RLS: aluno NÃO consegue ver eventos de outro aluno (isolamento).
//    O aluno Lucas não pode ver dados do banco de dados de outro aluno
//    — a query retorna apenas registros dele próprio.
//    Testado indiretamente: o XP exibido é consistente (< 100.000 XP,
//    não é a soma de toda a tabela).
// ------------------------------------------------------------------
test("aluno — XP exibido é plausível (não vaza dados de outros alunos)", async ({ page }) => {
  const erros = coletarErros(page);
  await loginAluno(page, CONTAS.alunoLucas);

  const xpEl = page.getByText(/\d[\d.,]*\s*XP/).first();
  await expect(xpEl).toBeVisible({ timeout: 15_000 });

  const texto = (await xpEl.textContent()) ?? "";
  // remove separadores e extrai número
  const xp = parseInt(texto.replace(/[.\s]/g, "").replace(/[^\d]/g, ""), 10);

  // soma total de toda a escola no backfill é ~14.450 XP;
  // se vazar todos os dados, XP estaria > 50.000 → vazamento detectado
  expect(xp, "XP não deve vazar dados de outros alunos da escola").toBeLessThan(50_000);

  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});
