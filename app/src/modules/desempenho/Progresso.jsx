/* Gráficos de desempenho — reaproveitam o recharts da versão atual
   (questões/dia, evolução por semana, acerto e total por matéria). */
import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Card, Empty } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO, fmtBR } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

const RANGES = [
  { id: "14", label: "14 dias", days: 14 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "all", label: "Tudo", days: null },
];

export function Progresso({ registros, trilha }) {
  const T = useTema();
  const [range, setRange] = useState("all");
  const logs = registros.map((r) => ({ ...r, data: String(r.data) }));

  const days = useMemo(() => {
    const hoje = todayISO();
    const datas = logs.map((l) => l.data).filter(Boolean).sort();
    const r = RANGES.find((x) => x.id === range) || RANGES[2];

    let inicio;
    if (r.days == null) {
      inicio = datas[0] || hoje;
    } else {
      const d = new Date(hoje); d.setDate(d.getDate() - (r.days - 1));
      inicio = d.toISOString().slice(0, 10);
    }
    // segurança: no máximo ~200 barras pra não pesar no celular
    const arr = [];
    const d = new Date(inicio + "T00:00:00");
    const fim = new Date(hoje + "T00:00:00");
    let guard = 0;
    while (d <= fim && guard < 220) {
      const iso = d.toISOString().slice(0, 10);
      arr.push({ iso, label: fmtBR(iso), q: logs.filter((l) => l.data === iso).reduce((a, l) => a + (+l.questoes || 0), 0) });
      d.setDate(d.getDate() + 1); guard++;
    }
    return arr;
  }, [registros, range]);

  const totalPeriodo = days.reduce((a, d) => a + d.q, 0);

  const porSemana = useMemo(() => trilha.semanas.map((w) => {
    const wl = logs.filter((l) => l.data >= w.inicio && l.data <= w.fim);
    const q = wl.reduce((a, l) => a + (+l.questoes || 0), 0);
    const cd = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
    const cc = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.acertos || 0), 0);
    return { label: `S${w.numero}`, q, acc: cd ? Math.round((cc / cd) * 100) : null };
  }), [registros, trilha]);
  const temSemana = porSemana.some((s) => s.q > 0);

  const porMat = trilha.disciplinas.map((s) => {
    const ls = logs.filter((l) => l.disciplina_codigo === s.codigo);
    const d = ls.reduce((a, l) => a + (+l.questoes || 0), 0);
    const c = ls.reduce((a, l) => a + (l.acertos === null ? 0 : +l.acertos), 0);
    const cd = ls.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
    return { id: s.codigo, short: s.abrev, color: s.cor, q: d, acc: cd ? Math.round((c / cd) * 100) : 0, hasAcc: cd > 0 };
  });
  const comAcc = porMat.filter((s) => s.hasAcc);
  const comQ = porMat.filter((s) => s.q > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Questões por dia</div>
          <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1px solid ${T.line}` }}>
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r.id)} style={{ border: "none", background: range === r.id ? T.gold : "transparent", color: range === r.id ? "#0A1622" : T.sub, fontWeight: 600, fontSize: 12, padding: "7px 11px", minHeight: 36, borderRadius: 6 }}>{r.label}</button>
            ))}
          </div>
        </div>
        {totalPeriodo === 0 ? <Empty txt="Sem registros neste período ainda." /> : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={days} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.sub, fontSize: 10 }} axisLine={{ stroke: T.line }} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink }} cursor={{ fill: "#ffffff08" }} labelStyle={{ color: T.sub }} />
              <Bar dataKey="q" radius={[4, 4, 0, 0]} fill={T.gold} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 8 }}>
          {totalPeriodo} questões no período · {days.length} {days.length === 1 ? "dia" : "dias"} mostrados
        </div>
      </Card>

      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Evolução por semana — as {trilha.semanas.length} semanas até a prova</div>
        {!temSemana ? <Empty txt="A evolução por semana aparece conforme os registros entram." /> : (
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={porSemana} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.sub, fontSize: 11 }} axisLine={{ stroke: T.line }} tickLine={false} />
              <YAxis yAxisId="q" tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <YAxis yAxisId="acc" orientation="right" domain={[0, 100]} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} formatter={(v, n) => n === "Acerto %" ? [v == null ? "—" : `${v}%`, n] : [v, n]} cursor={{ fill: "#ffffff08" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="q" dataKey="q" name="Questões" radius={[4, 4, 0, 0]} fill={T.gold} />
              <Line yAxisId="acc" type="monotone" dataKey="acc" name="Acerto %" stroke={T.green} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>% de acerto por matéria</div>
          {comAcc.length === 0 ? <Empty txt="Registre acertos pra ver o acerto por matéria." /> : (
            <ResponsiveContainer width="100%" height={Math.max(160, comAcc.length * 42)}>
              <BarChart layout="vertical" data={comAcc} margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="short" tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} formatter={(v) => [`${v}%`, "acerto"]} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="acc" radius={[0, 4, 4, 0]}>
                  {comAcc.map((s) => <Cell key={s.id} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Total de questões por matéria</div>
          {comQ.length === 0 ? <Empty txt="Sem registros ainda." /> : (
            <ResponsiveContainer width="100%" height={Math.max(160, comQ.length * 42)}>
              <BarChart layout="vertical" data={comQ} margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} horizontal={false} />
                <XAxis type="number" tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="short" tick={{ fill: T.sub, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="q" radius={[0, 4, 4, 0]}>
                  {comQ.map((s) => <Cell key={s.id} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Simulados (estrutura POR CONCURSO + validação + objetivo) ---------- */
import { provaDoConcurso, materiasDaProva, totalQuestoes, totalAcertos, notaPct, objetivoSugerido } from "../conteudo/provas.js";

export function Simulados({ aluno, simulados, podeEditar, semanaAtiva, concurso, aoMudar }) {
  const T = useTema();
  const prova = provaDoConcurso(concurso?.codigo);
  const materias = materiasDaProva(prova);
  const totalMax = totalQuestoes(prova);

  const blank = { nome: semanaAtiva?.simulado || `Simulado ${prova.rotulo}`, data: todayISO(), ...Object.fromEntries(materias.map((m) => [m.k, ""])) };
  const [f, setF] = useState(blank);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });

  const inputS = { background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "12px 12px", fontSize: 16, width: "100%", minHeight: 46 };
  const lbl = { fontSize: 11, color: T.sub, marginBottom: 4, display: "block" };

  // VALIDAÇÃO CRÍTICA (doc): acertos não podem passar do máximo da prova
  const estouros = materias.filter((m) => f[m.k] !== "" && +f[m.k] > m.max);

  async function adicionar() {
    if (estouros.length) return;
    setErro(null);
    try {
      await db.adicionarSimulado({
        escola_id: aluno.escola_id, aluno_id: aluno.id, nome: f.nome, data: f.data,
        acertos: Object.fromEntries(materias.map((m) => [m.k, Math.min(+f[m.k] || 0, m.max)])),
      });
      setF(blank);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
  }

  async function apagar(id) {
    setErro(null);
    try {
      await db.removerSimulado(id);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
  }

  const chart = simulados.map((s) => ({
    label: fmtBR(String(s.data)),
    nota: notaPct(prova, s.acertos),
    tot: totalAcertos(prova, s.acertos),
  }));

  const ultimo = simulados.length ? [...simulados].sort((a, b) => String(a.data).localeCompare(String(b.data)))[simulados.length - 1] : null;
  const evolucao = chart.length >= 2 ? chart[chart.length - 1].nota - chart[chart.length - 2].nota : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* DESEMPENHO + OBJETIVO do último simulado */}
      {ultimo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Último simulado</div>
            <div className="disp num" style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>
              {notaPct(prova, ultimo.acertos)}<span style={{ fontSize: 13, color: T.sub }}>/100</span>
              {evolucao != null && (
                <span style={{ fontSize: 12.5, marginLeft: 8, color: evolucao >= 0 ? T.green : T.red }}>{evolucao >= 0 ? "▲" : "▼"} {Math.abs(evolucao)}</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{ultimo.nome} · {fmtBR(String(ultimo.data))} · {totalAcertos(prova, ultimo.acertos)}/{totalMax} acertos</div>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.green}`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>🎯 Objetivo sugerido</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>{objetivoSugerido(prova, ultimo.acertos)}</div>
          </div>
        </div>
      )}

      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Evolução nos simulados — {prova.rotulo}</div>
        {chart.length === 0 ? <Empty txt="Nenhum simulado registrado ainda. Registre o primeiro abaixo." /> : (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={chart} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="label" tick={{ fill: T.sub, fontSize: 10 }} axisLine={{ stroke: T.line }} tickLine={false} minTickGap={6} />
              <YAxis domain={[0, 100]} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="nota" name={prova.notaRotulo ?? "nota geral %"} stroke={T.gold} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="tot" name={`acertos /${totalMax}`} stroke={T.green} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {podeEditar && (
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Registrar simulado — {prova.rotulo}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 12 }}>
            Acertos por matéria, com o máximo de cada prova. {totalMax} questões no total.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 2, minWidth: 160 }}><label style={lbl}>Nome</label><input value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} /></div>
            <div style={{ flex: 1, minWidth: 130 }}><label style={lbl}>Data</label><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
          </div>
          {prova.dias.map((dia) => (
            <div key={dia.nome} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{dia.nome}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                {dia.materias.map((m) => {
                  const estourou = f[m.k] !== "" && +f[m.k] > m.max;
                  return (
                    <div key={m.k}>
                      <label style={lbl}>{m.nome} <b style={{ color: T.sub }}>/{m.max}</b></label>
                      <input type="number" inputMode="numeric" min="0" max={m.max} value={f[m.k]} onChange={(e) => set(m.k, e.target.value)} placeholder="0"
                        style={{ ...inputS, borderColor: estourou ? T.red : T.line }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {estouros.length > 0 && (
            <div style={{ color: T.red, fontSize: 12.5, marginBottom: 10 }}>
              ⚠ {estouros.map((m) => `${m.nome} tem no máximo ${m.max} questões`).join(" · ")}
            </div>
          )}
          <button onClick={adicionar} disabled={estouros.length > 0}
            style={{ background: estouros.length ? T.line : T.gold, color: estouros.length ? T.sub : "#0A1622", border: "none", borderRadius: 8, padding: "13px 20px", minHeight: 48, fontWeight: 700, fontSize: 15, width: "100%" }}>
            + Salvar simulado
          </button>
          {erro && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{erro}</div>}
        </Card>
      )}

      {simulados.length > 0 && (
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Histórico</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[...simulados].reverse().map((s) => {
              const tot = totalAcertos(prova, s.acertos);
              const nota = notaPct(prova, s.acertos);
              return (
                <div key={s.id} className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.nome} <span style={{ color: T.sub, fontWeight: 400 }}>· {fmtBR(String(s.data))}</span></div>
                    <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
                      {materias.map((m) => `${m.nome.slice(0, 3)} ${Math.min(+s.acertos[m.k] || 0, m.max)}/${m.max}`).join(" · ")}
                      {" · "}{prova.notaRotulo ?? "nota"}: <b style={{ color: nota >= 70 ? T.green : nota >= 50 ? T.gold : T.red }}>{nota}/100</b>
                    </div>
                  </div>
                  <div className="num disp" style={{ fontSize: 20, fontWeight: 700, color: T.gold }}>{tot}</div>
                  {podeEditar && <button onClick={() => apagar(s.id)} aria-label="Apagar simulado" style={{ background: "transparent", border: "none", color: T.sub, fontSize: 22, width: 44, height: 44, flexShrink: 0, lineHeight: 1 }}>×</button>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
