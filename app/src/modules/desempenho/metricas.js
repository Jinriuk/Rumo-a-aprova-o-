/* Métricas de desempenho — PORTADAS da versão atual (o useMemo `m`
   do App.jsx). Mesmos cortes e thresholds; só os nomes de campo
   mudaram (date→data, subject→disciplina_codigo, done→questoes,
   correct→acertos). `acertos === null` equivale ao antigo
   `correct === ""` (registro sem acerto lançado). */
import { todayISO, notaProjetadaDia1 } from "../../shared/regras/regras.js";

export function calcularMetricas({ registros, simulados, semanas, semanaAtiva, disciplinas, metaQuestoes }) {
  const t = todayISO();
  const logs = registros.map((r) => ({ ...r, data: String(r.data) }));

  const hoje = logs.filter((l) => l.data === t);
  const qHoje = hoje.reduce((a, l) => a + (+l.questoes || 0), 0);
  const wlogs = logs.filter((l) => l.data >= semanaAtiva.inicio && l.data <= semanaAtiva.fim);
  const qSem = wlogs.reduce((a, l) => a + (+l.questoes || 0), 0);
  const totDone = logs.reduce((a, l) => a + (+l.questoes || 0), 0);
  const totCorr = logs.reduce((a, l) => a + (+l.acertos || 0), 0);
  const acerto = totDone ? Math.round((totCorr / totDone) * 100) : 0;

  // streak (sequência de dias com estudo, contando de hoje pra trás)
  const dset = new Set(logs.map((l) => l.data));
  let streak = 0;
  const d = new Date(`${t}T00:00:00`);
  while (dset.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const diasSemana = new Set(wlogs.map((l) => l.data)).size;
  const minutosSemana = wlogs.reduce((a, l) => a + (+l.minutos || 0), 0);
  const metaPct = Math.round((qSem / metaQuestoes) * 100);

  const weak = disciplinas.map((x) => {
    const ls = logs.filter((l) => l.disciplina_codigo === x.codigo && l.acertos !== null);
    const dd = ls.reduce((a, l) => a + (+l.questoes || 0), 0);
    const cc = ls.reduce((a, l) => a + (+l.acertos || 0), 0);
    return { name: x.nome, acc: dd ? Math.round((cc / dd) * 100) : null, n: dd };
  }).filter((x) => x.acc !== null && x.n >= 10 && x.acc < 60);

  let lastSim = null;
  if (simulados.length) {
    const sm = [...simulados].sort((a, b) => String(a.data).localeCompare(String(b.data)))[simulados.length - 1];
    lastSim = { label: sm.nome, nota: notaProjetadaDia1(sm.acertos) };
  }

  // visão do período todo: agregados por semana da trilha
  const weeksData = semanas.map((w) => {
    const wl = logs.filter((l) => l.data >= w.inicio && l.data <= w.fim);
    const q = wl.reduce((a, l) => a + (+l.questoes || 0), 0);
    const corr = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.acertos || 0), 0);
    const cd = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
    const dias = new Set(wl.map((l) => l.data)).size;
    return {
      n: w.numero, label: `S${w.numero}`, q, dias,
      acc: cd ? Math.round((corr / cd) * 100) : null,
      isNow: w.numero === semanaAtiva.numero,
      isPast: w.fim < t,
      isFuture: w.inicio > t,
    };
  });

  const totalDias = new Set(logs.map((l) => l.data)).size;
  const mediaDia = totalDias ? Math.round(totDone / totalDias) : 0;
  const minutosTotais = logs.reduce((a, l) => a + (+l.minutos || 0), 0);
  const mediaMinutosDia = totalDias ? Math.round(minutosTotais / totalDias) : 0;
  const datas = logs.map((l) => l.data).sort();
  const primeiraData = datas[0] || null;

  const semanasDecorridas = weeksData.filter((w) => w.isPast || w.isNow);
  const semanasBoas = semanasDecorridas.filter((w) => w.dias >= 4).length;
  const consistencia = semanasDecorridas.length
    ? Math.round((semanasBoas / semanasDecorridas.length) * 100) : 0;

  const semComAcc = weeksData.filter((w) => w.acc !== null && (w.isPast || w.isNow));
  let accTrend = null;
  if (semComAcc.length >= 2) {
    const ult = semComAcc[semComAcc.length - 1].acc;
    const ant = semComAcc[semComAcc.length - 2].acc;
    accTrend = { delta: ult - ant, de: ant, para: ult };
  }

  const matStats = disciplinas.map((x) => {
    const ls = logs.filter((l) => l.disciplina_codigo === x.codigo);
    const dd = ls.reduce((a, l) => a + (+l.questoes || 0), 0);
    const cdl = ls.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
    const cc = ls.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.acertos || 0), 0);
    return { id: x.codigo, name: x.nome, q: dd, acc: cdl ? Math.round((cc / cdl) * 100) : null, comAcc: cdl >= 10 };
  });

  return {
    qHoje, qSem, totDone, acerto, streak, wlogs, diasSemana, metaPct, weak, lastSim,
    weeksData, totalDias, mediaDia, primeiraData, consistencia, accTrend, matStats,
    minutosTotais, mediaMinutosDia, minutosSemana,
  };
}

/* Insights interpretados (cards de leitura antes dos gráficos):
   melhor matéria, maior volume e ponto de atenção. Voltam null
   quando não há dado suficiente — a tela mostra estado vazio. */
export function calcularInsights(m) {
  const comAcc = m.matStats.filter((s) => s.comAcc);
  const comVol = m.matStats.filter((s) => s.q > 0);

  const melhor = comAcc.length ? [...comAcc].sort((a, b) => b.acc - a.acc)[0] : null;
  const volume = comVol.length ? [...comVol].sort((a, b) => b.q - a.q)[0] : null;
  const pior = comAcc.length ? [...comAcc].sort((a, b) => a.acc - b.acc)[0] : null;

  let atencao = null;
  if (pior && pior.acc < 60) atencao = { tipo: "materia", materia: pior.name, acc: pior.acc };
  else if (m.accTrend && m.accTrend.delta <= -5) atencao = { tipo: "queda", de: m.accTrend.de, para: m.accTrend.para };
  else if (m.diasSemana < 3 && m.totalDias > 0) atencao = { tipo: "frequencia", dias: m.diasSemana };

  return { melhor, volume, atencao, temDados: m.totDone > 0 };
}
