/* Registro de estudo — menos administrativo (ref. designs): registro
   rápido com campos principais (matéria, questões, acertos, minutos) e
   secundários recolhíveis (tópico, observações, data). Resumo do dia
   no topo. Só o aluno escreve; o banco garante isso, não esta tela. */
import React, { useEffect, useMemo, useState } from "react";
import { SectionCard, EmptyState, Botao, Erro, useInputStyle, StatCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO, fmtBR } from "../../shared/regras/regras.js";
import { fmtHoras } from "./jargao.js";
import * as db from "../../shared/data/index.js";

export function Registrar({ aluno, trilha, registros, aoMudar, minutosSugeridos }) {
  const T = useTema();
  const { input: inputS, label: lbl } = useInputStyle();
  const branco = { data: todayISO(), disciplina_codigo: "mat", topico: "", questoes: "", acertos: "", minutos: "", obs: "" };
  const [f, setF] = useState(branco);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [maisCampos, setMaisCampos] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });

  // o cronômetro do topo manda os minutos direto pra cá
  useEffect(() => {
    if (minutosSugeridos > 0) setF((atual) => ({ ...atual, minutos: String(minutosSugeridos) }));
  }, [minutosSugeridos]);

  // resumo do dia
  const hoje = todayISO();
  const resumo = useMemo(() => {
    const ls = registros.filter((r) => String(r.data) === hoje);
    const q = ls.reduce((a, r) => a + (+r.questoes || 0), 0);
    const min = ls.reduce((a, r) => a + (+r.minutos || 0), 0);
    const cd = ls.filter((r) => r.acertos !== null).reduce((a, r) => a + (+r.questoes || 0), 0);
    const cc = ls.filter((r) => r.acertos !== null).reduce((a, r) => a + (+r.acertos || 0), 0);
    const materias = [...new Set(ls.map((r) => r.disciplina_codigo))]
      .map((c) => trilha.porCodigo[c]?.nome).filter(Boolean);
    return { q, min, acc: cd ? Math.round((cc / cd) * 100) : null, materias, n: ls.length };
  }, [registros, hoje, trilha]);

  async function adicionar() {
    if (!f.questoes || +f.questoes <= 0 || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const acertos = f.acertos === "" ? null : Math.min(+f.acertos, +f.questoes);
      await db.adicionarRegistro({
        escola_id: aluno.escola_id, aluno_id: aluno.id,
        data: f.data, disciplina_codigo: f.disciplina_codigo,
        topico: f.topico || null, questoes: +f.questoes,
        acertos, minutos: f.minutos === "" ? null : +f.minutos, obs: f.obs || null,
      });
      setF({ ...branco, data: f.data, disciplina_codigo: f.disciplina_codigo });
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  async function apagar(id) {
    setErro(null);
    try { await db.removerRegistro(id); aoMudar?.(); } catch (e) { setErro(e.message); }
  }

  const recentes = registros.slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* RESUMO DO DIA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Questões hoje" valor={resumo.q} icone="✦" tom={resumo.q > 0 ? "neutro" : "neutro"} />
        <StatCard rotulo="Tempo hoje" valor={fmtHoras(resumo.min)} icone="◷" />
        <StatCard rotulo="Acerto hoje" valor={resumo.acc == null ? "—" : `${resumo.acc}%`} icone="◎"
          tom={resumo.acc == null ? "neutro" : resumo.acc >= 70 ? "ok" : "alerta"} />
        <StatCard rotulo="Matérias" valor={resumo.materias.length} icone="📚"
          sub={resumo.materias.length ? resumo.materias.slice(0, 2).join(", ") + (resumo.materias.length > 2 ? "…" : "") : "nenhuma ainda"} />
      </div>

      {/* REGISTRO RÁPIDO */}
      <SectionCard titulo="Registro rápido" sub="Lance o que estudou agora — leva segundos.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Matéria</label>
            <select value={f.disciplina_codigo} onChange={(e) => set("disciplina_codigo", e.target.value)} style={inputS}>
              {trilha.disciplinas.map((s) => <option key={s.codigo} value={s.codigo} style={{ background: T.bg2 }}>{s.nome}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Questões</label><input type="number" inputMode="numeric" min="0" value={f.questoes} onChange={(e) => set("questoes", e.target.value)} placeholder="0" style={inputS} /></div>
          <div><label style={lbl}>Acertos</label><input type="number" inputMode="numeric" min="0" value={f.acertos} onChange={(e) => set("acertos", e.target.value)} placeholder="0" style={inputS} /></div>
          <div><label style={lbl}>Minutos</label><input type="number" inputMode="numeric" min="0" value={f.minutos} onChange={(e) => set("minutos", e.target.value)} placeholder="0" style={inputS} /></div>
        </div>

        <button onClick={() => setMaisCampos((v) => !v)}
          style={{ marginTop: 12, border: "none", background: "transparent", color: T.gold, fontSize: 12.5, fontWeight: 600, padding: "4px 0" }}>
          {maisCampos ? "− Menos campos" : "+ Tópico, observação e data"}
        </button>
        {maisCampos && (
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            <div><label style={lbl}>Tópico</label><input value={f.topico} onChange={(e) => set("topico", e.target.value)} placeholder="ex: geometria — ângulo inscrito" style={inputS} /></div>
            <div><label style={lbl}>Observações</label><input value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="onde travou, o que revisar…" style={inputS} /></div>
            <div style={{ maxWidth: 200 }}><label style={lbl}>Data</label><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inputS} /></div>
          </div>
        )}

        <Botao onClick={adicionar} disabled={!f.questoes || +f.questoes <= 0 || ocupado} style={{ marginTop: 14, width: "100%" }}>
          {ocupado ? "Salvando…" : "✓ Adicionar registro"}
        </Botao>
        <Erro>{erro}</Erro>
      </SectionCard>

      {/* RECENTES */}
      <SectionCard titulo="Registros recentes" semPadding>
        {recentes.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="✎" titulo="Nada registrado ainda" dica="Seu primeiro registro aparece aqui e alimenta o radar de desempenho." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentes.map((l, i) => {
              const s = trilha.porCodigo[l.disciplina_codigo];
              const acc = l.acertos !== null && l.questoes ? Math.round((l.acertos / l.questoes) * 100) : null;
              return (
                <div key={l.id} className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i === recentes.length - 1 ? "none" : `1px solid ${T.line}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s?.cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: T.ink }}>{s?.nome}{l.topico ? <span style={{ color: T.sub }}> · {l.topico}</span> : null}</div>
                    <div style={{ fontSize: 11.5, color: T.sub }}>{fmtBR(String(l.data))} · {l.questoes} questões{acc !== null ? ` · ${acc}% acerto` : ""}{l.minutos ? ` · ${l.minutos}min` : ""}</div>
                  </div>
                  <button onClick={() => apagar(l.id)} aria-label="Apagar registro" style={{ background: "transparent", border: "none", color: T.sub, fontSize: 22, width: 40, height: 40, flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
