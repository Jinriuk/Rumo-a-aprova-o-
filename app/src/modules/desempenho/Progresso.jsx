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

/* ---------- Simulados (registro + evolução + nota projetada) ---------- */
export function Simulados({ aluno, simulados, podeEditar, semanaAtiva, aoMudar }) {
  const T = useTema();
  const blank = { nome: semanaAtiva?.simulado || "Simulado", data: todayISO(), mat: "", ing: "", por: "", fis: "", qui: "", soc: "" };
  const [f, setF] = useState(blank);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });

  const inputS = { background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "12px 12px", fontSize: 16, width: "100%", minHeight: 46 };
  const lbl = { fontSize: 11, color: T.sub, marginBottom: 4, display: "block" };

  async function adicionar() {
    setErro(null);
    try {
      await db.adicionarSimulado({
        escola_id: aluno.escola_id, aluno_id: aluno.id, nome: f.nome, data: f.data,
        acertos: { mat: +f.mat || 0, ing: +f.ing || 0, por: +f.por || 0, fis: +f.fis || 0, qui: +f.qui || 0, soc: +f.soc || 0 },
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

  const chart = simulados.map((s) => {
    const dia1 = (s.acertos.mat || 0) + (s.acertos.ing || 0); // /40
    const tot = Object.values(s.acertos).reduce((a, b) => a + (+b || 0), 0);
    return { label: fmtBR(String(s.data)), dia1, tot };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Evolução nos simulados</div>
        {chart.length === 0 ? <Empty txt="Nenhum simulado registrado. A partir da Semana 5 começam." /> : (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={chart} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="label" tick={{ fill: T.sub, fontSize: 10 }} axisLine={{ stroke: T.line }} tickLine={false} minTickGap={6} />
              <YAxis tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="dia1" name="Dia 1 (Mat+Ing /40)" stroke={T.gold} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="tot" name="Total de acertos" stroke={T.green} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {podeEditar && (
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Registrar simulado</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 12 }}>Acertos por matéria. Dia 1: Mat (20) + Inglês (20). Dia 2: Português, Est. Sociais e Ciências (Fís/Quí).</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 160 }}><label style={lbl}>Nome</label><input value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} /></div>
              <div style={{ flex: 1, minWidth: 130 }}><label style={lbl}>Data</label><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
            </div>
            {[["mat", "Matemática /20"], ["ing", "Inglês /20"], ["por", "Português"], ["fis", "Física"], ["qui", "Química"], ["soc", "Est. Sociais"]].map(([k, lb]) => (
              <div key={k}><label style={lbl}>{lb}</label><input type="number" inputMode="numeric" min="0" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" style={inputS} /></div>
            ))}
          </div>
          <button onClick={adicionar} style={{ marginTop: 14, background: T.gold, color: "#0A1622", border: "none", borderRadius: 8, padding: "13px 20px", minHeight: 48, fontWeight: 700, fontSize: 15 }}>+ Salvar simulado</button>
          {erro && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{erro}</div>}
        </Card>
      )}

      {simulados.length > 0 && (
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Histórico</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[...simulados].reverse().map((s) => {
              const tot = Object.values(s.acertos).reduce((a, b) => a + (+b || 0), 0);
              const nota = Math.round(((s.acertos.mat || 0) + (s.acertos.ing || 0)) * 2.5);
              return (
                <div key={s.id} className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.nome} <span style={{ color: T.sub, fontWeight: 400 }}>· {fmtBR(String(s.data))}</span></div>
                    <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
                      Mat {s.acertos.mat ?? 0} · Ing {s.acertos.ing ?? 0} · Por {s.acertos.por ?? 0} · Fís {s.acertos.fis ?? 0} · Quí {s.acertos.qui ?? 0} · Soc {s.acertos.soc ?? 0}
                      {" · "}nota projetada Dia 1: <b style={{ color: nota >= 70 ? T.green : nota >= 50 ? T.gold : T.red }}>{nota}/100</b>
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
