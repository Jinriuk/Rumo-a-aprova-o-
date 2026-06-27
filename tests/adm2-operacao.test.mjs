// ============================================================
// ADM2 — núcleo de operação do SuperADM (lógica PURA, sem banco)
// ------------------------------------------------------------
// Prova, sem rede e sem segredo, que a classificação de escola, os
// avisos de risco, o checklist de go-live, as modalidades placeholder
// e os filtros de auditoria se comportam exatamente como o operador
// precisa — e, principalmente, que NUNCA afirmam "real"/"pronto" por
// omissão. Espelha a doutrina honesta do projeto (nada verde-vazio).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  categoriaEscola, CATEGORIAS,
  avisosRisco, severidadeMaxima,
  checklistGoLive, resumoChecklist,
  modalidadesDaEscola, MODALIDADES,
  resumoRisco,
  filtrarLogs, acoesPresentes,
} from "../app/src/modules/backoffice/operacao.js";

/* ---------- 1) categoria da escola (tarefa 38) ---------- */

test("categoria: status 'demo' e slugs de vitrine viram DEMO", () => {
  assert.equal(categoriaEscola({ status: "demo" }).chave, "demo");
  assert.equal(categoriaEscola({ status: "ativa", slug: "vitrine-naval" }).chave, "demo");
  assert.equal(categoriaEscola({ slug: "colegio", plano: "demo-2025" }).chave, "demo");
  assert.equal(categoriaEscola({ nome: "Escola Demonstração" }).chave, "demo");
});

test("categoria: plano individual/b2c ou limite 1 viram INDIVIDUAL", () => {
  assert.equal(categoriaEscola({ plano: "individual" }).chave, "individual");
  assert.equal(categoriaEscola({ plano: "B2C-mensal" }).chave, "individual");
  assert.equal(categoriaEscola({ status: "ativa", limite_alunos: 1 }).chave, "individual");
});

test("categoria: implantacao/piloto e slugs de sandbox viram TESTE", () => {
  assert.equal(categoriaEscola({ status: "implantacao" }).chave, "teste");
  assert.equal(categoriaEscola({ status: "piloto" }).chave, "teste");
  assert.equal(categoriaEscola({ status: "ativa", slug: "qa-sandbox" }).chave, "teste");
});

test("categoria: ATIVA limpa é REAL; só ativa pode virar real", () => {
  assert.equal(categoriaEscola({ status: "ativa", slug: "colegio-naval", plano: "padrao", limite_alunos: 200 }).chave, "real");
  // sem status ativa, nunca afirma real por omissão
  assert.equal(categoriaEscola({}).chave, "teste");
  assert.equal(categoriaEscola({ status: "suspensa" }).chave, "teste");
});

test("categoria: demo vence ativa (não confunde vitrine com cliente real)", () => {
  const c = categoriaEscola({ status: "ativa", slug: "demo-rj" });
  assert.equal(c.chave, "demo");
  assert.equal(c.rotulo, CATEGORIAS.demo.rotulo);
});

/* ---------- 2) avisos de risco (tarefa 41) ---------- */

const cods = (avs) => avs.map((a) => a.codigo);

test("risco: escola sem coordenador é RISCO vermelho", () => {
  const av = avisosRisco({ status: "implantacao", coordenadores: 0, alunos: 0 });
  assert.ok(cods(av).includes("sem-coordenador"));
  assert.equal(av.find((a) => a.codigo === "sem-coordenador").nivel, "risco");
});

test("risco: limite de alunos excedido é RISCO", () => {
  const d = { escola: { status: "ativa", limite_alunos: 10 }, coordenadores: [{ email: "a@b.c" }], alunos: 15, alunos_com_credencial: 15, responsaveis: 1, consentimentos: 1 };
  const av = avisosRisco({ status: "ativa", limite_alunos: 10, coordenadores: 1, alunos: 15 }, d);
  assert.ok(cods(av).includes("limite-excedido"));
  assert.equal(av.find((a) => a.codigo === "limite-excedido").nivel, "risco");
});

test("risco: coordenador sem e-mail de acesso é ALERTA (precisa do detalhe)", () => {
  const d = { escola: { status: "ativa" }, coordenadores: [{ id: "x", nome: "Sem login", email: null }], alunos: 5, alunos_com_credencial: 5, responsaveis: 0, consentimentos: 1 };
  const av = avisosRisco({ status: "ativa", coordenadores: 1, alunos: 5 }, d);
  assert.ok(cods(av).includes("coordenador-sem-login"));
});

test("risco: escola sem alunos alerta — mas NÃO para ambiente demo", () => {
  const real = avisosRisco({ status: "implantacao", coordenadores: 1, alunos: 0 });
  assert.ok(cods(real).includes("sem-alunos"));
  const demo = avisosRisco({ status: "demo", coordenadores: 1, alunos: 0 });
  assert.ok(!cods(demo).includes("sem-alunos"), "demo sem aluno não é alerta");
  assert.ok(cods(demo).includes("ambiente-demo"));
});

test("risco: sem e-mail institucional, sem LGPD e alunos sem credencial", () => {
  const d = { escola: { status: "ativa", email_institucional: null }, coordenadores: [{ email: "c@x.com" }], alunos: 8, alunos_com_credencial: 0, responsaveis: 0, consentimentos: 0 };
  const av = avisosRisco({ status: "ativa", coordenadores: 1, alunos: 8, email_institucional: null }, d);
  const c = cods(av);
  assert.ok(c.includes("sem-email-institucional"));
  assert.ok(c.includes("alunos-sem-credencial"));
  assert.ok(c.includes("sem-consentimento"));
});

test("risco: escola saudável e completa não gera risco/alerta", () => {
  const escola = { status: "ativa", coordenadores: 1, alunos: 20, email_institucional: "x@escola.com", limite_alunos: 100 };
  const d = { escola, coordenadores: [{ email: "c@x.com" }], alunos: 20, alunos_com_credencial: 20, responsaveis: 5, consentimentos: 20 };
  const av = avisosRisco(escola, d);
  assert.equal(severidadeMaxima(av), "ok", `não deveria haver risco/alerta: ${JSON.stringify(cods(av))}`);
});

test("severidadeMaxima ordena risco > alerta > info > ok", () => {
  assert.equal(severidadeMaxima([{ nivel: "info" }, { nivel: "risco" }, { nivel: "alerta" }]), "risco");
  assert.equal(severidadeMaxima([{ nivel: "info" }, { nivel: "alerta" }]), "alerta");
  assert.equal(severidadeMaxima([{ nivel: "info" }]), "info");
  assert.equal(severidadeMaxima([]), "ok");
});

/* ---------- 3) checklist de go-live (tarefa 37) ---------- */

const vazia = { escola: { nome: "Nova", slug: "nova", status: "implantacao" }, coordenadores: [], turmas: [], alunos: 0, alunos_com_credencial: 0, responsaveis: 0, consentimentos: 0 };

test("checklist: escola recém-criada — só itens triviais feitos, críticos pendentes", () => {
  const itens = checklistGoLive(vazia);
  const m = resumoChecklist(itens);
  assert.ok(itens.find((i) => i.chave === "escola_criada").ok);
  assert.ok(itens.find((i) => i.chave === "dados_basicos").ok);
  assert.equal(itens.find((i) => i.chave === "coordenador").ok, false);
  assert.equal(itens.find((i) => i.chave === "alunos").ok, false);
  assert.equal(m.prontoGoLive, false, "não pode estar pronto sem coordenador/alunos");
  assert.ok(m.criticosPendentes.length > 0);
});

test("checklist: itens manuais (backup, smoke, smtp, termo) começam pendentes", () => {
  const itens = checklistGoLive(vazia);
  for (const ch of ["smtp_fallback", "termo_uso", "backup", "smoke"]) {
    const it = itens.find((i) => i.chave === ch);
    assert.ok(it.manual, `${ch} deve ser manual`);
    assert.equal(it.ok, false, `${ch} começa pendente`);
  }
});

test("checklist: backup e smoke são CRÍTICOS — travam prontoGoLive mesmo com tudo automático ok", () => {
  // escola automaticamente completa, mas backup/smoke não confirmados
  const d = {
    escola: { nome: "Pronta", slug: "pronta", status: "ativa", cor_acento: "#CDA349", email_institucional: "x@e.com" },
    coordenadores: [{ id: "1", nome: "Coord", email: "c@e.com" }],
    turmas: [{ id: "t1", nome: "T1" }],
    alunos: 30, alunos_com_credencial: 30, responsaveis: 10, consentimentos: 30,
  };
  const itens = checklistGoLive(d);
  const m = resumoChecklist(itens);
  assert.equal(m.prontoAutomatico, true, "todos os automáticos devem fechar");
  assert.equal(m.prontoGoLive, false, "backup/smoke manuais ainda travam o go-live");
  const cods = m.criticosPendentes.map((i) => i.chave);
  assert.ok(cods.includes("backup"));
  assert.ok(cods.includes("smoke"));
});

test("checklist: coordenador sem e-mail reprova o item de login", () => {
  const d = { ...vazia, coordenadores: [{ id: "1", nome: "X", email: null }] };
  const itens = checklistGoLive(d);
  assert.ok(itens.find((i) => i.chave === "coordenador").ok, "coordenador existe");
  assert.equal(itens.find((i) => i.chave === "coordenador_login").ok, false, "mas sem login");
});

test("checklist: escola suspensa não conta como operacional/ativa", () => {
  const d = { ...vazia, escola: { ...vazia.escola, status: "suspensa" } };
  const itens = checklistGoLive(d);
  assert.equal(itens.find((i) => i.chave === "operacional").ok, false);
});

/* ---------- 4) modalidades placeholder (tarefa 39) ---------- */

test("modalidades: só 'concurso' é ativa; resto é placeholder declarado", () => {
  const ativas = MODALIDADES.filter((m) => m.estado === "ativa").map((m) => m.codigo);
  assert.deepEqual(ativas, ["concurso"]);
  const mods = modalidadesDaEscola({ plano: "padrao" });
  assert.ok(mods.find((m) => m.codigo === "concurso").habilitada);
  // nenhuma modalidade futura habilitada por omissão
  assert.equal(mods.filter((m) => m.codigo !== "concurso").every((m) => !m.habilitada), true);
  // nada é persistido ainda (placeholder controlado)
  assert.ok(mods.every((m) => m.persistido === false));
});

/* ---------- 5) resumo de risco do dashboard (tarefa 36) ---------- */

test("resumoRisco agrega categorias e pendências da lista", () => {
  const lista = [
    { status: "ativa", slug: "real-1", plano: "padrao", coordenadores: 2, alunos: 50 },
    { status: "demo", slug: "demo-1", coordenadores: 1, alunos: 0 },
    { status: "implantacao", slug: "nova", coordenadores: 0, alunos: 0 },
    { status: "suspensa", slug: "sus", coordenadores: 1, alunos: 10 },
  ];
  const r = resumoRisco(lista);
  assert.equal(r.total, 4);
  assert.equal(r.real, 1);
  assert.equal(r.demo, 1);
  assert.equal(r.suspensas, 1);
  assert.equal(r.semCoordenador, 1, "só a 'nova' não tem coordenador");
  assert.equal(r.semAlunos, 1, "demo sem aluno não conta; só a 'nova'");
  assert.ok(r.comRisco >= 1);
});

/* ---------- 6) filtros de auditoria (tarefa 40) ---------- */

// Datas relativas ao relógio real para o teste de período ser
// determinístico em qualquer máquina (não cravamos uma data fixa).
const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
const logs = [
  { acao: "criar-escola", escola_id: "e1", super_admin_id: "op1", detalhe: { nome: "Alfa" }, em: diasAtras(2) },
  { acao: "suspender-escola", escola_id: "e2", super_admin_id: "op1", detalhe: { de: "ativa", para: "suspensa" }, em: diasAtras(40) },
  { acao: "vincular-coordenador", escola_id: "e1", super_admin_id: "op2", detalhe: { nome: "Maria", email: "maria@x.com" }, em: diasAtras(400) },
];

test("filtro: por escola, por ação e por usuário", () => {
  assert.equal(filtrarLogs(logs, { escolaId: "e1" }).length, 2);
  assert.equal(filtrarLogs(logs, { acao: "suspender-escola" }).length, 1);
  assert.equal(filtrarLogs(logs, { usuarioId: "op2" }).length, 1);
});

test("filtro: por período (dias) corta o que é antigo demais", () => {
  // 10 dias: pega só o log de 2 dias atrás.
  const recent = filtrarLogs(logs, { periodoDias: 10 });
  assert.equal(recent.length, 1);
  assert.equal(recent[0].acao, "criar-escola");
  // 50 dias pega os de 2 e 40 dias; 500 dias pega os três.
  assert.equal(filtrarLogs(logs, { periodoDias: 50 }).length, 2);
  assert.equal(filtrarLogs(logs, { periodoDias: 500 }).length, 3);
});

test("filtro: busca textual casa ação, nome de escola e e-mail/nome do detalhe", () => {
  assert.equal(filtrarLogs(logs, { busca: "maria" }).length, 1);
  assert.equal(filtrarLogs(logs, { busca: "suspender" }).length, 1);
  // ambos os logs de e1 resolvem para o nome de escola "Alfa" → 2 acertos.
  assert.equal(filtrarLogs(logs, { busca: "alfa", nomePorEscola: { e1: "Alfa" } }).length, 2);
});

test("acoesPresentes lista ações distintas ordenadas", () => {
  assert.deepEqual(acoesPresentes(logs), ["criar-escola", "suspender-escola", "vincular-coordenador"]);
});

test("filtro: sem critério devolve tudo (não esconde por engano)", () => {
  assert.equal(filtrarLogs(logs, {}).length, 3);
});
