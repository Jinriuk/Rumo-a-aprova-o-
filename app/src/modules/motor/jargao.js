/* ============================================================
   JARGÃO DE JOGO (camada de apresentação naval/militar).
   ------------------------------------------------------------
   Centralizado aqui de propósito: é só rótulo de tela. NÃO muda
   regra de negócio, dado nem a metodologia. Dá a cara de "missão"
   que engaja o aluno (ref. dos designs). Tweakável por concurso
   no futuro sem tocar no resto.
   ============================================================ */

export const L = {
  missao: "Missão",
  proximaMissao: "Próxima Missão",
  objetivos: "Objetivos da semana",
  concluir: "Concluir",
  adiar: "Adiar",
  cumprido: "Cumprido",
  precisao: "Precisão",
  horas: "Horas de instrução",
  alvos: "Alvos atingidos",
  ritmo: "Ritmo diário",
  radar: "Radar de desempenho",
  tempoProva: "Tempo p/ a prova",
};

// LEGADO (Fase ≤16): XP derivado em runtime no cliente. Mantido só
// como ESTIMATIVA de fallback quando o aluno ainda não tem eventos
// persistidos (base nova, antes do backfill). A fonte de verdade da
// Fase C0 é o ledger `aluno_eventos_progresso` — ver xpTotal().
export function calcularXP({ metas = [], totalQuestoes = 0, simulados = 0 }) {
  const cumpridas = metas.reduce(
    (a, m) => a + (m.meta_atividades ?? []).filter((x) => x.estado === "concluida").length,
    0,
  );
  return cumpridas * 100 + totalQuestoes + simulados * 50;
}

// FONTE DE VERDADE (Fase C0): XP total = soma de xp_delta dos eventos
// VÁLIDOS do ledger persistido. O banco é quem concede (gatilhos
// SECURITY DEFINER); aqui só somamos o que já está gravado. Pura e
// testável: a mesma conta roda no front e nos testes.
export function xpTotal(eventos = []) {
  return eventos.reduce(
    (a, e) => a + (e.status === "estornado" ? 0 : (+e.xp_delta || 0)),
    0,
  );
}

// Patentes por faixa de XP — escala do EXÉRCITO (padrão e neutra
// entre forças: as turmas misturam CN+EPCAR, EsSA+EEAr etc.).
// O "nível" é o índice + 1.
//
// Hierarquia da Fase 16: progressão militar real adaptada ao produto.
//   • PRAÇAS usam chevrons/gaivotas como base (insignia.chevrons) e
//     ganham arcos (insignia.arcos) conforme sobem de graduação.
//   • OFICIAIS usam estrelas como base (insignia.estrelas) e ganham
//     ornamentos premium (louros, coroa) e moldura dourada no topo.
//   • `faixa`       : "praca" | "oficial"  — muda o clima da insígnia.
//   • `nivelVisual` : 1..5 — riqueza da moldura (comum → lendária/dourada).
//   • `lema`        : significado simbólico (constância, comando…).
//
// `insignia` é só especificação de DESENHO — a regra (XP) não muda.
export const PATENTES = [
  { xp: 0,     nome: "Recruta",         faixa: "praca",   nivelVisual: 1, lema: "O primeiro passo da jornada.",                 insignia: { base: true } },
  { xp: 300,   nome: "Soldado",         faixa: "praca",   nivelVisual: 1, lema: "Disciplina que vira rotina.",                  insignia: { chevrons: 1 } },
  { xp: 700,   nome: "Cabo",            faixa: "praca",   nivelVisual: 1, lema: "Constância que começa a render.",              insignia: { chevrons: 2 } },
  { xp: 1200,  nome: "3º Sargento",     faixa: "praca",   nivelVisual: 2, lema: "Base sólida e ritmo firme.",                  insignia: { chevrons: 3 } },
  { xp: 1800,  nome: "2º Sargento",     faixa: "praca",   nivelVisual: 2, lema: "Experiência que comanda o próprio estudo.",  insignia: { chevrons: 3, arcos: 1 } },
  { xp: 2500,  nome: "1º Sargento",     faixa: "praca",   nivelVisual: 2, lema: "Veterania na linha de frente.",               insignia: { chevrons: 3, arcos: 2 } },
  { xp: 3400,  nome: "Subtenente",      faixa: "praca",   nivelVisual: 3, lema: "A mais alta graduação de praça — preparo de elite.", insignia: { chevrons: 3, arcos: 2, diamante: true } },
  { xp: 4500,  nome: "2º Tenente",      faixa: "oficial", nivelVisual: 3, lema: "Entrada no oficialato — liderança nascendo.", insignia: { estrelas: 1 } },
  { xp: 5800,  nome: "1º Tenente",      faixa: "oficial", nivelVisual: 3, lema: "Comando com método.",                         insignia: { estrelas: 2 } },
  { xp: 7300,  nome: "Capitão",         faixa: "oficial", nivelVisual: 4, lema: "Domínio e responsabilidade.",                 insignia: { estrelas: 3 } },
  { xp: 9000,  nome: "Major",           faixa: "oficial", nivelVisual: 4, lema: "Oficial superior — visão de campanha.",       insignia: { estrelas: 3, louros: true } },
  { xp: 11000, nome: "Tenente-Coronel", faixa: "oficial", nivelVisual: 5, lema: "Estratégia e elite.",                        insignia: { estrelas: 3, louros: true, arcoTopo: true } },
  { xp: 13500, nome: "Coronel",         faixa: "oficial", nivelVisual: 5, lema: "O topo da hierarquia — comando máximo.",     insignia: { estrelas: 3, louros: true, coroa: true } },
];

export function patente(xp) {
  let i = 0;
  for (let k = 0; k < PATENTES.length; k++) if (xp >= PATENTES[k].xp) i = k;
  const atual = PATENTES[i];
  const prox = PATENTES[i + 1] ?? null;
  const pct = prox ? Math.round(((xp - atual.xp) / (prox.xp - atual.xp)) * 100) : 100;
  return {
    nome: atual.nome, nivel: i + 1, xp,
    faixa: atual.faixa, lema: atual.lema, insignia: atual.insignia, nivelVisual: atual.nivelVisual,
    proxXp: prox?.xp ?? null, proxNome: prox?.nome ?? null, pctProx: pct,
  };
}

// XP que uma atividade vale, pela prioridade (Fechar vale mais).
export const xpPorPrioridade = { F: 100, P: 60, X: 40 };

// Nível 1 do banco de questões (doc, Fase 16): o sistema SUGERE a
// quantidade por objetivo; o aluno resolve fora e registra aqui.
// Quantidade por prioridade — vira configuração por edital na Fase 15.
export const questoesSugeridas = { F: 30, P: 20, X: 10 };

// Rótulo e tom da prioridade no "modo missão".
export const PRIORIDADE = {
  F: { texto: "Prioridade máxima", tom: "risco" },
  P: { texto: "Atenção média", tom: "alerta" },
  X: { texto: "Apoio", tom: "neutro" },
};

export const fmtHoras = (min) => {
  if (!min) return "0h00m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${String(m).padStart(2, "0")}m`;
};

export const fmtHorasCurto = (min) => {
  if (!min) return "0h";
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
};
