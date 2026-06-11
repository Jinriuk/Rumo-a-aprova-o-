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

export const daysBetween = (a, b) => Math.round((b - a) / 86400000);

// Semana ativa da trilha: intervalo [inicio, fim] INCLUSIVO contém
// hoje; antes da 1ª vale a 1ª; depois da última vale a última.
// Espelho exato do currentWeek() da versão atual.
export function semanaAtual(semanas, hoje = todayISO()) {
  for (const s of semanas) if (hoje >= s.inicio && hoje <= s.fim) return s;
  if (hoje < semanas[0].inicio) return semanas[0];
  return semanas[semanas.length - 1];
}

// Nota projetada do Dia 1 = (mat + ing) × 2,5 — preservada exatamente.
export function notaProjetadaDia1(acertos) {
  return Math.round((acertos.mat + acertos.ing) * 2.5);
}
