/* ============================================================
   REGRAS DE NEGÓCIO PRESERVADAS — NÃO ALTERAR (Doc 2, Doc 6 §1.3)
   ------------------------------------------------------------
   Migradas SEM mudança da versão atual (src/App.jsx do Rumo ao
   Naval) e cobertas por teste (tests/regras.test.mjs) que confere
   o comportamento contra o original. O servidor tem o espelho
   destas regras em SQL (app.semana_da_data / app.hoje_local).
   ============================================================ */

// todayISO usa horário LOCAL de propósito: a virada de semana acontece à
// meia-noite do Brasil, não cedo demais por causa do fuso (UTC). Não trocar por UTC.
export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

export const fmtBR = (iso) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

// "22/06 (domingo)" — data curta com o dia da semana, em horário LOCAL
// (mesmo critério de todayISO: a virada é à meia-noite do Brasil).
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const fmtBRDiaSemana = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return fmtBR(String(iso));
  const dt = new Date(y, m - 1, d);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")} (${DIAS_SEMANA[dt.getDay()]})`;
};

export const daysBetween = (a, b) => Math.round((b - a) / 86400000);

// Semana ativa da trilha: intervalo [inicio, fim] INCLUSIVO contém
// hoje; antes da 1ª vale a 1ª; depois da última vale a última.
// Espelho exato do currentWeek() da versão atual.
//
// ATENÇÃO (Onda 3): o clamp final desta função — "depois da última vale
// a última" — é o mesmo de app.semana_da_data no banco, e é o motivo de
// o fim do ciclo ter ficado inexprimível por 43 dias no demo. Ela segue
// existindo porque as métricas precisam de UMA semana de referência
// mesmo depois do fim (senão o resumo do ciclo encerrado não teria
// contra o que calcular). Mas ela NÃO responde "o ciclo acabou?" —
// para isso existe estadoDoCiclo() abaixo. Quem precisa saber se a
// trilha terminou pergunta lá, nunca aqui.
export function semanaAtual(semanas, hoje = todayISO()) {
  for (const s of semanas) if (hoje >= s.inicio && hoje <= s.fim) return s;
  if (hoje < semanas[0].inicio) return semanas[0];
  return semanas[semanas.length - 1];
}

// ESTADO DO CICLO DE ESTUDO (Onda 3 — A1/T28) — espelho exato de
// app.estado_ciclo (migration 0049). Os dois lados precisam concordar:
// o banco decide se gera meta, o front decide o que a tela diz, e uma
// divergência entre eles reproduz o defeito original de outro jeito.
//
//   'sem_semanas' → trilha vazia (dado quebrado) — NÃO é fim de ciclo
//   'antes'       → a trilha ainda não começou
//   'em_curso'    → hoje cai dentro da trilha
//   'encerrado'   → hoje passou da última semana
//
// Isto é o PLANO DE ESTUDO, não a data da prova. Ver o comentário de
// diasParaProva em modules/conteudo/concursos.js: medido no demo, os
// 63 alunos dividem uma trilha que acaba em 01/08 e prestam cinco
// provas em datas diferentes. Confundir as duas coisas diria "prova
// realizada" a quem ainda tem dois meses de estudo pela frente.
export function estadoDoCiclo(semanas, hoje = todayISO()) {
  if (!Array.isArray(semanas) || semanas.length === 0) {
    return { estado: "sem_semanas", semana: null };
  }
  const primeira = semanas[0];
  const ultima = semanas[semanas.length - 1];
  if (hoje < String(primeira.inicio)) return { estado: "antes", semana: primeira };
  if (hoje > String(ultima.fim)) return { estado: "encerrado", semana: null };
  // dentro do intervalo: pode cair numa lacuna do calendário, e lacuna
  // não é fim de ciclo — o ciclo segue, só não há semana para hoje.
  const corrente = semanas.find((s) => hoje >= String(s.inicio) && hoje <= String(s.fim)) ?? null;
  return { estado: "em_curso", semana: corrente };
}

// Açúcar para o caso de longe mais comum nas telas.
export const cicloEncerrado = (semanas, hoje = todayISO()) =>
  estadoDoCiclo(semanas, hoje).estado === "encerrado";

// Nota projetada do Dia 1 = (mat + ing) × 2,5 — preservada exatamente.
export function notaProjetadaDia1(acertos) {
  return Math.round((acertos.mat + acertos.ing) * 2.5);
}
